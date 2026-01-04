from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    """Запрос на регистрацию."""

    email: EmailStr
    password: str
    first_name: str = ""
    last_name: str = ""


class LoginRequest(BaseModel):
    """Запрос на вход."""

    email: EmailStr
    password: str


class MagicLinkRequest(BaseModel):
    """Запрос на отправку magic link."""

    email: EmailStr


class MagicLinkVerifyRequest(BaseModel):
    """Запрос на верификацию magic link."""

    token: str


class TokenResponse(BaseModel):
    """Ответ с токеном."""

    access_token: str
    token_type: str = "bearer"


class MagicLinkResponse(BaseModel):
    """Ответ на запрос magic link."""

    message: str
    email: str


class AuthUserResponse(BaseModel):
    """Ответ с информацией о пользователе и токеном."""

    id: str
    email: str
    first_name: str
    last_name: str
    avatar_url: str | None = None
    telegram_id: int | None = None
    telegram_username: str | None = None
    access_token: str
    token_type: str = "bearer"


# Telegram авторизация


class TelegramAuthRequest(BaseModel):
    """Данные авторизации от Telegram Login Widget."""

    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class TelegramContactRequest(BaseModel):
    """Контакт из Telegram для синхронизации."""

    telegram_id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    phone: str | None = None


class TelegramContactsSyncRequest(BaseModel):
    """Запрос на синхронизацию контактов из Telegram."""

    contacts: list[TelegramContactRequest]


class TelegramFoundContact(BaseModel):
    """Найденный контакт из Telegram."""

    user_id: str
    user_name: str
    contact_name: str | None = None
    avatar_url: str | None = None
    telegram_username: str | None = None


class TelegramContactsSyncResponse(BaseModel):
    """Ответ на синхронизацию контактов из Telegram."""

    found: list[TelegramFoundContact]
    found_count: int
    total: int


class TelegramConfigResponse(BaseModel):
    """Конфигурация Telegram для фронтенда."""

    bot_username: str
    enabled: bool


# ==================== Telegram Deep Link Auth ====================


class TelegramDeepLinkResponse(BaseModel):
    """Ответ с deep link для авторизации через Telegram."""

    token: str
    deep_link: str  # https://t.me/bot?start=auth_TOKEN
    tg_link: str  # tg://resolve?domain=bot&start=auth_TOKEN
    expires_in: int  # Секунды до истечения


class TelegramAuthStatusResponse(BaseModel):
    """Статус авторизации через Telegram deep link."""

    status: str  # "pending" | "confirmed" | "expired"
    message: str | None = None
    remaining: int | None = None  # Секунды до истечения (для pending)
    user: dict | None = None  # Данные пользователя (для confirmed)
    access_token: str | None = None  # JWT токен (для confirmed)


class TelegramBotConfirmRequest(BaseModel):
    """Запрос от Telegram бота на подтверждение авторизации."""

    token: str  # auth_TOKEN из /start команды
    telegram_id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None


# ==================== Contact Sync via Bot ====================


class ContactSyncSessionResponse(BaseModel):
    """Ответ с сессией синхронизации контактов."""

    token: str
    deep_link: str  # https://t.me/bot?start=sync_TOKEN
    tg_link: str  # tg://resolve?domain=bot&start=sync_TOKEN
    expires_in: int  # Секунды до истечения


class ContactSyncStatusResponse(BaseModel):
    """Статус синхронизации контактов."""

    status: str  # "pending" | "completed" | "expired"
    message: str | None = None
    remaining: int | None = None  # Секунды до истечения (для pending)
    contacts: list[TelegramFoundContact] | None = None  # Найденные контакты


class BotContactsSyncRequest(BaseModel):
    """Запрос от бота с контактами для синхронизации."""

    token: str  # sync_TOKEN из /start команды
    contacts: list[TelegramContactRequest]


class BotSyncCompleteRequest(BaseModel):
    """Запрос от бота на завершение синхронизации."""

    token: str  # sync_TOKEN
