"""Доменная сущность свайпа на идею."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.enums.idea import SwipeDirection


@dataclass
class IdeaSwipe(Entity):
    """
    Доменная сущность свайпа.
    Представляет реакцию пользователя на идею (like/dislike/super_like).
    """

    # Кто свайпнул
    user_id: UUID = field(default=None)

    # Какую идею
    idea_id: UUID = field(default=None)

    # Направление свайпа
    direction: SwipeDirection = field(default=SwipeDirection.LIKE)

    # Timestamp
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_positive(self) -> bool:
        """Положительный ли свайп (like или super_like)."""
        return self.direction in (SwipeDirection.LIKE, SwipeDirection.SUPER_LIKE)

    @property
    def is_super_like(self) -> bool:
        """Является ли свайп super_like."""
        return self.direction == SwipeDirection.SUPER_LIKE
