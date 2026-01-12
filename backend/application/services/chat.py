"""Сервис чата в проектах."""

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from domain.entities.chat_message import ChatMessage
from domain.enums.project import MessageType
from domain.repositories.chat_message import ChatMessageRepositoryInterface
from domain.repositories.project_member import ProjectMemberRepositoryInterface


logger = logging.getLogger(__name__)


class ChatAccessDeniedError(Exception):
    """Доступ к чату запрещён."""

    def __init__(self, project_id: str, user_id: str):
        self.project_id = project_id
        self.user_id = user_id
        super().__init__(
            f"Access denied to chat in project {project_id} for user {user_id}"
        )


class MessageNotFoundError(Exception):
    """Сообщение не найдено."""

    def __init__(self, message_id: str):
        self.message_id = message_id
        super().__init__(f"Message not found: {message_id}")


class ChatService:
    """Сервис чата в проектах."""

    def __init__(
        self,
        chat_repository: ChatMessageRepositoryInterface,
        member_repository: ProjectMemberRepositoryInterface,
    ):
        self._chat_repo = chat_repository
        self._member_repo = member_repository

    async def _check_access(self, project_id: UUID, user_id: UUID) -> None:
        """Проверить доступ пользователя к чату проекта."""
        is_member = await self._member_repo.is_member(project_id, user_id)
        if not is_member:
            raise ChatAccessDeniedError(str(project_id), str(user_id))

    async def send_message(
        self,
        project_id: UUID,
        author_id: UUID,
        content: str,
        reply_to_id: UUID | None = None,
    ) -> ChatMessage:
        """Отправить сообщение в чат проекта."""
        await self._check_access(project_id, author_id)

        message = ChatMessage(
            id=uuid4(),
            project_id=project_id,
            author_id=author_id,
            content=content,
            message_type=MessageType.TEXT,
            reply_to_id=reply_to_id,
            read_by=[author_id],  # Автор сразу прочитал
        )

        return await self._chat_repo.create(message)

    async def send_system_message(
        self,
        project_id: UUID,
        content: str,
    ) -> ChatMessage:
        """Отправить системное сообщение."""
        message = ChatMessage.create_system_message(
            project_id=project_id,
            content=content,
        )
        message.id = uuid4()

        return await self._chat_repo.create(message)

    async def get_messages(
        self,
        project_id: UUID,
        user_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
        after: datetime | None = None,
    ) -> list[ChatMessage]:
        """Получить сообщения чата."""
        await self._check_access(project_id, user_id)

        return await self._chat_repo.get_by_project(
            project_id=project_id,
            limit=limit,
            before=before,
            after=after,
        )

    async def edit_message(
        self,
        message_id: UUID,
        user_id: UUID,
        new_content: str,
    ) -> ChatMessage:
        """Редактировать сообщение."""
        message = await self._chat_repo.get_by_id(message_id)
        if not message:
            raise MessageNotFoundError(str(message_id))

        # Только автор может редактировать
        if message.author_id != user_id:
            raise ChatAccessDeniedError(str(message.project_id), str(user_id))

        message.edit(new_content)
        return await self._chat_repo.update(message)

    async def delete_message(
        self,
        message_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Удалить сообщение (soft delete)."""
        message = await self._chat_repo.get_by_id(message_id)
        if not message:
            raise MessageNotFoundError(str(message_id))

        # Проверяем права - автор или админ проекта
        if message.author_id != user_id:
            member = await self._member_repo.get_by_project_and_user(
                message.project_id, user_id
            )
            if not member or not member.is_admin_or_owner:
                raise ChatAccessDeniedError(str(message.project_id), str(user_id))

        return await self._chat_repo.soft_delete(message_id)

    async def mark_as_read(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> int:
        """Отметить все сообщения как прочитанные."""
        await self._check_access(project_id, user_id)

        return await self._chat_repo.mark_as_read(
            project_id=project_id,
            user_id=user_id,
            until=datetime.now(timezone.utc),
        )

    async def get_unread_count(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> int:
        """Получить количество непрочитанных сообщений."""
        return await self._chat_repo.get_unread_count(project_id, user_id)

    async def get_unread_counts(
        self,
        user_id: UUID,
    ) -> dict[UUID, int]:
        """Получить количество непрочитанных сообщений для всех проектов пользователя."""
        project_ids = await self._member_repo.get_project_ids_for_user(user_id)
        if not project_ids:
            return {}

        return await self._chat_repo.get_unread_counts_for_user(user_id, project_ids)

    async def search_messages(
        self,
        project_id: UUID,
        user_id: UUID,
        query: str,
        limit: int = 20,
    ) -> list[ChatMessage]:
        """Поиск сообщений в чате."""
        await self._check_access(project_id, user_id)

        return await self._chat_repo.search_in_project(
            project_id=project_id,
            query=query,
            limit=limit,
        )

    async def get_latest_message(
        self,
        project_id: UUID,
    ) -> ChatMessage | None:
        """Получить последнее сообщение в проекте."""
        return await self._chat_repo.get_latest_message(project_id)
