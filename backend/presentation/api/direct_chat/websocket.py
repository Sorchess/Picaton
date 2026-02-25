"""WebSocket endpoint для прямых сообщений в реальном времени."""

import asyncio
import html
import json
import logging
import time
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt as jose_jwt
from jose.exceptions import ExpiredSignatureError, JWTError

from application.services.direct_chat import DirectChatService
from application.services.privacy_checker import PrivacyChecker
from infrastructure.dependencies import (
    get_direct_chat_service,
    get_user_service,
)
from settings.config import settings


logger = logging.getLogger(__name__)


router = APIRouter(tags=["websocket"])


class DMConnectionManager:
    """Менеджер WebSocket соединений для прямых сообщений.

    Каждый пользователь подключается один раз и получает обновления
    по всем своим диалогам.
    """

    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: dict[UUID, set[WebSocket]] = {}
        self.typing_users: dict[UUID, set[UUID]] = {}  # conversation_id -> typing users
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)

    async def disconnect(self, websocket: WebSocket, user_id: UUID):
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

    async def send_to_user(self, user_id: UUID, message: dict):
        """Отправить сообщение конкретному пользователю."""
        if user_id not in self.active_connections:
            return
        disconnected = []
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        for ws in disconnected:
            self.active_connections[user_id].discard(ws)

    def is_online(self, user_id: UUID) -> bool:
        return user_id in self.active_connections and bool(
            self.active_connections[user_id]
        )

    async def set_typing(self, conversation_id: UUID, user_id: UUID, is_typing: bool):
        async with self._lock:
            if conversation_id not in self.typing_users:
                self.typing_users[conversation_id] = set()
            if is_typing:
                self.typing_users[conversation_id].add(user_id)
            else:
                self.typing_users[conversation_id].discard(user_id)


dm_manager = DMConnectionManager()


# Rate limiter: tracks last message timestamps per user
_dm_rate_limit_state: dict[UUID, list[float]] = {}
DM_RATE_LIMIT_MAX_MESSAGES = 30  # max messages per window
DM_RATE_LIMIT_WINDOW_SECONDS = 60  # window size in seconds


