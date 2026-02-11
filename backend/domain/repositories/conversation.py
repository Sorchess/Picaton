"""Интерфейс репозитория диалогов."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.conversation import Conversation


class ConversationRepositoryInterface(ABC):

    @abstractmethod
    async def create(self, conversation: Conversation) -> Conversation:
        pass

    @abstractmethod
    async def get_by_id(self, conversation_id: UUID) -> Conversation | None:
        pass

    @abstractmethod
    async def get_by_participants(
        self, user_id_1: UUID, user_id_2: UUID
    ) -> Conversation | None:
        """Найти диалог между двумя пользователями."""
        pass

    @abstractmethod
    async def get_user_conversations(
        self, user_id: UUID, limit: int = 50, offset: int = 0
    ) -> list[Conversation]:
        """Получить все диалоги пользователя, отсортированные по последнему сообщению."""
        pass

    @abstractmethod
    async def update(self, conversation: Conversation) -> Conversation:
        pass

    @abstractmethod
    async def delete(self, conversation_id: UUID) -> bool:
        pass
