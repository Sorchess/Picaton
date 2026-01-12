"""Интерфейс репозитория участников проекта."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.project_member import ProjectMember
from domain.enums.project import ProjectMemberRole


class ProjectMemberRepositoryInterface(ABC):
    """Интерфейс репозитория для работы с участниками проекта."""

    @abstractmethod
    async def create(self, member: ProjectMember) -> ProjectMember:
        """Создать участника."""
        pass

    @abstractmethod
    async def get_by_id(self, member_id: UUID) -> ProjectMember | None:
        """Получить участника по ID."""
        pass

    @abstractmethod
    async def get_by_project_and_user(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> ProjectMember | None:
        """Получить участника проекта по user_id."""
        pass

    @abstractmethod
    async def update(self, member: ProjectMember) -> ProjectMember:
        """Обновить участника."""
        pass

    @abstractmethod
    async def delete(self, member_id: UUID) -> bool:
        """Удалить участника."""
        pass

    @abstractmethod
    async def delete_by_project_and_user(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Удалить участника по project_id и user_id."""
        pass

    @abstractmethod
    async def get_by_project(
        self,
        project_id: UUID,
        role: ProjectMemberRole | None = None,
        only_active: bool = True,
    ) -> list[ProjectMember]:
        """
        Получить участников проекта.

        Args:
            project_id: ID проекта
            role: Фильтр по роли
            only_active: Только активные (не pending/invited)
        """
        pass

    @abstractmethod
    async def get_user_memberships(
        self,
        user_id: UUID,
        only_active: bool = True,
    ) -> list[ProjectMember]:
        """Получить все членства пользователя в проектах."""
        pass

    @abstractmethod
    async def count_by_project(
        self,
        project_id: UUID,
        only_active: bool = True,
    ) -> int:
        """Подсчитать участников проекта."""
        pass

    @abstractmethod
    async def get_pending_requests(
        self,
        project_id: UUID,
    ) -> list[ProjectMember]:
        """Получить ожидающие заявки на вступление."""
        pass

    @abstractmethod
    async def get_pending_invitations(
        self,
        user_id: UUID,
    ) -> list[ProjectMember]:
        """Получить ожидающие приглашения для пользователя."""
        pass

    @abstractmethod
    async def is_member(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Проверить, является ли пользователь участником проекта."""
        pass

    @abstractmethod
    async def get_project_ids_for_user(
        self,
        user_id: UUID,
        only_active: bool = True,
    ) -> list[UUID]:
        """Получить ID проектов пользователя."""
        pass
