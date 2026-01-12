"""Интерфейс репозитория проектов."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.project import Project
from domain.enums.project import ProjectStatus


class ProjectRepositoryInterface(ABC):
    """Интерфейс репозитория для работы с проектами."""

    @abstractmethod
    async def create(self, project: Project) -> Project:
        """Создать проект."""
        pass

    @abstractmethod
    async def get_by_id(self, project_id: UUID) -> Project | None:
        """Получить проект по ID."""
        pass

    @abstractmethod
    async def update(self, project: Project) -> Project:
        """Обновить проект."""
        pass

    @abstractmethod
    async def delete(self, project_id: UUID) -> bool:
        """Удалить проект."""
        pass

    @abstractmethod
    async def get_by_idea(self, idea_id: UUID) -> Project | None:
        """Получить проект по ID идеи."""
        pass

    @abstractmethod
    async def get_by_owner(
        self,
        owner_id: UUID,
        status: ProjectStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]:
        """Получить проекты владельца."""
        pass

    @abstractmethod
    async def get_user_projects(
        self,
        user_id: UUID,
        include_pending: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]:
        """
        Получить проекты, в которых участвует пользователь.
        Требует join с project_members.
        """
        pass

    @abstractmethod
    async def get_public_projects(
        self,
        company_id: UUID | None = None,
        status: ProjectStatus | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Project]:
        """Получить публичные проекты."""
        pass

    @abstractmethod
    async def search_by_text(
        self,
        query: str,
        limit: int = 20,
    ) -> list[Project]:
        """Полнотекстовый поиск проектов."""
        pass

    @abstractmethod
    async def update_members_count(
        self,
        project_id: UUID,
        count: int,
    ) -> None:
        """Обновить счётчик участников."""
        pass
