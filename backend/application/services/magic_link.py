"""Сервис Magic Link авторизации."""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from jose import JWTError, jwt

from domain.entities.user import User
from domain.enums.status import UserStatus
from domain.repositories.user import UserRepositoryInterface
from settings.config import settings


logger = logging.getLogger(__name__)


class MagicLinkError(Exception):
    """Базовая ошибка magic link."""

    pass


class MagicLinkExpiredError(MagicLinkError):
    """Ссылка истекла."""

    pass


class MagicLinkInvalidError(MagicLinkError):
    """Невалидная ссылка."""

    pass


class MagicLinkService:
    """Сервис для авторизации через magic link."""

    def __init__(self, user_repository: UserRepositoryInterface):
        self._user_repository = user_repository

    def generate_magic_token(self, email: str) -> str:
        """
        Генерирует токен для magic link.

        Args:
            email: Email пользователя

        Returns:
            JWT токен для magic link
        """
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.magic_link.expire_minutes
        )

        # Добавляем случайный jti для уникальности каждого токена
        jti = secrets.token_urlsafe(16)

        to_encode = {
            "sub": email,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": jti,
            "type": "magic_link",
        }

        return jwt.encode(
            to_encode,
            settings.magic_link.secret_key,
            algorithm=settings.jwt.algorithm,
        )

    def generate_magic_link(self, email: str) -> str:
        """
        Генерирует полную ссылку для входа.

        Args:
            email: Email пользователя

        Returns:
            Полный URL для входа
        """
        token = self.generate_magic_token(email)
        return f"{settings.api.url}/auth/magic?token={token}"

    async def verify_magic_token(self, token: str) -> tuple[User, str]:
        """
        Проверяет magic token и возвращает пользователя с access token.

        Если пользователь не существует — создаёт нового (passwordless регистрация).

        Args:
            token: Magic link токен

        Returns:
            Tuple (User, access_token)

        Raises:
            MagicLinkExpiredError: Если ссылка истекла
            MagicLinkInvalidError: Если ссылка невалидна
        """
        try:
            payload = jwt.decode(
                token,
                settings.magic_link.secret_key,
                algorithms=[settings.jwt.algorithm],
            )

            email: str = payload.get("sub")
            token_type: str = payload.get("type")

            if not email or token_type != "magic_link":
                raise MagicLinkInvalidError("Невалидный токен")

        except JWTError as e:
            if "expired" in str(e).lower():
                raise MagicLinkExpiredError("Ссылка для входа истекла")
            raise MagicLinkInvalidError("Невалидный токен")

        # Ищем пользователя по email
        user = await self._user_repository.get_by_email(email)

        if not user:
            # Создаём нового пользователя (passwordless регистрация)
            user = await self._create_user_from_email(email)
            logger.info(f"New user created via magic link: {email}")

        # Генерируем access token для авторизации
        access_token = self._create_access_token(user.id)

        logger.info(f"Magic link verified for user {email}")
        return user, access_token

    async def _create_user_from_email(self, email: str) -> User:
        """
        Создаёт нового пользователя только по email (passwordless).

        Args:
            email: Email пользователя

        Returns:
            Созданный пользователь
        """
        # Извлекаем имя из email (до @)
        email_name = email.split("@")[0]
        # Убираем точки и подчёркивания, делаем первую букву заглавной
        first_name = email_name.replace(".", " ").replace("_", " ").title().split()[0]

        user = User(
            id=uuid4(),
            email=email,
            hashed_password="",  # Пустой пароль для passwordless
            first_name=first_name,
            last_name="",
            status=UserStatus.AVAILABLE,
        )

        await self._user_repository.create(user)
        return user

    @staticmethod
    def _create_access_token(user_id: UUID) -> str:
        """Создать JWT access token."""
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt.access_token_expire_minutes
        )
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(
            to_encode,
            settings.jwt.secret_key,
            algorithm=settings.jwt.algorithm,
        )
