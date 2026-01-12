"""Доменная сущность комментария к идее."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity


MAX_COMMENT_LENGTH = 1000


@dataclass
class IdeaComment(Entity):
    """
    Комментарий/фидбек к идее.
    Используется для Long Press feedback в свайп-интерфейсе.
    """

    # Связи
    idea_id: UUID = field(default=None)
    author_id: UUID = field(default=None)

    # Содержимое
    content: str = field(default="")

    # Тип комментария
    is_feedback: bool = field(default=True)  # True = feedback при свайпе
    is_question: bool = field(default=False)  # Вопрос автору

    # Связь с свайпом (опционально)
    swipe_id: UUID | None = field(default=None)

    # Модерация
    is_hidden: bool = field(default=False)
    hidden_reason: str | None = field(default=None)

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        """Валидация при создании."""
        if self.content and len(self.content) > MAX_COMMENT_LENGTH:
            self.content = self.content[:MAX_COMMENT_LENGTH]

    def set_content(self, content: str) -> None:
        """Установить содержимое комментария."""
        self.content = content[:MAX_COMMENT_LENGTH]
        self.updated_at = datetime.now(timezone.utc)

    def hide(self, reason: str = "") -> None:
        """Скрыть комментарий."""
        self.is_hidden = True
        self.hidden_reason = reason
        self.updated_at = datetime.now(timezone.utc)

    def unhide(self) -> None:
        """Показать комментарий."""
        self.is_hidden = False
        self.hidden_reason = None
        self.updated_at = datetime.now(timezone.utc)
