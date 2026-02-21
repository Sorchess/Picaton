"""Pydantic schemas для API прямых сообщений."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ============ Request Schemas ============


class SendDMRequest(BaseModel):
    """Запрос на отправку прямого сообщения."""

    content: str = Field(..., min_length=1, max_length=10000)
    reply_to_id: UUID | None = None


class StartConversationRequest(BaseModel):
    """Запрос на начало диалога с пользователем."""

    recipient_id: UUID
    content: str | None = Field(default=None, max_length=10000)


class EditDMRequest(BaseModel):
    """Запрос на редактирование сообщения."""

    content: str = Field(..., min_length=1, max_length=10000)


# ============ Response Schemas ============


class DMAuthorResponse(BaseModel):
    """Информация об участнике диалога."""

    id: UUID
    first_name: str
    last_name: str
    avatar_url: str | None = None


class DirectMessageResponse(BaseModel):
    """Ответ с данными прямого сообщения."""

    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender: DMAuthorResponse | None = None
    content: str
    is_read: bool = False
    is_edited: bool = False
    edited_at: datetime | None = None
    is_deleted: bool = False
    reply_to_id: UUID | None = None
    forwarded_from_user_id: UUID | None = None
    forwarded_from_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Ответ с данными диалога."""

    id: UUID
    participant: DMAuthorResponse
    last_message_content: str | None = None
    last_message_sender_id: UUID | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0
    can_send_messages: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    """Список диалогов."""

    conversations: list[ConversationResponse]


class DMListResponse(BaseModel):
    """Список сообщений."""

    messages: list[DirectMessageResponse]
    has_more: bool = False


class DMUnreadResponse(BaseModel):
    """Количество непрочитанных сообщений."""

    total: int
    counts: dict[str, int] = {}


class DMMarkAsReadResponse(BaseModel):
    """Ответ на отметку прочитанных."""

    marked_count: int


class StartConversationResponse(BaseModel):
    """Ответ на создание диалога."""

    conversation: ConversationResponse
    message: DirectMessageResponse
