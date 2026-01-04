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
