import secrets
from hmac import compare_digest
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from presentation.api.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    MagicLinkRequest,
    MagicLinkVerifyRequest,
    MagicLinkResponse,
    AuthUserResponse,
    TelegramAuthRequest,
    TelegramContactsSyncRequest,
    TelegramContactsSyncResponse,
    TelegramFoundContact,
    TelegramConfigResponse,
    TelegramDeepLinkResponse,
    TelegramAuthStatusResponse,
    TelegramBotConfirmRequest,
    ContactSyncSessionResponse,
    ContactSyncStatusResponse,
    BotContactsSyncRequest,
    BotSyncCompleteRequest,
)
from presentation.api.users.schemas import UserResponse, TagInfo, ContactInfo
from infrastructure.dependencies import (
    get_auth_service,
    get_magic_link_service,
    get_telegram_auth_service,
)
from application.services import (
    AuthService,
    MagicLinkService,
    InvalidCredentialsError,
    InvalidTokenError,
    MagicLinkExpiredError,
    MagicLinkInvalidError,
)
from application.services.telegram_auth import (
    TelegramAuthService,
    TelegramAuthError,
    TelegramDataExpiredError,
    TelegramInvalidHashError,
    TelegramBotNotConfiguredError,
    TelegramContact,
)
from application.tasks import send_magic_link_email
from domain.exceptions.user import UserAlreadyExistsError
from settings.config import settings


router = APIRouter()
security = HTTPBearer()


def _is_secure_cookie(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto:
        return "https" in forwarded_proto.lower()
    return request.url.scheme == "https"


def _set_auth_cookies(
    response: Response,
    request: Request,
    access_token: str,
    refresh_token: str,
) -> None:
    secure = _is_secure_cookie(request)
    samesite = settings.jwt.cookie_samesite

    response.set_cookie(
        key=settings.jwt.access_cookie_name,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.jwt.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key=settings.jwt.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.jwt.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/auth",
    )
    response.set_cookie(
        key=settings.jwt.csrf_cookie_name,
        value=secrets.token_urlsafe(32),
        httponly=False,
        secure=secure,
        samesite=samesite,
        max_age=settings.jwt.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key=settings.jwt.access_cookie_name, path="/")
    response.delete_cookie(key=settings.jwt.refresh_cookie_name, path="/api/auth")
    response.delete_cookie(key=settings.jwt.csrf_cookie_name, path="/")


def _validate_csrf(request: Request) -> None:
    cookie_token = request.cookies.get(settings.jwt.csrf_cookie_name)
    header_token = request.headers.get(settings.jwt.csrf_header_name)
    if not cookie_token or not header_token or not compare_digest(cookie_token, header_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed",
        )


@router.post(
    "/register", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    data: RegisterRequest,
    response: Response,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Регистрация нового пользователя."""
    try:
        user, token = await auth_service.register(
            email=data.email,
            password=data.password,
            first_name=data.first_name,
            last_name=data.last_name,
        )
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    refresh_token = auth_service.create_refresh_token(user.id)
    _set_auth_cookies(response, request, token, refresh_token)

    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        avatar_gradient=user.avatar_gradient,
        access_token=token,
    )


@router.post("/login", response_model=AuthUserResponse)
async def login(
    data: LoginRequest,
    response: Response,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Вход в систему."""
    try:
        user, token = await auth_service.login(
            email=data.email,
            password=data.password,
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    refresh_token = auth_service.create_refresh_token(user.id)
    _set_auth_cookies(response, request, token, refresh_token)

    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        avatar_gradient=user.avatar_gradient,
        access_token=token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    response: Response,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
):
    _validate_csrf(request)

    refresh_token = request.cookies.get(settings.jwt.refresh_cookie_name)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing",
        )

    try:
        user_id = auth_service.verify_refresh_token(refresh_token)
        user = await auth_service.get_user_by_id(user_id)
    except Exception:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    access_token = auth_service.create_access_token(user.id)
    rotated_refresh = auth_service.create_refresh_token(user.id)
    _set_auth_cookies(response, request, access_token, rotated_refresh)

    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout(response: Response, request: Request):
    _validate_csrf(request)
    _clear_auth_cookies(response)
    return {"success": True}


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Получить текущего авторизованного пользователя."""
    try:
        user = await auth_service.get_current_user(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        avatar_url=user.avatar_url,
        avatar_gradient=user.avatar_gradient,
        telegram_id=user.telegram_id,
        telegram_username=user.telegram_username,
        location=user.location,
        bio=user.bio,
        ai_generated_bio=user.ai_generated_bio,
        position=user.position,
        username=user.username,
        status=user.status.value,
        tags=[
            TagInfo(
                id=t.id,
                name=t.name,
                category=t.category,
                proficiency=t.proficiency,
            )
            for t in user.tags
        ],
        search_tags=user.search_tags,
        contacts=[
            ContactInfo(
                type=c.type.value,
                value=c.value,
                is_primary=c.is_primary,
            )
            for c in user.contacts
        ],
        random_facts=user.random_facts,
        profile_completeness=user.profile_completeness,
        is_onboarded=user.is_onboarded,
    )


@router.post("/magic-link", response_model=MagicLinkResponse)
async def request_magic_link(
    data: MagicLinkRequest,
    magic_link_service: MagicLinkService = Depends(get_magic_link_service),
):
    """
    Запросить magic link для входа по email.

    Отправляет письмо со ссылкой для входа на указанный email.
    Ссылка действительна 15 минут.
    """
    # Генерируем magic link
    magic_link = magic_link_service.generate_magic_link(data.email)

    # Отправляем задачу в очередь
    await send_magic_link_email.kiq(
        to_email=data.email,
        magic_link=magic_link,
    )

    return MagicLinkResponse(
        message="Ссылка для входа отправлена на вашу почту",
        email=data.email,
    )


@router.post("/magic-link/verify", response_model=AuthUserResponse)
async def verify_magic_link(
    data: MagicLinkVerifyRequest,
    response: Response,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
    magic_link_service: MagicLinkService = Depends(get_magic_link_service),
):
    """
    Верифицировать magic link и войти в систему.

    Проверяет токен из ссылки и возвращает access token для авторизации.
    """
    try:
        user, access_token = await magic_link_service.verify_magic_token(data.token)
    except MagicLinkExpiredError:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Ссылка для входа истекла. Запросите новую.",
        )
    except MagicLinkInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e) or "Невалидная ссылка для входа",
        )

    refresh_token = auth_service.create_refresh_token(user.id)
    _set_auth_cookies(response, request, access_token, refresh_token)

    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        avatar_gradient=user.avatar_gradient,
        access_token=access_token,
    )


# ==================== Telegram авторизация ====================


@router.get("/telegram/config", response_model=TelegramConfigResponse)
async def get_telegram_config():
    """
    Получить конфигурацию Telegram для фронтенда.

    Возвращает username бота для Telegram Login Widget.
    """
    return TelegramConfigResponse(
        bot_username=settings.telegram.bot_username,
        enabled=bool(settings.telegram.bot_token and settings.telegram.bot_username),
    )


@router.post("/telegram", response_model=AuthUserResponse)
async def telegram_auth(
    data: TelegramAuthRequest,
    response: Response,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Авторизация через Telegram Login Widget.

    Принимает данные от Telegram, верифицирует подпись,
    создаёт/находит пользователя и возвращает JWT токен.
    """
    try:
        user, token = await telegram_service.authenticate(data.model_dump())
    except TelegramBotNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram авторизация не настроена",
        )
    except TelegramDataExpiredError:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Данные авторизации Telegram устарели. Попробуйте ещё раз.",
        )
    except TelegramInvalidHashError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидная подпись данных Telegram",
        )
    except TelegramAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e) or "Ошибка авторизации через Telegram",
        )

    refresh_token = auth_service.create_refresh_token(user.id)
    _set_auth_cookies(response, request, token, refresh_token)

    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        avatar_gradient=user.avatar_gradient,
        telegram_id=user.telegram_id,
        telegram_username=user.telegram_username,
        access_token=token,
    )


