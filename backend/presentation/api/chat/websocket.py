"""WebSocket endpoint для чата в реальном времени."""

import asyncio
import html
import json
import logging
import time
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError

from application.services.chat import ChatService
from application.services.project import ProjectService
from infrastructure.dependencies import (
    get_chat_service,
    get_project_service,
    get_user_service,
)
from presentation.api.chat.schemas import (
    WSNewMessage,
    WSTypingIndicator,
    WSMessageEdited,
    WSMessageDeleted,
    WSUserJoined,
    WSUserLeft,
    WSReadReceipt,
)
from settings.config import settings


logger = logging.getLogger(__name__)


router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Менеджер WebSocket соединений."""

    def __init__(self):
        # project_id -> set of (user_id, websocket)
        self.active_connections: dict[UUID, set[tuple[UUID, WebSocket]]] = {}
        # Для отслеживания typing индикаторов
        self.typing_users: dict[UUID, set[UUID]] = {}  # project_id -> set of user_ids
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, project_id: UUID, user_id: UUID):
        """Подключить пользователя к чату проекта."""
        await websocket.accept()
        async with self._lock:
            if project_id not in self.active_connections:
                self.active_connections[project_id] = set()
            self.active_connections[project_id].add((user_id, websocket))

    async def disconnect(self, websocket: WebSocket, project_id: UUID, user_id: UUID):
        """Отключить пользователя от чата проекта."""
        async with self._lock:
            if project_id in self.active_connections:
                self.active_connections[project_id].discard((user_id, websocket))
                if not self.active_connections[project_id]:
                    del self.active_connections[project_id]

            # Удаляем typing индикатор
            if project_id in self.typing_users:
                self.typing_users[project_id].discard(user_id)

    async def broadcast_to_project(
        self,
        project_id: UUID,
        message: dict,
        exclude_user_id: UUID | None = None,
    ):
        """Отправить сообщение всем участникам проекта."""
        if project_id not in self.active_connections:
            return

        disconnected = []
        for user_id, websocket in self.active_connections[project_id]:
            if exclude_user_id and user_id == exclude_user_id:
                continue
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append((user_id, websocket))

        # Удаляем отключенные соединения
        for conn in disconnected:
            self.active_connections[project_id].discard(conn)

    async def send_to_user(
        self,
        project_id: UUID,
        user_id: UUID,
        message: dict,
    ):
        """Отправить сообщение конкретному пользователю."""
        if project_id not in self.active_connections:
            return

        for uid, websocket in self.active_connections[project_id]:
            if uid == user_id:
                try:
                    await websocket.send_json(message)
                except Exception:
                    pass

    def get_online_users(self, project_id: UUID) -> list[UUID]:
        """Получить список онлайн пользователей в проекте."""
        if project_id not in self.active_connections:
            return []
        return list({uid for uid, _ in self.active_connections[project_id]})

    async def set_typing(self, project_id: UUID, user_id: UUID, is_typing: bool):
        """Установить статус typing для пользователя."""
        async with self._lock:
            if project_id not in self.typing_users:
                self.typing_users[project_id] = set()

            if is_typing:
                self.typing_users[project_id].add(user_id)
            else:
                self.typing_users[project_id].discard(user_id)


manager = ConnectionManager()


# Rate limiter: tracks last message timestamps per user
_rate_limit_state: dict[UUID, list[float]] = {}
RATE_LIMIT_MAX_MESSAGES = 30  # max messages per window
RATE_LIMIT_WINDOW_SECONDS = 60  # window size in seconds


def _check_rate_limit(user_id: UUID) -> bool:
    """Check if user exceeded rate limit. Returns True if allowed."""
    now = time.monotonic()
    timestamps = _rate_limit_state.get(user_id, [])
    # Remove timestamps outside the window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_MESSAGES:
        _rate_limit_state[user_id] = timestamps
        return False
    timestamps.append(now)
    _rate_limit_state[user_id] = timestamps
    return True


def sanitize_message_content(content: str) -> str:
    """Sanitize message content to prevent XSS attacks."""
    return html.escape(content, quote=True)


async def get_user_from_token(token: str) -> UUID | None:
    """Получить user_id из JWT токена с полноценной проверкой."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt.secret_key,
            algorithms=[settings.jwt.algorithm],
        )
        user_id = payload.get("sub")
        if user_id:
            return UUID(user_id)
    except ExpiredSignatureError:
        logger.warning("WebSocket auth: expired token")
    except (JWTError, ValueError, TypeError) as e:
        logger.warning(f"WebSocket auth: invalid token — {e}")
    return None


