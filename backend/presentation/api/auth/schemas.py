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


class TokenResponse(BaseModel):
    """Ответ с токеном."""

    access_token: str
    token_type: str = "bearer"


class AuthUserResponse(BaseModel):
    """Ответ с информацией о пользователе и токеном."""

    id: str
    email: str
    first_name: str
    last_name: str
    avatar_url: str | None = None
    access_token: str
    token_type: str = "bearer"
