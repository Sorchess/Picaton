"""API handlers для чата."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from application.services.chat import (
    ChatService,
    ChatAccessDeniedError,
    MessageNotFoundError,
)
from infrastructure.dependencies import (
    get_chat_service,
    get_user_service,
    get_current_user_id,
)
from presentation.api.chat.schemas import (
    SendMessageRequest,
    EditMessageRequest,
    ChatMessageResponse,
    MessageListResponse,
    MessageAuthorResponse,
    UnreadCountResponse,
    UnreadCountsResponse,
    MarkAsReadResponse,
)


router = APIRouter(prefix="/projects/{project_id}/chat", tags=["chat"])


def _message_to_response(message, author=None, user_id=None) -> ChatMessageResponse:
    """Преобразовать сущность сообщения в response."""
    author_response = None
    if author:
        author_response = MessageAuthorResponse(
            id=author.id,
            first_name=author.first_name,
            last_name=author.last_name,
            avatar_url=author.avatar_url,
        )

    is_read = user_id in message.read_by if user_id else False

    return ChatMessageResponse(
        id=message.id,
        project_id=message.project_id,
        author_id=message.author_id,
        author=author_response,
        content=message.content,
        message_type=message.message_type.value,
        file_url=message.file_url,
        file_name=message.file_name,
        reply_to_id=message.reply_to_id,
        is_edited=message.is_edited,
        edited_at=message.edited_at,
        is_deleted=message.is_deleted,
        created_at=message.created_at,
        is_read=is_read,
    )


@router.get("/messages", response_model=MessageListResponse)
async def get_messages(
    project_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    before: datetime | None = None,
    after: datetime | None = None,
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
    user_service=Depends(get_user_service),
):
    """Получить сообщения чата проекта."""
    try:
        messages = await chat_service.get_messages(
            project_id=project_id,
            user_id=current_user_id,
            limit=limit + 1,  # +1 для проверки has_more
            before=before,
            after=after,
        )
    except ChatAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    # Получаем информацию об авторах
    responses = []
    authors_cache = {}
    for msg in messages:
        if msg.author_id:
            if msg.author_id not in authors_cache:
                try:
                    authors_cache[msg.author_id] = await user_service.get_user(
                        msg.author_id
                    )
                except Exception:
                    authors_cache[msg.author_id] = None
            author = authors_cache.get(msg.author_id)
            responses.append(_message_to_response(msg, author, current_user_id))
        else:
            responses.append(_message_to_response(msg, user_id=current_user_id))

    return MessageListResponse(messages=responses, has_more=has_more)


@router.post(
    "/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED
)
async def send_message(
    project_id: UUID,
    data: SendMessageRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
    user_service=Depends(get_user_service),
):
    """Отправить сообщение в чат."""
    try:
        message = await chat_service.send_message(
            project_id=project_id,
            author_id=current_user_id,
            content=data.content,
            reply_to_id=data.reply_to_id,
        )
    except ChatAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    try:
        author = await user_service.get_user(current_user_id)
        return _message_to_response(message, author, current_user_id)
    except Exception:
        return _message_to_response(message, user_id=current_user_id)


@router.put("/messages/{message_id}", response_model=ChatMessageResponse)
async def edit_message(
    project_id: UUID,
    message_id: UUID,
    data: EditMessageRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Редактировать сообщение."""
    try:
        message = await chat_service.edit_message(
            message_id=message_id,
            user_id=current_user_id,
            new_content=data.content,
        )
    except MessageNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )
    except ChatAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return _message_to_response(message, user_id=current_user_id)


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    project_id: UUID,
    message_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Удалить сообщение."""
    try:
        await chat_service.delete_message(
            message_id=message_id,
            user_id=current_user_id,
        )
    except MessageNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )
    except ChatAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )


@router.post("/read", response_model=MarkAsReadResponse)
async def mark_as_read(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Отметить все сообщения как прочитанные."""
    try:
        count = await chat_service.mark_as_read(
            project_id=project_id,
            user_id=current_user_id,
        )
    except ChatAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return MarkAsReadResponse(marked_count=count)


@router.get("/unread", response_model=UnreadCountResponse)
async def get_unread_count(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Получить количество непрочитанных сообщений."""
    count = await chat_service.get_unread_count(project_id, current_user_id)
    return UnreadCountResponse(project_id=project_id, count=count)


@router.get("/search", response_model=MessageListResponse)
async def search_messages(
    project_id: UUID,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
    user_service=Depends(get_user_service),
):
    """Поиск сообщений в чате."""
    try:
        messages = await chat_service.search_messages(
            project_id=project_id,
            user_id=current_user_id,
            query=q,
            limit=limit,
        )
    except ChatAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Получаем информацию об авторах
    responses = []
    authors_cache = {}
    for msg in messages:
        if msg.author_id:
            if msg.author_id not in authors_cache:
                try:
                    authors_cache[msg.author_id] = await user_service.get_user(
                        msg.author_id
                    )
                except Exception:
                    authors_cache[msg.author_id] = None
            author = authors_cache.get(msg.author_id)
            responses.append(_message_to_response(msg, author, current_user_id))
        else:
            responses.append(_message_to_response(msg, user_id=current_user_id))

    return MessageListResponse(messages=responses, has_more=False)


# Общий endpoint для получения непрочитанных по всем проектам
chat_global_router = APIRouter(prefix="/chat", tags=["chat"])


@chat_global_router.get("/unread", response_model=UnreadCountsResponse)
async def get_all_unread_counts(
    current_user_id: UUID = Depends(get_current_user_id),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Получить количество непрочитанных сообщений по всем проектам."""
    counts = await chat_service.get_unread_counts(current_user_id)
    total = sum(counts.values())

    return UnreadCountsResponse(
        counts={str(k): v for k, v in counts.items()},
        total=total,
    )
