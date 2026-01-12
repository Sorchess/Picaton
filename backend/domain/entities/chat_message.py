"""Доменная сущность сообщения в чате проекта."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.enums.project import MessageType


MAX_MESSAGE_LENGTH = 10000


class InvalidMessageError(ValueError):
    """Невалидное сообщение."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Invalid message: {reason}")


@dataclass
class ChatMessage(Entity):
    """
    Доменная сущность сообщения в чате.
    Сообщения привязаны к проекту.
    """

    # Связи
    project_id: UUID = field(default=None)
    author_id: UUID = field(default=None)

    # Содержимое
    content: str = field(default="")
    message_type: MessageType = field(default=MessageType.TEXT)

    # Для файлов/изображений
    file_url: str | None = field(default=None)
    file_name: str | None = field(default=None)
    file_size: int | None = field(default=None)

    # Reply (ответ на сообщение)
    reply_to_id: UUID | None = field(default=None)

    # Прочитано ли (список user_id кто прочитал)
    read_by: list[UUID] = field(default_factory=list)

    # Редактирование
    is_edited: bool = field(default=False)
    edited_at: datetime | None = field(default=None)

    # Удаление (soft delete)
    is_deleted: bool = field(default=False)
    deleted_at: datetime | None = field(default=None)

    # Timestamp
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        """Валидация данных при создании."""
        if self.content and self.message_type == MessageType.TEXT:
            self._validate_content(self.content)

    @staticmethod
    def _validate_content(content: str) -> None:
        """Валидация содержимого сообщения."""
        if len(content) > MAX_MESSAGE_LENGTH:
            raise InvalidMessageError(
                f"Message must not exceed {MAX_MESSAGE_LENGTH} characters"
            )

    def edit(self, new_content: str) -> None:
        """Редактировать сообщение."""
        if self.message_type != MessageType.TEXT:
            raise InvalidMessageError("Only text messages can be edited")
        self._validate_content(new_content)
        self.content = new_content
        self.is_edited = True
        self.edited_at = datetime.now(timezone.utc)

    def mark_as_read(self, user_id: UUID) -> None:
        """Отметить как прочитанное пользователем."""
        if user_id not in self.read_by:
            self.read_by.append(user_id)

    def soft_delete(self) -> None:
        """Мягкое удаление сообщения."""
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.content = ""  # Очищаем содержимое

    @property
    def is_system_message(self) -> bool:
        """Является ли системным сообщением."""
        return self.message_type == MessageType.SYSTEM

    @property
    def is_file_message(self) -> bool:
        """Является ли сообщением с файлом."""
        return self.message_type in (MessageType.FILE, MessageType.IMAGE)

    @classmethod
    def create_system_message(
        cls,
        project_id: UUID,
        content: str,
    ) -> "ChatMessage":
        """Создать системное сообщение."""
        return cls(
            project_id=project_id,
            author_id=None,
            content=content,
            message_type=MessageType.SYSTEM,
        )

    @classmethod
    def create_join_message(cls, project_id: UUID, user_name: str) -> "ChatMessage":
        """Создать сообщение о вступлении в проект."""
        return cls.create_system_message(
            project_id=project_id,
            content=f"{user_name} присоединился к проекту",
        )

    @classmethod
    def create_leave_message(cls, project_id: UUID, user_name: str) -> "ChatMessage":
        """Создать сообщение о выходе из проекта."""
        return cls.create_system_message(
            project_id=project_id,
            content=f"{user_name} покинул проект",
        )
