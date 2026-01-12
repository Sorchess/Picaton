"""Интерфейс репозитория идей."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.idea import Idea
from domain.enums.idea import IdeaStatus, IdeaVisibility


class IdeaRepositoryInterface(ABC):
    """Интерфейс репозитория для работы с идеями."""

    @abstractmethod
    async def create(self, idea: Idea) -> Idea:
        """Создать идею."""
        pass

    @abstractmethod
    async def get_by_id(self, idea_id: UUID) -> Idea | None:
        """Получить идею по ID."""
        pass

    @abstractmethod
    async def update(self, idea: Idea) -> Idea:
        """Обновить идею."""
        pass

    @abstractmethod
    async def delete(self, idea_id: UUID) -> bool:
        """Удалить идею."""
        pass

    @abstractmethod
    async def get_by_author(
        self,
        author_id: UUID,
        status: IdeaStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Idea]:
        """Получить идеи автора."""
        pass

    @abstractmethod
    async def get_active_ideas(
        self,
        exclude_author_id: UUID | None = None,
        exclude_idea_ids: set[UUID] | None = None,
        visibility: IdeaVisibility = IdeaVisibility.PUBLIC,
        company_id: UUID | None = None,
        limit: int = 20,
    ) -> list[Idea]:
        """
        Получить активные идеи для ленты свайпов.

        Args:
            exclude_author_id: Исключить идеи этого автора (обычно текущий пользователь)
            exclude_idea_ids: Исключить эти идеи (уже просмотренные)
            visibility: Фильтр по видимости
            company_id: Фильтр по компании (для company visibility)
            limit: Лимит результатов
        """
        pass

    @abstractmethod
    async def search_by_skills(
        self,
        skills: list[str],
        limit: int = 20,
    ) -> list[Idea]:
        """Поиск идей по навыкам."""
        pass

    @abstractmethod
    async def search_by_text(
        self,
        query: str,
        limit: int = 20,
    ) -> list[Idea]:
        """Полнотекстовый поиск идей."""
        pass

    @abstractmethod
    async def search_by_embedding(
        self,
        embedding: list[float],
        limit: int = 20,
        min_score: float = 0.5,
    ) -> list[Idea]:
        """Семантический поиск идей по embedding."""
        pass

    @abstractmethod
    async def increment_likes(
        self,
        idea_id: UUID,
        is_super: bool = False,
    ) -> None:
        """Увеличить счётчик лайков."""
        pass

    @abstractmethod
    async def increment_views(self, idea_id: UUID) -> None:
        """Увеличить счётчик просмотров."""
        pass