@router.post("/telegram/sync-contacts", response_model=TelegramContactsSyncResponse)
async def sync_telegram_contacts(
    data: TelegramContactsSyncRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Синхронизировать контакты из Telegram.

    Принимает список контактов из Telegram и ищет
    зарегистрированных пользователей по telegram_id или username.
    """
    try:
        user = await auth_service.get_current_user(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Преобразуем запрос в объекты TelegramContact
    contacts = [
        TelegramContact(
            telegram_id=c.telegram_id,
            first_name=c.first_name,
            last_name=c.last_name,
            username=c.username,
            phone=c.phone,
        )
        for c in data.contacts
    ]

    result = await telegram_service.sync_telegram_contacts(user.id, contacts)

    return TelegramContactsSyncResponse(
        found=[
            TelegramFoundContact(
                user_id=f["user_id"],
                user_name=f["user_name"],
                contact_name=f.get("contact_name"),
                avatar_url=f.get("avatar_url"),
                telegram_username=f.get("telegram_username"),
            )
            for f in result["found"]
        ],
        found_count=result["found_count"],
        total=result["total"],
    )


# ==================== Telegram Deep Link Auth ====================


@router.post("/telegram/deeplink", response_model=TelegramDeepLinkResponse)
async def create_telegram_deeplink(
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Создать deep link для авторизации через Telegram.

    Возвращает ссылку, которая откроет приложение Telegram.
    Фронтенд должен polling'ом проверять статус по токену.
    """
    try:
        result = telegram_service.create_auth_token()
    except TelegramBotNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram авторизация не настроена",
        )

    return TelegramDeepLinkResponse(
        token=result["token"],
        deep_link=result["deep_link"],
        tg_link=result["tg_link"],
        expires_in=result["expires_in"],
    )


