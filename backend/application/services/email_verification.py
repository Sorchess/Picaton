"""Сервис верификации email."""

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from domain.repositories.email_verification import EmailVerificationRepositoryInterface
from domain.repositories.user import UserRepositoryInterface
from domain.exceptions.user import UserNotFoundError


class EmailVerificationError(Exception):
    """Ошибка верификации email."""

    pass


class EmailVerificationService:
    """Сервис для верификации email через код подтверждения."""

    CODE_LENGTH = 6
    CODE_EXPIRY_MINUTES = 15

    def __init__(
        self,
        verification_repository: EmailVerificationRepositoryInterface,
        user_repository: UserRepositoryInterface,
    ):
        self._verification_repo = verification_repository
        self._user_repo = user_repository

    def _generate_code(self) -> str:
        """Генерирует 6-значный код подтверждения."""
        return "".join(secrets.choice("0123456789") for _ in range(self.CODE_LENGTH))

    async def send_verification_code(self, user_id: UUID, email: str) -> str:
        """
        Создаёт и сохраняет код верификации для email.

        Args:
            user_id: ID пользователя
            email: Email для верификации

        Returns:
            Сгенерированный код (для отправки по email)
        """
        # Проверяем что пользователь существует
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError(user_id)

        # Генерируем код
        code = self._generate_code()
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=self.CODE_EXPIRY_MINUTES
        )

        # Сохраняем в базу
        await self._verification_repo.save_verification_code(
            user_id=user_id,
            email=email,
            code=code,
            expires_at=expires_at,
        )

        return code

    async def verify_code(self, user_id: UUID, code: str) -> str:
        """
        Проверяет код подтверждения и обновляет email пользователя.

        Args:
            user_id: ID пользователя
            code: Код подтверждения

        Returns:
            Подтверждённый email

        Raises:
            EmailVerificationError: Неверный или истёкший код
        """
        # Получаем запись верификации
        result = await self._verification_repo.get_verification(user_id, code)
        if not result:
            raise EmailVerificationError("Неверный код подтверждения")

        email, expires_at = result

        # Проверяем срок действия
        if datetime.now(timezone.utc) > expires_at:
            await self._verification_repo.delete_verification(user_id)
            raise EmailVerificationError("Код подтверждения истёк")

        # Обновляем email пользователя
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError(user_id)

        user.email = email
        await self._user_repo.update(user)

        # Удаляем использованный код
        await self._verification_repo.delete_verification(user_id)

        return email
