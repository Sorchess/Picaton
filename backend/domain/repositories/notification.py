"""Интерфейс репозитория уведомлений."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.notification import Notification


class NotificationRepositoryInterface(ABC):
    """Абстрактный репозиторий уведомлений."""

    @abstractmethod
    async def create(self, notification: Notification) -> Notification:
        """Создать уведомление."""
        ...

    @abstractmethod
    async def get_by_user(
        self, user_id: UUID, skip: int = 0, limit: int = 50
    ) -> list[Notification]:
        """Получить уведомления пользователя."""
        ...

    @abstractmethod
    async def mark_as_read(self, notification_id: UUID) -> bool:
        """Отметить уведомление как прочитанное."""
        ...

    @abstractmethod
    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Отметить все уведомления пользователя как прочитанные."""
        ...

    @abstractmethod
    async def get_unread_count(self, user_id: UUID) -> int:
        """Получить количество непрочитанных уведомлений."""
        ...

    @abstractmethod
    async def exists(self, user_id: UUID, type: str, actor_id: UUID) -> bool:
        """Проверить, существует ли уведомление данного типа от данного актора."""
        ...