@router.websocket("/ws/chat/{project_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: UUID,
    token: str = Query(...),
):
    """WebSocket endpoint для чата проекта."""
    # Аутентификация
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Получаем сервисы через DI
    # Примечание: в реальном приложении нужно использовать get_db и т.д.
    project_service: ProjectService = await get_project_service()
    chat_service: ChatService = await get_chat_service()
    user_service = await get_user_service()

    # Проверяем доступ к проекту
    try:
        is_member = await project_service.is_member(project_id, user_id)
        if not is_member:
            await websocket.close(code=4003, reason="Access denied")
            return
    except Exception:
        await websocket.close(code=4003, reason="Access denied")
        return

    # Подключаем пользователя
    await manager.connect(websocket, project_id, user_id)

    try:
        # Получаем информацию о пользователе для уведомлений
        try:
            user = await user_service.get_user(user_id)
            user_name = f"{user.first_name} {user.last_name}".strip()
            user_avatar = user.avatar_url
        except Exception:
            user_name = "User"
            user_avatar = None

        # Отправляем уведомление о подключении
        online_users = manager.get_online_users(project_id)
        await manager.broadcast_to_project(
            project_id,
            WSUserJoined(
                type="user_joined",
                user_id=str(user_id),
                user_name=user_name,
                online_users=[str(uid) for uid in online_users],
            ).model_dump(),
            exclude_user_id=user_id,
        )

        # Основной цикл обработки сообщений
        while True:
            try:
                data = await websocket.receive_json()
            except json.JSONDecodeError:
                continue

            message_type = data.get("type")

            if message_type == "send_message":
                # Rate limiting
                if not _check_rate_limit(user_id):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Rate limit exceeded. Please slow down.",
                            "code": "rate_limit",
                        }
                    )
                    continue

                # Отправка сообщения
                content = sanitize_message_content(data.get("content", "").strip())
                reply_to_id = data.get("reply_to_id")

                if not content:
                    continue

                try:
                    reply_uuid = UUID(reply_to_id) if reply_to_id else None
                except ValueError:
                    reply_uuid = None

                try:
                    message = await chat_service.send_message(
                        project_id=project_id,
                        author_id=user_id,
                        content=content,
                        reply_to_id=reply_uuid,
                    )

                    # Рассылаем всем участникам
                    await manager.broadcast_to_project(
                        project_id,
                        WSNewMessage(
                            type="new_message",
                            message=dict(
                                id=str(message.id),
                                project_id=str(message.project_id),
                                author_id=str(message.author_id),
                                author_name=user_name,
                                author_avatar=user_avatar,
                                content=message.content,
                                message_type=message.message_type.value,
                                reply_to_id=(
                                    str(message.reply_to_id)
                                    if message.reply_to_id
                                    else None
                                ),
                                created_at=message.created_at.isoformat(),
                            ),
                        ).model_dump(),
                    )
                except Exception as e:
                    logger.error(f"Chat send_message error: {e}", exc_info=True)
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Failed to send message",
                        }
                    )

            elif message_type == "typing":
                # Индикатор набора текста
                is_typing = data.get("is_typing", False)
                await manager.set_typing(project_id, user_id, is_typing)

                await manager.broadcast_to_project(
                    project_id,
                    WSTypingIndicator(
                        type="typing",
                        user_id=str(user_id),
                        user_name=user_name,
                        is_typing=is_typing,
                    ).model_dump(),
                    exclude_user_id=user_id,
                )

            elif message_type == "edit_message":
                # Редактирование сообщения
                message_id = data.get("message_id")
                new_content = sanitize_message_content(data.get("content", "").strip())

                if not message_id or not new_content:
                    continue

                try:
                    message = await chat_service.edit_message(
                        message_id=UUID(message_id),
                        user_id=user_id,
                        new_content=new_content,
                    )

                    await manager.broadcast_to_project(
                        project_id,
                        WSMessageEdited(
                            type="message_edited",
                            message_id=str(message.id),
                            new_content=message.content,
                            edited_at=(
                                message.edited_at.isoformat()
                                if message.edited_at
                                else None
                            ),
                        ).model_dump(),
                    )
                except Exception as e:
                    logger.error(f"Chat edit_message error: {e}", exc_info=True)
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Failed to edit message",
                        }
                    )

            elif message_type == "delete_message":
                # Удаление сообщения
                message_id = data.get("message_id")

                if not message_id:
                    continue

                try:
                    await chat_service.delete_message(
                        message_id=UUID(message_id),
                        user_id=user_id,
                    )

                    await manager.broadcast_to_project(
                        project_id,
                        WSMessageDeleted(
                            type="message_deleted",
                            message_id=message_id,
                        ).model_dump(),
                    )
                except Exception as e:
                    logger.error(f"Chat delete_message error: {e}", exc_info=True)
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Failed to delete message",
                        }
                    )

            elif message_type == "mark_read":
                # Отметить сообщения как прочитанные
                await chat_service.mark_as_read(project_id, user_id)

                await manager.broadcast_to_project(
                    project_id,
                    WSReadReceipt(
                        type="read_receipt",
                        user_id=str(user_id),
                        project_id=str(project_id),
                        read_at=datetime.utcnow().isoformat(),
                    ).model_dump(),
                    exclude_user_id=user_id,
                )

            elif message_type == "ping":
                # Keep-alive пинг
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        # Отключаем пользователя
        await manager.disconnect(websocket, project_id, user_id)

        # Отправляем уведомление об отключении
        online_users = manager.get_online_users(project_id)
        await manager.broadcast_to_project(
            project_id,
            WSUserLeft(
                type="user_left",
                user_id=str(user_id),
                user_name=user_name if "user_name" in dir() else "User",
                online_users=[str(uid) for uid in online_users],
            ).model_dump(),
        )


# Дополнительный endpoint для получения онлайн пользователей
@router.get("/projects/{project_id}/chat/online")
async def get_online_users(project_id: UUID):
    """Получить список онлайн пользователей в чате проекта."""
    online = manager.get_online_users(project_id)
    return {"online_users": [str(uid) for uid in online]}
