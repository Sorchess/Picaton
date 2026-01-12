"""Доменная сущность проекта."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.enums.project import ProjectStatus


MAX_NAME_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 5000


class InvalidProjectNameError(ValueError):
    """Невалидное название проекта."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Invalid project name: {reason}")


@dataclass
class Project(Entity):
    """
    Доменная сущность проекта.
    Проект создаётся на основе идеи и объединяет команду.
    """

    # Связь с идеей (опционально, проект может быть создан без идеи)
    idea_id: UUID | None = field(default=None)

    # Основные данные
    name: str = field(default="")
    description: str = field(default="")

    # Владелец проекта
    owner_id: UUID = field(default=None)

    # Статус
    status: ProjectStatus = field(default=ProjectStatus.FORMING)

    # Связь с компанией (опционально)
    company_id: UUID | None = field(default=None)

    # Аватар/обложка проекта
    avatar_url: str | None = field(default=None)

    # Настройки
    is_public: bool = field(default=True)  # Виден ли проект публично
    allow_join_requests: bool = field(default=True)  # Можно ли подать заявку

    # Статистика
    members_count: int = field(default=1)  # Включая владельца

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        """Валидация данных при создании."""
        if self.name:
            self._validate_name(self.name)

    @staticmethod
    def _validate_name(name: str) -> None:
        """Валидация названия проекта."""
        if len(name) > MAX_NAME_LENGTH:
            raise InvalidProjectNameError(
                f"Name must not exceed {MAX_NAME_LENGTH} characters"
            )
        if len(name.strip()) < 2:
            raise InvalidProjectNameError("Name must be at least 2 characters")

    def set_name(self, name: str) -> None:
        """Установить название проекта."""
        self._validate_name(name)
        self.name = name
        self._touch()

    def set_description(self, description: str) -> None:
        """Установить описание проекта."""
        if len(description) > MAX_DESCRIPTION_LENGTH:
            description = description[:MAX_DESCRIPTION_LENGTH]
        self.description = description
        self._touch()

    def activate(self) -> None:
        """Активировать проект (команда сформирована, работа начата)."""
        if self.status == ProjectStatus.FORMING:
            self.status = ProjectStatus.ACTIVE
            self._touch()

    def pause(self) -> None:
        """Поставить проект на паузу."""
        if self.status == ProjectStatus.ACTIVE:
            self.status = ProjectStatus.PAUSED
            self._touch()

    def resume(self) -> None:
        """Возобновить проект."""
        if self.status == ProjectStatus.PAUSED:
            self.status = ProjectStatus.ACTIVE
            self._touch()

    def complete(self) -> None:
        """Завершить проект."""
        if self.status in (ProjectStatus.ACTIVE, ProjectStatus.PAUSED):
            self.status = ProjectStatus.COMPLETED
            self._touch()

    def archive(self) -> None:
        """Архивировать проект."""
        self.status = ProjectStatus.ARCHIVED
        self._touch()

    def increment_members(self) -> None:
        """Увеличить счётчик участников."""
        self.members_count += 1
        self._touch()

    def decrement_members(self) -> None:
        """Уменьшить счётчик участников."""
        if self.members_count > 1:
            self.members_count -= 1
            self._touch()

    def _touch(self) -> None:
        """Обновить timestamp."""
        self.updated_at = datetime.now(timezone.utc)

    @property
    def is_active(self) -> bool:
        """Активен ли проект."""
        return self.status in (ProjectStatus.FORMING, ProjectStatus.ACTIVE)

    @property
    def can_accept_members(self) -> bool:
        """Можно ли добавлять участников."""
        return self.status in (ProjectStatus.FORMING, ProjectStatus.ACTIVE)
