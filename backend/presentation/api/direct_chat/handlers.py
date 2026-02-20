"""API handlers для прямых сообщений."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from domain.entities.conversation import DirectMessage
from application.services.direct_chat import (
    DirectChatService,
    DMAccessDeniedError,
    DMMessageNotFoundError,
)
from application.services.privacy_checker import PrivacyChecker
from infrastructure.dependencies import (
    get_direct_chat_service,
    get_user_service,
    get_current_user_id,
    get_privacy_checker,
)
from presentation.api.direct_chat.schemas import (
    SendDMRequest,
    StartConversationRequest,
    EditDMRequest,
    DirectMessageResponse,
    DMAuthorResponse,
    ConversationResponse,
    ConversationListResponse,
    DMListResponse,
    DMUnreadResponse,
    DMMarkAsReadResponse,
    StartConversationResponse,
)


router = APIRouter(prefix="/dm", tags=["direct-messages"])


async def _get_user_info(user_service, user_id: UUID) -> DMAuthorResponse | None:
    """Получить информацию о пользователе."""
    try:
        user = await user_service.get_user(user_id)
        return DMAuthorResponse(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            avatar_url=user.avatar_url,
        )
    except Exception:
        return None


def _message_to_response(message, sender=None) -> DirectMessageResponse:
    """Преобразовать сущность в response."""
    sender_response = None
    if sender:
        sender_response = DMAuthorResponse(
            id=sender.id,
            first_name=sender.first_name,
            last_name=sender.last_name,
            avatar_url=sender.avatar_url,
        )

    return DirectMessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender=sender_response,
        content=message.content,
        is_read=message.is_read,
        is_edited=message.is_edited,
        edited_at=message.edited_at,
        is_deleted=message.is_deleted,
        reply_to_id=message.reply_to_id,
        created_at=message.created_at,
    )


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
    user_service=Depends(get_user_service),
):
    """Получить список диалогов текущего пользователя."""
    conversations = await dm_service.get_user_conversations(
        current_user_id, limit=limit, offset=offset
    )

    unread_counts = await dm_service.get_unread_counts(current_user_id)

    responses = []
    user_cache: dict[UUID, DMAuthorResponse | None] = {}

    for conv in conversations:
        other_id = conv.get_other_participant(current_user_id)
        if other_id not in user_cache:
            user_cache[other_id] = await _get_user_info(user_service, other_id)

        participant = user_cache[other_id]
        if not participant:
            participant = DMAuthorResponse(
                id=other_id,
                first_name="Пользователь",
                last_name="",
                avatar_url=None,
            )

        responses.append(
            ConversationResponse(
                id=conv.id,
                participant=participant,
                last_message_content=conv.last_message_content,
                last_message_sender_id=conv.last_message_sender_id,
                last_message_at=conv.last_message_at,
                unread_count=unread_counts.get(conv.id, 0),
                created_at=conv.created_at,
            )
        )

    return ConversationListResponse(conversations=responses)


@router.post(
    "/conversations",
    response_model=StartConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_conversation(
    data: StartConversationRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
    user_service=Depends(get_user_service),
    privacy_checker: PrivacyChecker = Depends(get_privacy_checker),
):
    """Начать новый диалог или отправить сообщение в существующий."""
    if data.recipient_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start conversation with yourself",
        )

    # Проверка приватности: может ли текущий пользователь писать получателю
    can_msg = await privacy_checker.can_message(current_user_id, data.recipient_id)
    if not can_msg:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recipient's privacy settings do not allow messages from you",
        )

    if data.content and data.content.strip():
        conv, message = await dm_service.send_first_message(
            sender_id=current_user_id,
            recipient_id=data.recipient_id,
            content=data.content.strip(),
        )
    else:
        conv = await dm_service.get_or_create_conversation(
            current_user_id, data.recipient_id
        )
        message = DirectMessage(
            conversation_id=conv.id,
            sender_id=current_user_id,
            content="",
        )

    other_id = conv.get_other_participant(current_user_id)
    participant = await _get_user_info(user_service, other_id)
    if not participant:
        participant = DMAuthorResponse(
            id=other_id, first_name="Пользователь", last_name="", avatar_url=None
        )

    sender = await _get_user_info(user_service, current_user_id)

    return StartConversationResponse(
        conversation=ConversationResponse(
            id=conv.id,
            participant=participant,
            last_message_content=conv.last_message_content,
            last_message_sender_id=conv.last_message_sender_id,
            last_message_at=conv.last_message_at,
            unread_count=0,
            created_at=conv.created_at,
        ),
        message=_message_to_response(message, sender),
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=DMListResponse,
)
async def get_messages(
    conversation_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    before: datetime | None = None,
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
    user_service=Depends(get_user_service),
):
    """Получить сообщения диалога."""
    try:
        messages = await dm_service.get_messages(
            conversation_id=conversation_id,
            user_id=current_user_id,
            limit=limit + 1,
            before=before,
        )
    except DMAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    responses = []
    sender_cache: dict[UUID, object | None] = {}

    for msg in messages:
        if msg.sender_id not in sender_cache:
            try:
                sender_cache[msg.sender_id] = await user_service.get_user(msg.sender_id)
            except Exception:
                sender_cache[msg.sender_id] = None
        responses.append(_message_to_response(msg, sender_cache[msg.sender_id]))

    return DMListResponse(messages=responses, has_more=has_more)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=DirectMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: UUID,
    data: SendDMRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
    user_service=Depends(get_user_service),
):
    """Отправить сообщение в диалог."""
    try:
        message = await dm_service.send_message(
            conversation_id=conversation_id,
            sender_id=current_user_id,
            content=data.content,
            reply_to_id=data.reply_to_id,
        )
    except DMAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    try:
        sender = await user_service.get_user(current_user_id)
        return _message_to_response(message, sender)
    except Exception:
        return _message_to_response(message)


@router.put(
    "/conversations/{conversation_id}/messages/{message_id}",
    response_model=DirectMessageResponse,
)
async def edit_message(
    conversation_id: UUID,
    message_id: UUID,
    data: EditDMRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
):
    """Редактировать сообщение."""
    try:
        message = await dm_service.edit_message(
            message_id=message_id,
            user_id=current_user_id,
            new_content=data.content,
        )
    except DMMessageNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )
    except DMAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    return _message_to_response(message)


@router.delete(
    "/conversations/{conversation_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_message(
    conversation_id: UUID,
    message_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
):
    """Удалить сообщение."""
    try:
        await dm_service.delete_message(message_id=message_id, user_id=current_user_id)
    except DMMessageNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )
    except DMAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )


@router.post(
    "/conversations/{conversation_id}/read",
    response_model=DMMarkAsReadResponse,
)
async def mark_as_read(
    conversation_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
):
    """Отметить все сообщения как прочитанные."""
    try:
        count = await dm_service.mark_as_read(conversation_id, current_user_id)
    except DMAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )
    return DMMarkAsReadResponse(marked_count=count)


@router.get("/unread", response_model=DMUnreadResponse)
async def get_unread(
    current_user_id: UUID = Depends(get_current_user_id),
    dm_service: DirectChatService = Depends(get_direct_chat_service),
):
    """Получить количество непрочитанных сообщений."""
    total = await dm_service.get_total_unread(current_user_id)
    counts = await dm_service.get_unread_counts(current_user_id)
    return DMUnreadResponse(
        total=total,
        counts={str(k): v for k, v in counts.items()},
    )
