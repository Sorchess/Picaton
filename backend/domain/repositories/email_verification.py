from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID


class EmailVerificationRepositoryInterface(ABC):
    """Интерфейс репозитория для хранения кодов верификации email."""

    @abstractmethod
    async def save_verification_code(
        self,
        user_id: UUID,
        email: str,
        code: str,
        expires_at: datetime,
    ) -> None:
        """
        Сохранить код верификации.

        Args:
            user_id: ID пользователя
            email: Email для верификации
            code: Код подтверждения
            expires_at: Время истечения кода
        """
        pass

    @abstractmethod
    async def get_verification(
        self,
        user_id: UUID,
        code: str,
    ) -> tuple[str, datetime] | None:
        """
        Получить данные верификации по коду.

        Args:
            user_id: ID пользователя
            code: Код подтверждения

        Returns:
            Кортеж (email, expires_at) или None если не найдено
        """
        pass

    @abstractmethod
    async def delete_verification(self, user_id: UUID) -> None:
        """
        Удалить запись верификации для пользователя.

        Args:
            user_id: ID пользователя
        """
        pass

    @abstractmethod
    async def delete_expired(self) -> int:
        """
        Удалить все истёкшие записи верификации.

        Returns:
            Количество удалённых записей
        """
        pass