def _check_dm_rate_limit(user_id: UUID) -> bool:
    """Check if user exceeded rate limit. Returns True if allowed."""
    now = time.monotonic()
    timestamps = _dm_rate_limit_state.get(user_id, [])
    timestamps = [t for t in timestamps if now - t < DM_RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= DM_RATE_LIMIT_MAX_MESSAGES:
        _dm_rate_limit_state[user_id] = timestamps
        return False
    timestamps.append(now)
    _dm_rate_limit_state[user_id] = timestamps
    return True


def sanitize_message_content(content: str) -> str:
    """Sanitize message content to prevent XSS attacks."""
    return html.escape(content, quote=True)


async def get_user_from_token(token: str) -> UUID | None:
    """Получить user_id из JWT токена с полноценной проверкой."""
    try:
        payload = jose_jwt.decode(
            token,
            settings.jwt.secret_key,
            algorithms=[settings.jwt.algorithm],
        )
        user_id = payload.get("sub")
        if user_id:
            return UUID(user_id)
    except ExpiredSignatureError:
        logger.warning("DM WebSocket auth: expired token")
    except (JWTError, ValueError, TypeError) as e:
        logger.warning(f"DM WebSocket auth: invalid token — {e}")
    return None


@router.websocket("/ws/dm")
async def dm_websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket для прямых сообщений.

    Пользователь подключается один раз и получает все обновления:
    - new_message — новое сообщение
    - typing — индикатор набора текста
    - message_edited — сообщение отредактировано
    - message_deleted — сообщение удалено
    - read_receipt — сообщения прочитаны
    """
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    from infrastructure.database.client import mongodb_client  # noqa
    from infrastructure.database.repositories.conversation import (
        MongoConversationRepository,
    )
    from infrastructure.database.repositories.direct_message import (
        MongoDirectMessageRepository,
    )
    from infrastructure.database.repositories.saved_contact import (
        MongoSavedContactRepository,
    )
    from infrastructure.database.repositories.company import (
        MongoCompanyMemberRepository,
    )
    from infrastructure.database.repositories.user import MongoUserRepository

    db = mongodb_client.database
    conv_repo = MongoConversationRepository(db["conversations"])
    msg_repo = MongoDirectMessageRepository(db["direct_messages"])
    user_repo = MongoUserRepository(db["users"])
    contact_repo = MongoSavedContactRepository(db["saved_contacts"])
    member_repo = MongoCompanyMemberRepository(db["company_members"])

    from application.services.user import UserService
    from application.services.direct_chat import DirectChatService
    from application.services.ai_bio import AIBioGeneratorService
    from application.services.llm_bio import AIBioGenerator
    from application.services.ai_tags import AITagsGeneratorService, MockAITagsGenerator

    dm_service = DirectChatService(conv_repo, msg_repo)
    privacy_checker = PrivacyChecker(user_repo, contact_repo, member_repo)
    user_service = UserService(
        user_repo,
        AIBioGeneratorService(AIBioGenerator()),
        AITagsGeneratorService(MockAITagsGenerator()),
    )

    await dm_manager.connect(websocket, user_id)

    try:
        # Получить данные пользователя
        try:
            user = await user_service.get_user(user_id)
            user_name = f"{user.first_name} {user.last_name}".strip()
        except Exception:
            user_name = "User"

        while True:
            try:
                data = await websocket.receive_json()
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            if msg_type == "send_message":
                # Rate limiting
                if not _check_dm_rate_limit(user_id):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Rate limit exceeded. Please slow down.",
                            "code": "rate_limit",
                        }
                    )
                    continue

                conversation_id = data.get("conversation_id")
                content = sanitize_message_content(data.get("content", "").strip())
                reply_to_id = data.get("reply_to_id")

                if not conversation_id or not content:
                    continue

                try:
                    conv_uuid = UUID(conversation_id)
                    reply_uuid = UUID(reply_to_id) if reply_to_id else None
                    conv = await dm_service.get_conversation(conv_uuid, user_id)
                    other_id = conv.get_other_participant(user_id)
                    if not await privacy_checker.can_message(user_id, other_id):
                        await websocket.send_json(
                            {
                                "type": "error",
                                "message": (
                                    "Recipient's privacy settings do not allow "
                                    "messages from you"
                                ),
                                "code": "dm_privacy_restricted",
                            }
                        )
                        continue

                    message = await dm_service.send_message(
                        conversation_id=conv_uuid,
                        sender_id=user_id,
                        content=content,
                        reply_to_id=reply_uuid,
                    )

                    msg_data = {
                        "type": "new_message",
                        "message": {
                            "id": str(message.id),
                            "conversation_id": str(message.conversation_id),
                            "sender_id": str(message.sender_id),
                            "sender_name": user_name,
                            "content": message.content,
                            "reply_to_id": (
                                str(message.reply_to_id)
                                if message.reply_to_id
                                else None
                            ),
                            "forwarded_from_user_id": (
                                str(message.forwarded_from_user_id)
                                if message.forwarded_from_user_id
                                else None
                            ),
                            "forwarded_from_name": message.forwarded_from_name,
                            "is_read": False,
                            "created_at": message.created_at.isoformat(),
                        },
                    }

                    # Отправить обоим участникам
                    await dm_manager.send_to_user(user_id, msg_data)
                    await dm_manager.send_to_user(other_id, msg_data)

                except Exception as e:
                    logger.error(f"DM send_message error: {e}", exc_info=True)
                    await websocket.send_json(
                        {"type": "error", "message": "Failed to send message"}
                    )

            elif msg_type == "typing":
                conversation_id = data.get("conversation_id")
                is_typing = data.get("is_typing", False)

                if not conversation_id:
                    continue

                try:
                    conv_uuid = UUID(conversation_id)
                    await dm_manager.set_typing(conv_uuid, user_id, is_typing)

                    conv = await dm_service.get_conversation(conv_uuid, user_id)
                    other_id = conv.get_other_participant(user_id)

                    await dm_manager.send_to_user(
                        other_id,
                        {
                            "type": "typing",
                            "conversation_id": conversation_id,
                            "user_id": str(user_id),
                            "user_name": user_name,
                            "is_typing": is_typing,
                        },
                    )
                except Exception:
                    pass

            elif msg_type == "edit_message":
                message_id = data.get("message_id")
                content = sanitize_message_content(data.get("content", "").strip())
                conversation_id = data.get("conversation_id")

                if not message_id or not content:
                    continue

                try:
                    message = await dm_service.edit_message(
                        message_id=UUID(message_id),
                        user_id=user_id,
                        new_content=content,
                    )

                    conv = await dm_service.get_conversation(
                        UUID(conversation_id), user_id
                    )
                    other_id = conv.get_other_participant(user_id)

                    edit_data = {
                        "type": "message_edited",
                        "message_id": str(message.id),
                        "conversation_id": conversation_id,
                        "content": message.content,
                        "edited_at": (
                            message.edited_at.isoformat() if message.edited_at else None
                        ),
                    }
                    await dm_manager.send_to_user(user_id, edit_data)
                    await dm_manager.send_to_user(other_id, edit_data)

                except Exception as e:
                    logger.error(f"DM edit_message error: {e}", exc_info=True)
                    await websocket.send_json(
                        {"type": "error", "message": "Failed to edit message"}
                    )

            elif msg_type == "delete_message":
                message_id = data.get("message_id")
                conversation_id = data.get("conversation_id")
                for_me = bool(data.get("for_me", False))

                if not message_id:
                    continue

                try:
                    await dm_service.delete_message(
                        message_id=UUID(message_id), user_id=user_id, for_me=for_me
                    )

                    if for_me:
                        await dm_manager.send_to_user(
                            user_id,
                            {
                                "type": "message_hidden_for_user",
                                "message_id": message_id,
                                "conversation_id": conversation_id,
                            },
                        )
                    else:
                        conv = await dm_service.get_conversation(
                            UUID(conversation_id), user_id
                        )
                        other_id = conv.get_other_participant(user_id)

                        delete_data = {
                            "type": "message_deleted",
                            "message_id": message_id,
                            "conversation_id": conversation_id,
                        }
                        await dm_manager.send_to_user(user_id, delete_data)
                        await dm_manager.send_to_user(other_id, delete_data)

                except Exception as e:
                    logger.error(f"DM delete_message error: {e}", exc_info=True)
                    await websocket.send_json(
                        {"type": "error", "message": "Failed to delete message"}
                    )

            elif msg_type == "forward_message":
                source_message_id = data.get("source_message_id")
                conversation_id = data.get("conversation_id")

                if not source_message_id or not conversation_id:
                    continue

                try:
                    source_message = await msg_repo.get_by_id(UUID(source_message_id))
                    if not source_message or source_message.is_deleted:
                        continue

                    conv = await dm_service.get_conversation(
                        UUID(conversation_id), user_id
                    )
                    other_id = conv.get_other_participant(user_id)
                    if not await privacy_checker.can_message(user_id, other_id):
                        await websocket.send_json(
                            {
                                "type": "error",
                                "message": (
                                    "Recipient's privacy settings do not allow "
                                    "messages from you"
                                ),
                                "code": "dm_privacy_restricted",
                            }
                        )
                        continue

                    forwarded_from_name = user_name
                    if source_message.sender_id != user_id:
                        try:
                            source_sender = await user_service.get_user(
                                source_message.sender_id
                            )
                            forwarded_from_name = (
                                f"{source_sender.first_name} {source_sender.last_name}"
                            ).strip()
                        except Exception:
                            forwarded_from_name = "Unknown"

                    message = await dm_service.send_message(
                        conversation_id=UUID(conversation_id),
                        sender_id=user_id,
                        content=source_message.content,
                        forwarded_from_user_id=source_message.sender_id,
                        forwarded_from_name=forwarded_from_name,
                    )

                    msg_data = {
                        "type": "new_message",
                        "message": {
                            "id": str(message.id),
                            "conversation_id": str(message.conversation_id),
                            "sender_id": str(message.sender_id),
                            "sender_name": user_name,
                            "content": message.content,
                            "reply_to_id": (
                                str(message.reply_to_id)
                                if message.reply_to_id
                                else None
                            ),
                            "forwarded_from_user_id": (
                                str(message.forwarded_from_user_id)
                                if message.forwarded_from_user_id
                                else None
                            ),
                            "forwarded_from_name": message.forwarded_from_name,
                            "is_read": False,
                            "created_at": message.created_at.isoformat(),
                        },
                    }
                    await dm_manager.send_to_user(user_id, msg_data)
                    await dm_manager.send_to_user(other_id, msg_data)
                except Exception as e:
                    logger.error(f"DM forward_message error: {e}", exc_info=True)
                    await websocket.send_json(
                        {"type": "error", "message": "Failed to forward message"}
                    )

            elif msg_type == "mark_read":
                conversation_id = data.get("conversation_id")
                if not conversation_id:
                    continue

                try:
                    conv_uuid = UUID(conversation_id)
                    await dm_service.mark_as_read(conv_uuid, user_id)

                    conv = await dm_service.get_conversation(conv_uuid, user_id)
                    other_id = conv.get_other_participant(user_id)

                    read_data = {
                        "type": "read_receipt",
                        "conversation_id": conversation_id,
                        "user_id": str(user_id),
                        "read_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await dm_manager.send_to_user(other_id, read_data)

                except Exception:
                    pass

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        await dm_manager.disconnect(websocket, user_id)
