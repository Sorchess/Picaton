"""Интерфейс репозитория комментариев к идеям."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.idea_comment import IdeaComment


class IdeaCommentRepositoryInterface(ABC):
    """Интерфейс репозитория комментариев к идеям."""

    @abstractmethod
    async def create(self, comment: IdeaComment) -> IdeaComment:
        """Создать комментарий."""
        pass

    @abstractmethod
    async def get_by_id(self, comment_id: UUID) -> IdeaComment | None:
        """Получить комментарий по ID."""
        pass

    @abstractmethod
    async def get_by_idea(
        self,
        idea_id: UUID,
        include_hidden: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IdeaComment]:
        """Получить комментарии к идее."""
        pass

    @abstractmethod
    async def get_by_author(
        self,
        author_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IdeaComment]:
        """Получить комментарии пользователя."""
        pass

    @abstractmethod
    async def update(self, comment: IdeaComment) -> IdeaComment:
        """Обновить комментарий."""
        pass

    @abstractmethod
    async def delete(self, comment_id: UUID) -> bool:
        """Удалить комментарий."""
        pass

    @abstractmethod
    async def count_by_idea(self, idea_id: UUID) -> int:
        """Подсчитать комментарии к идее."""
        pass
