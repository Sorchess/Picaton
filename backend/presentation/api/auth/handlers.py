from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from presentation.api.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    MagicLinkRequest,
    MagicLinkVerifyRequest,
    MagicLinkResponse,
    AuthUserResponse,
)
from presentation.api.users.schemas import UserResponse, TagInfo, ContactInfo
from infrastructure.dependencies import get_auth_service, get_magic_link_service
from application.services import (
    AuthService,
    MagicLinkService,
    InvalidCredentialsError,
    InvalidTokenError,
    MagicLinkExpiredError,
    MagicLinkInvalidError,
)
from application.tasks import send_magic_link_email
from domain.exceptions.user import UserAlreadyExistsError


router = APIRouter()
security = HTTPBearer()


@router.post(
    "/register", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    data: RegisterRequest,
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

    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        access_token=token,
    )


@router.post("/login", response_model=AuthUserResponse)
async def login(
    data: LoginRequest,
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

    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        access_token=token,
    )


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
        location=user.location,
        bio=user.bio,
        ai_generated_bio=user.ai_generated_bio,
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

    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        access_token=access_token,
    )
