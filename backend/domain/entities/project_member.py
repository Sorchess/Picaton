"""Доменная сущность участника проекта."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.enums.project import ProjectMemberRole


@dataclass
class ProjectMember(Entity):
    """
    Доменная сущность участника проекта.
    Связывает пользователя с проектом.
    """

    # Связи
    project_id: UUID = field(default=None)
    user_id: UUID = field(default=None)

    # Роль в проекте
    role: ProjectMemberRole = field(default=ProjectMemberRole.MEMBER)

    # Какие навыки участник привносит в проект
    skills: list[str] = field(default_factory=list)

    # Пользовательская роль/позиция в проекте (напр. "Backend Developer")
    position: str | None = field(default=None)

    # Timestamps
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Для приглашений
    invited_by: UUID | None = field(default=None)
    invitation_message: str | None = field(default=None)

    def accept_invitation(self) -> None:
        """Принять приглашение в проект."""
        if self.role == ProjectMemberRole.INVITED:
            self.role = ProjectMemberRole.MEMBER
            self.joined_at = datetime.now(timezone.utc)
            self._touch()

    def accept_request(self) -> None:
        """Принять заявку на вступление."""
        if self.role == ProjectMemberRole.PENDING:
            self.role = ProjectMemberRole.MEMBER
            self.joined_at = datetime.now(timezone.utc)
            self._touch()

    def promote_to_admin(self) -> None:
        """Повысить до администратора."""
        if self.role == ProjectMemberRole.MEMBER:
            self.role = ProjectMemberRole.ADMIN
            self._touch()

    def demote_to_member(self) -> None:
        """Понизить до обычного участника."""
        if self.role == ProjectMemberRole.ADMIN:
            self.role = ProjectMemberRole.MEMBER
            self._touch()

    def set_position(self, position: str) -> None:
        """Установить позицию в проекте."""
        self.position = position.strip()[:100] if position else None
        self._touch()

    def set_skills(self, skills: list[str]) -> None:
        """Установить навыки участника в проекте."""
        self.skills = [s.strip().lower() for s in skills[:10] if s.strip()]
        self._touch()

    def _touch(self) -> None:
        """Обновить timestamp."""
        self.updated_at = datetime.now(timezone.utc)

    @property
    def is_active_member(self) -> bool:
        """Является ли активным участником (не pending/invited)."""
        return self.role in (
            ProjectMemberRole.OWNER,
            ProjectMemberRole.ADMIN,
            ProjectMemberRole.MEMBER,
        )

    @property
    def is_admin_or_owner(self) -> bool:
        """Является ли администратором или владельцем."""
        return self.role in (ProjectMemberRole.OWNER, ProjectMemberRole.ADMIN)

    @property
    def is_owner(self) -> bool:
        """Является ли владельцем."""
        return self.role == ProjectMemberRole.OWNER