@router.get("/telegram/status/{token}", response_model=TelegramAuthStatusResponse)
async def check_telegram_auth_status(
    token: str,
    response: Response,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Проверить статус авторизации через Telegram deep link.

    Фронтенд вызывает этот endpoint polling'ом каждые 2-3 секунды.

    Возможные статусы:
    - pending: Ожидание подтверждения в Telegram
    - confirmed: Авторизация успешна, возвращает user и access_token
    - expired: Токен истёк
    """
    result = await telegram_service.check_auth_status(token)
    if result.get("status") == "confirmed" and result.get("access_token") and result.get(
        "user"
    ):
        user_id = result["user"].get("id")
        if user_id:
            try:
                refresh_token = auth_service.create_refresh_token(UUID(user_id))
                _set_auth_cookies(
                    response,
                    request,
                    result["access_token"],
                    refresh_token,
                )
            except Exception:
                pass

    return TelegramAuthStatusResponse(
        status=result["status"],
        message=result.get("message"),
        remaining=result.get("remaining"),
        user=result.get("user"),
        access_token=result.get("access_token"),
    )


@router.post("/telegram/bot/confirm")
async def confirm_telegram_auth_from_bot(
    data: TelegramBotConfirmRequest,
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Подтвердить авторизацию от Telegram бота.

    Этот endpoint вызывается Telegram ботом когда пользователь
    нажимает /start auth_TOKEN в боте.

    ⚠️ В продакшене нужно добавить верификацию что запрос от бота!
    """
    # TODO: Добавить проверку secret токена от бота
    success = telegram_service.confirm_auth_from_bot(
        token=data.token,
        telegram_id=data.telegram_id,
        first_name=data.first_name,
        last_name=data.last_name,
        username=data.username,
        photo_url=data.photo_url,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Токен авторизации не найден или истёк",
        )

    return {"success": True, "message": "Авторизация подтверждена"}


# ==================== Contact Sync via Bot ====================


@router.post("/telegram/sync-session", response_model=ContactSyncSessionResponse)
async def create_contact_sync_session(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Создать сессию синхронизации контактов через Telegram бота.

    Возвращает deep link для открытия бота в Telegram.
    Пользователь пересылает контакты боту, а затем нажимает "Готово".
    """
    # Получаем текущего пользователя
    user = await auth_service.get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
        )

    try:
        result = telegram_service.create_sync_session(str(user.id))
    except TelegramBotNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram бот не настроен",
        )

    return ContactSyncSessionResponse(
        token=result["token"],
        deep_link=result["deep_link"],
        tg_link=result["tg_link"],
        expires_in=result["expires_in"],
    )


@router.get("/telegram/sync-status/{token}", response_model=ContactSyncStatusResponse)
async def check_contact_sync_status(
    token: str,
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Проверить статус синхронизации контактов.

    Фронтенд вызывает этот endpoint polling'ом каждые 2-3 секунды.

    Возможные статусы:
    - pending: Ожидание контактов
    - completed: Синхронизация завершена, возвращает найденные контакты
    - expired: Сессия истекла
    """
    result = await telegram_service.check_sync_status(token)

    contacts = None
    if result.get("contacts"):
        contacts = [TelegramFoundContact(**c) for c in result["contacts"]]

    return ContactSyncStatusResponse(
        status=result["status"],
        message=result.get("message"),
        remaining=result.get("remaining"),
        contacts=contacts,
    )


@router.post("/telegram/bot/sync-contacts")
async def bot_add_sync_contacts(
    data: BotContactsSyncRequest,
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Добавить контакты в сессию синхронизации (вызывается ботом).

    ⚠️ В продакшене нужно добавить верификацию что запрос от бота!
    """
    contacts = [
        TelegramContact(
            telegram_id=c.telegram_id,
            first_name=c.first_name,
            last_name=c.last_name,
            username=c.username,
            phone=c.phone,
        )
        for c in data.contacts
    ]

    success = telegram_service.add_contacts_to_sync(data.token, contacts)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сессия синхронизации не найдена или истекла",
        )

    return {"success": True, "message": "Контакты добавлены"}


@router.post("/telegram/bot/sync-complete")
async def bot_complete_sync(
    data: BotSyncCompleteRequest,
    telegram_service: TelegramAuthService = Depends(get_telegram_auth_service),
):
    """
    Завершить сессию синхронизации (вызывается ботом).

    ⚠️ В продакшене нужно добавить верификацию что запрос от бота!
    """
    success = telegram_service.complete_sync(data.token)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сессия синхронизации не найдена или истекла",
        )

    return {"success": True, "message": "Синхронизация завершена"}
