"""Сущность уведомления."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from domain.entities.base import Entity


@dataclass(kw_only=True)
class Notification(Entity):
    """Уведомление для пользователя."""

    user_id: UUID  # Кому адресовано уведомление
    type: str  # Тип: "contact_added", ...
    title: str  # Заголовок
    message: str  # Текст уведомления
    is_read: bool = False
    # Данные об отправителе (кто вызвал уведомление)
    actor_id: UUID | None = None
    actor_name: str | None = None
    actor_avatar_url: str | None = None
    # Дополнительные данные (зависят от типа)
    data: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
