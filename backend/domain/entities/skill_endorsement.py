"""
Доменная сущность подтверждения навыка (skill endorsement).
Позволяет пользователям подтверждать навыки друг друга.
"""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from domain.entities.base import Entity


@dataclass
class SkillEndorsement(Entity):
    """
    Доменная сущность подтверждения навыка.

    Представляет "лайк" на конкретный навык пользователя.
    Используется для повышения доверия к экспертизе пользователя.
    """

    # Кто поставил лайк
    endorser_id: UUID = field(default=None)

    # Чей навык подтверждаем (ID карточки)
    card_id: UUID = field(default=None)

    # ID тега/навыка который подтверждаем
    tag_id: UUID = field(default=None)

    # Имя тега для удобства
    tag_name: str = field(default="")

    # Категория тега
    tag_category: str | None = field(default=None)

    # Владелец карточки (денормализация для быстрых запросов)
    card_owner_id: UUID = field(default=None)

    # Когда поставлен лайк
    created_at: datetime = field(default_factory=datetime.utcnow)

    # Имя того, кто подтвердил (для отображения)
    endorser_name: str = field(default="")

    # Аватар того, кто подтвердил
    endorser_avatar_url: str | None = field(default=None)
