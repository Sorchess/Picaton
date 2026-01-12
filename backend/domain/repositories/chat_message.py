"""Интерфейс репозитория сообщений чата."""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from domain.entities.chat_message import ChatMessage


class ChatMessageRepositoryInterface(ABC):
    """Интерфейс репозитория для работы с сообщениями чата."""

    @abstractmethod
    async def create(self, message: ChatMessage) -> ChatMessage:
        """Создать сообщение."""
        pass

    @abstractmethod
    async def get_by_id(self, message_id: UUID) -> ChatMessage | None:
        """Получить сообщение по ID."""
        pass

    @abstractmethod
    async def update(self, message: ChatMessage) -> ChatMessage:
        """Обновить сообщение."""
        pass

    @abstractmethod
    async def delete(self, message_id: UUID) -> bool:
        """Удалить сообщение (hard delete)."""
        pass

    @abstractmethod
    async def get_by_project(
        self,
        project_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
        after: datetime | None = None,
    ) -> list[ChatMessage]:
        """
        Получить сообщения проекта.

        Args:
            project_id: ID проекта
            limit: Лимит сообщений
            before: Получить сообщения до этого времени (для пагинации вверх)
            after: Получить сообщения после этого времени (для новых)
        """
        pass

    @abstractmethod
    async def get_latest_message(
        self,
        project_id: UUID,
    ) -> ChatMessage | None:
        """Получить последнее сообщение в проекте."""
        pass

    @abstractmethod
    async def mark_as_read(
        self,
        project_id: UUID,
        user_id: UUID,
        until: datetime | None = None,
    ) -> int:
        """
        Отметить сообщения как прочитанные.
        Возвращает количество обновлённых сообщений.
        """
        pass

    @abstractmethod
    async def get_unread_count(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> int:
        """Получить количество непрочитанных сообщений."""
        pass

    @abstractmethod
    async def get_unread_counts_for_user(
        self,
        user_id: UUID,
        project_ids: list[UUID],
    ) -> dict[UUID, int]:
        """
        Получить количество непрочитанных сообщений для списка проектов.
        Возвращает {project_id: count}.
        """
        pass

    @abstractmethod
    async def count_by_project(self, project_id: UUID) -> int:
        """Подсчитать сообщения в проекте."""
        pass

    @abstractmethod
    async def soft_delete(self, message_id: UUID) -> bool:
        """Мягкое удаление сообщения."""
        pass

    @abstractmethod
    async def search_in_project(
        self,
        project_id: UUID,
        query: str,
        limit: int = 20,
    ) -> list[ChatMessage]:
        """Поиск сообщений в проекте."""
        pass
