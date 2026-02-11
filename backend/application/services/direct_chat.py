"""Сервис прямых сообщений между пользователями."""

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from domain.entities.conversation import Conversation, DirectMessage
from domain.repositories.conversation import ConversationRepositoryInterface
from domain.repositories.direct_message import DirectMessageRepositoryInterface


logger = logging.getLogger(__name__)


class DMAccessDeniedError(Exception):
    def __init__(self, conversation_id: str, user_id: str):
        self.conversation_id = conversation_id
        self.user_id = user_id
        super().__init__(
            f"Access denied to conversation {conversation_id} for user {user_id}"
        )


class DMMessageNotFoundError(Exception):
    def __init__(self, message_id: str):
        self.message_id = message_id
        super().__init__(f"Direct message not found: {message_id}")


class DirectChatService:
    def __init__(
        self,
        conversation_repo: ConversationRepositoryInterface,
        message_repo: DirectMessageRepositoryInterface,
    ):
        self._conv_repo = conversation_repo
        self._msg_repo = message_repo

    async def get_or_create_conversation(
        self, user_id_1: UUID, user_id_2: UUID
    ) -> Conversation:
        """Получить или создать диалог между двумя пользователями."""
        conv = await self._conv_repo.get_by_participants(user_id_1, user_id_2)
        if conv:
            return conv

        conv = Conversation(
            id=uuid4(),
            participants=sorted([user_id_1, user_id_2], key=str),
        )
        return await self._conv_repo.create(conv)

    async def get_conversation(
        self, conversation_id: UUID, user_id: UUID
    ) -> Conversation:
        """Получить диалог с проверкой доступа."""
        conv = await self._conv_repo.get_by_id(conversation_id)
        if not conv:
            raise DMAccessDeniedError(str(conversation_id), str(user_id))
        if not conv.is_participant(user_id):
            raise DMAccessDeniedError(str(conversation_id), str(user_id))
        return conv

    async def get_user_conversations(
        self, user_id: UUID, limit: int = 50, offset: int = 0
    ) -> list[Conversation]:
        """Получить все диалоги пользователя."""
        return await self._conv_repo.get_user_conversations(
            user_id, limit=limit, offset=offset
        )

    async def send_message(
        self,
        conversation_id: UUID,
        sender_id: UUID,
        content: str,
        reply_to_id: UUID | None = None,
    ) -> DirectMessage:
        """Отправить сообщение в диалог."""
        conv = await self.get_conversation(conversation_id, sender_id)

        message = DirectMessage(
            id=uuid4(),
            conversation_id=conversation_id,
            sender_id=sender_id,
            content=content,
            reply_to_id=reply_to_id,
        )
        message = await self._msg_repo.create(message)

        # Обновить превью последнего сообщения в диалоге
        conv.update_last_message(content, sender_id)
        await self._conv_repo.update(conv)

        return message

    async def send_first_message(
        self, sender_id: UUID, recipient_id: UUID, content: str
    ) -> tuple[Conversation, DirectMessage]:
        """Отправить первое сообщение — создать или найти диалог и отправить."""
        conv = await self.get_or_create_conversation(sender_id, recipient_id)

        message = DirectMessage(
            id=uuid4(),
            conversation_id=conv.id,
            sender_id=sender_id,
            content=content,
        )
        message = await self._msg_repo.create(message)

        conv.update_last_message(content, sender_id)
        await self._conv_repo.update(conv)

        return conv, message

    async def get_messages(
        self,
        conversation_id: UUID,
        user_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
    ) -> list[DirectMessage]:
        """Получить сообщения диалога с пагинацией."""
        await self.get_conversation(conversation_id, user_id)
        return await self._msg_repo.get_by_conversation(
            conversation_id, limit=limit, before=before
        )

    async def edit_message(
        self, message_id: UUID, user_id: UUID, new_content: str
    ) -> DirectMessage:
        """Редактировать сообщение (только автор)."""
        message = await self._msg_repo.get_by_id(message_id)
        if not message:
            raise DMMessageNotFoundError(str(message_id))
        if message.sender_id != user_id:
            raise DMAccessDeniedError(str(message.conversation_id), str(user_id))

        message.edit(new_content)
        return await self._msg_repo.update(message)

    async def delete_message(self, message_id: UUID, user_id: UUID) -> bool:
        """Удалить сообщение (только автор)."""
        message = await self._msg_repo.get_by_id(message_id)
        if not message:
            raise DMMessageNotFoundError(str(message_id))
        if message.sender_id != user_id:
            raise DMAccessDeniedError(str(message.conversation_id), str(user_id))

        return await self._msg_repo.soft_delete(message_id)

    async def mark_as_read(self, conversation_id: UUID, user_id: UUID) -> int:
        """Пометить все сообщения как прочитанные."""
        await self.get_conversation(conversation_id, user_id)
        return await self._msg_repo.mark_as_read(conversation_id, user_id)

    async def get_unread_count(self, conversation_id: UUID, user_id: UUID) -> int:
        return await self._msg_repo.get_unread_count(conversation_id, user_id)

    async def get_total_unread(self, user_id: UUID) -> int:
        return await self._msg_repo.get_total_unread_count(user_id)

    async def get_unread_counts(self, user_id: UUID) -> dict[UUID, int]:
        return await self._msg_repo.get_unread_counts_by_conversation(user_id)
