"""Доменные сущности для прямых сообщений между пользователями."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity


MAX_DM_LENGTH = 10000


class InvalidDirectMessageError(ValueError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Invalid direct message: {reason}")


@dataclass
class Conversation(Entity):
    """Диалог между двумя пользователями."""

    participants: list[UUID] = field(default_factory=list)
    last_message_content: str | None = field(default=None)
    last_message_sender_id: UUID | None = field(default=None)
    last_message_at: datetime | None = field(default=None)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if self.participants and len(self.participants) != 2:
            raise InvalidDirectMessageError(
                "Conversation must have exactly 2 participants"
            )

    def get_other_participant(self, user_id: UUID) -> UUID:
        """Получить ID собеседника."""
        for p in self.participants:
            if p != user_id:
                return p
        raise InvalidDirectMessageError(
            "User is not a participant of this conversation"
        )

    def is_participant(self, user_id: UUID) -> bool:
        """Проверить, является ли пользователь участником."""
        return user_id in self.participants

    def update_last_message(self, content: str, sender_id: UUID) -> None:
        """Обновить последнее сообщение."""
        self.last_message_content = content[:100]  # Превью
        self.last_message_sender_id = sender_id
        self.last_message_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)


@dataclass
class DirectMessage(Entity):
    """Прямое сообщение в диалоге."""

    conversation_id: UUID = field(default=None)
    sender_id: UUID = field(default=None)
    content: str = field(default="")
    is_read: bool = field(default=False)
    read_at: datetime | None = field(default=None)
    is_edited: bool = field(default=False)
    edited_at: datetime | None = field(default=None)
    is_deleted: bool = field(default=False)
    deleted_at: datetime | None = field(default=None)
    reply_to_id: UUID | None = field(default=None)
    forwarded_from_user_id: UUID | None = field(default=None)
    forwarded_from_name: str | None = field(default=None)
    hidden_for_user_ids: list[UUID] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if self.content:
            self._validate_content(self.content)

    @staticmethod
    def _validate_content(content: str) -> None:
        if len(content) > MAX_DM_LENGTH:
            raise InvalidDirectMessageError(
                f"Message must not exceed {MAX_DM_LENGTH} characters"
            )

    def edit(self, new_content: str) -> None:
        """Редактировать сообщение."""
        self._validate_content(new_content)
        self.content = new_content
        self.is_edited = True
        self.edited_at = datetime.now(timezone.utc)

    def mark_as_read(self) -> None:
        """Пометить как прочитанное."""
        if not self.is_read:
            self.is_read = True
            self.read_at = datetime.now(timezone.utc)

    def soft_delete(self) -> None:
        """Мягкое удаление."""
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.content = ""

    def hide_for_user(self, user_id: UUID) -> None:
        if user_id not in self.hidden_for_user_ids:
            self.hidden_for_user_ids.append(user_id)

    def is_hidden_for_user(self, user_id: UUID) -> bool:
        return user_id in self.hidden_for_user_ids
