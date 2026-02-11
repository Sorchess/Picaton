"""Интерфейс репозитория прямых сообщений."""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from domain.entities.conversation import DirectMessage


class DirectMessageRepositoryInterface(ABC):

    @abstractmethod
    async def create(self, message: DirectMessage) -> DirectMessage:
        pass

    @abstractmethod
    async def get_by_id(self, message_id: UUID) -> DirectMessage | None:
        pass

    @abstractmethod
    async def update(self, message: DirectMessage) -> DirectMessage:
        pass

    @abstractmethod
    async def get_by_conversation(
        self,
        conversation_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
    ) -> list[DirectMessage]:
        """Получить сообщения диалога с пагинацией."""
        pass

    @abstractmethod
    async def mark_as_read(self, conversation_id: UUID, reader_id: UUID) -> int:
        """Пометить все непрочитанные сообщения как прочитанные."""
        pass

    @abstractmethod
    async def get_unread_count(self, conversation_id: UUID, user_id: UUID) -> int:
        """Количество непрочитанных сообщений для пользователя в диалоге."""
        pass

    @abstractmethod
    async def get_total_unread_count(self, user_id: UUID) -> int:
        """Общее количество непрочитанных сообщений для пользователя."""
        pass

    @abstractmethod
    async def get_unread_counts_by_conversation(self, user_id: UUID) -> dict[UUID, int]:
        """Количество непрочитанных по каждому диалогу."""
        pass

    @abstractmethod
    async def soft_delete(self, message_id: UUID) -> bool:
        pass

    @abstractmethod
    async def search_in_conversation(
        self, conversation_id: UUID, query: str, limit: int = 20
    ) -> list[DirectMessage]:
        pass
