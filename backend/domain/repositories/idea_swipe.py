"""Интерфейс репозитория свайпов на идеи."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.idea_swipe import IdeaSwipe
from domain.enums.idea import SwipeDirection


class IdeaSwipeRepositoryInterface(ABC):
    """Интерфейс репозитория для работы со свайпами."""

    @abstractmethod
    async def create(self, swipe: IdeaSwipe) -> IdeaSwipe:
        """Создать свайп."""
        pass

    @abstractmethod
    async def get_by_id(self, swipe_id: UUID) -> IdeaSwipe | None:
        """Получить свайп по ID."""
        pass

    @abstractmethod
    async def get_by_user_and_idea(
        self,
        user_id: UUID,
        idea_id: UUID,
    ) -> IdeaSwipe | None:
        """Получить свайп пользователя на идею."""
        pass

    @abstractmethod
    async def get_swiped_idea_ids(self, user_id: UUID) -> set[UUID]:
        """Получить ID идей, которые пользователь уже свайпнул."""
        pass

    @abstractmethod
    async def get_likes_for_idea(
        self,
        idea_id: UUID,
        include_super: bool = True,
    ) -> list[IdeaSwipe]:
        """Получить лайки на идею."""
        pass

    @abstractmethod
    async def get_user_likes(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IdeaSwipe]:
        """Получить лайки пользователя."""
        pass

    @abstractmethod
    async def get_matches_for_idea(
        self,
        idea_id: UUID,
        author_id: UUID,
    ) -> list[UUID]:
        """
        Получить взаимные мэтчи для идеи.
        Возвращает user_id пользователей, которые лайкнули идею
        и чьи идеи лайкнул автор.
        """
        pass

    @abstractmethod
    async def count_likes_for_idea(
        self,
        idea_id: UUID,
        direction: SwipeDirection | None = None,
    ) -> int:
        """Подсчитать лайки на идею."""
        pass

    @abstractmethod
    async def delete_by_user_and_idea(
        self,
        user_id: UUID,
        idea_id: UUID,
    ) -> bool:
        """Удалить свайп (отменить лайк)."""
        pass

    @abstractmethod
    async def get_users_who_liked_my_ideas(
        self,
        author_id: UUID,
        limit: int = 50,
    ) -> list[tuple[UUID, UUID]]:
        """
        Получить пользователей, лайкнувших идеи автора.
        Возвращает список (user_id, idea_id).
        """
        pass
