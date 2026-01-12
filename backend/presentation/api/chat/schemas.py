"""Pydantic schemas для API чата."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ============ Request Schemas ============


class SendMessageRequest(BaseModel):
    """Запрос на отправку сообщения."""

    content: str = Field(..., min_length=1, max_length=10000)
    reply_to_id: UUID | None = None


class EditMessageRequest(BaseModel):
    """Запрос на редактирование сообщения."""

    content: str = Field(..., min_length=1, max_length=10000)


class GetMessagesRequest(BaseModel):
    """Параметры запроса сообщений."""

    limit: int = Field(default=50, ge=1, le=100)
    before: datetime | None = None
    after: datetime | None = None


# ============ Response Schemas ============


class MessageAuthorResponse(BaseModel):
    """Информация об авторе сообщения."""

    id: UUID
    first_name: str
    last_name: str
    avatar_url: str | None = None


class ChatMessageResponse(BaseModel):
    """Ответ с данными сообщения."""

    id: UUID
    project_id: UUID
    author_id: UUID | None = None
    author: MessageAuthorResponse | None = None
    content: str
    message_type: str
    file_url: str | None = None
    file_name: str | None = None
    reply_to_id: UUID | None = None
    is_edited: bool = False
    edited_at: datetime | None = None
    is_deleted: bool = False
    created_at: datetime
    is_read: bool = False  # Прочитано ли текущим пользователем

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    """Список сообщений."""

    messages: list[ChatMessageResponse]
    has_more: bool = False


class UnreadCountResponse(BaseModel):
    """Количество непрочитанных сообщений."""

    project_id: UUID
    count: int


class UnreadCountsResponse(BaseModel):
    """Количество непрочитанных по всем проектам."""

    counts: dict[str, int]  # project_id -> count
    total: int


class MarkAsReadResponse(BaseModel):
    """Ответ на отметку прочитанных."""

    marked_count: int


# ============ WebSocket Schemas ============


class WSMessageBase(BaseModel):
    """Базовая схема WebSocket сообщения."""

    type: str


class WSNewMessage(WSMessageBase):
    """Новое сообщение в чате."""

    type: str = "new_message"
    message: ChatMessageResponse


class WSMessageEdited(WSMessageBase):
    """Сообщение отредактировано."""

    type: str = "message_edited"
    message_id: UUID
    content: str
    edited_at: datetime


class WSMessageDeleted(WSMessageBase):
    """Сообщение удалено."""

    type: str = "message_deleted"
    message_id: UUID


class WSTyping(WSMessageBase):
    """Пользователь печатает."""

    type: str = "typing"
    user_id: UUID
    user_name: str


class WSUserJoined(WSMessageBase):
    """Пользователь вошёл в чат."""

    type: str = "user_joined"
    user_id: UUID
    user_name: str


class WSUserLeft(WSMessageBase):
    """Пользователь вышел из чата."""

    type: str = "user_left"
    user_id: UUID


class WSTypingIndicator(WSMessageBase):
    """Индикатор набора текста."""

    type: str = "typing_indicator"
    user_id: UUID
    user_name: str
    is_typing: bool = True


class WSReadReceipt(WSMessageBase):
    """Уведомление о прочтении сообщений."""

    type: str = "read_receipt"
    user_id: UUID
    last_read_at: datetime
