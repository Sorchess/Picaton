"""Сущность временной ссылки для шаринга визитки."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import UUID

from domain.entities.base import Entity


@dataclass(kw_only=True)
class ShareLink(Entity):
    """Ссылка для шаринга визитной карточки с ограниченным сроком действия."""

    # ID визитной карточки
    card_id: UUID

    # Уникальный токен ссылки
    token: str

    # Когда создана ссылка
    created_at: datetime = field(default_factory=datetime.utcnow)

    # Когда истекает ссылка (None = бессрочная)
    expires_at: Optional[datetime] = None

    # Активна ли ссылка
    is_active: bool = True

    # Количество просмотров
    views_count: int = 0

    @property
    def is_expired(self) -> bool:
        """Проверить, истекла ли ссылка."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Проверить, действительна ли ссылка."""
        return self.is_active and not self.is_expired
