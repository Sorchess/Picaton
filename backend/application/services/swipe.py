"""Сервис свайпов на идеи."""

import logging
from dataclasses import dataclass
from uuid import UUID, uuid4

from domain.entities.idea_swipe import IdeaSwipe
from domain.enums.idea import SwipeDirection
from domain.repositories.idea import IdeaRepositoryInterface
from domain.repositories.idea_swipe import IdeaSwipeRepositoryInterface


logger = logging.getLogger(__name__)


@dataclass
class SwipeResult:
    """Результат свайпа."""

    swipe: IdeaSwipe
    is_match: bool = False
    match_user_ids: list[UUID] | None = None


@dataclass
class MatchInfo:
    """Информация о мэтче."""

    idea_id: UUID
    idea_title: str
    author_id: UUID
    matched_at: str


class SwipeService:
    """Сервис свайпов на идеи."""

    def __init__(
        self,
        swipe_repository: IdeaSwipeRepositoryInterface,
        idea_repository: IdeaRepositoryInterface,
    ):
        self._swipe_repo = swipe_repository
        self._idea_repo = idea_repository

    async def swipe(
        self,
        user_id: UUID,
        idea_id: UUID,
        direction: SwipeDirection,
    ) -> SwipeResult:
        """
        Выполнить свайп на идею.

        Returns:
            SwipeResult с информацией о мэтче если есть
        """
        # Проверяем, что идея существует
        idea = await self._idea_repo.get_by_id(idea_id)
        if not idea:
            raise ValueError(f"Idea not found: {idea_id}")

        # Нельзя свайпать свои идеи
        if idea.author_id == user_id:
            raise ValueError("Cannot swipe your own idea")

        # Проверяем, не свайпали ли уже
        existing = await self._swipe_repo.get_by_user_and_idea(user_id, idea_id)
        if existing:
            # Обновляем направление если уже свайпали
            existing.direction = direction
            # В текущей реализации нет update, просто удалим и создадим заново
            await self._swipe_repo.delete_by_user_and_idea(user_id, idea_id)

        # Создаём свайп
        swipe = IdeaSwipe(
            id=uuid4(),
            user_id=user_id,
            idea_id=idea_id,
            direction=direction,
        )
        await self._swipe_repo.create(swipe)

        # Обновляем счётчик лайков на идее
        if direction in (SwipeDirection.LIKE, SwipeDirection.SUPER_LIKE):
            await self._idea_repo.increment_likes(
                idea_id,
                is_super=direction == SwipeDirection.SUPER_LIKE,
            )

            # Проверяем на взаимный мэтч
            match_user_ids = await self._check_mutual_match(
                user_id=user_id,
                idea=idea,
            )

            if match_user_ids:
                return SwipeResult(
                    swipe=swipe,
                    is_match=True,
                    match_user_ids=match_user_ids,
                )

        return SwipeResult(swipe=swipe, is_match=False)

    async def _check_mutual_match(
        self,
        user_id: UUID,
        idea,
    ) -> list[UUID] | None:
        """
        Проверить взаимный мэтч.
        Мэтч происходит если:
        - user_id лайкнул идею автора
        - автор идеи лайкнул какую-то идею user_id
        """
        # Получаем идеи пользователя который свайпнул
        user_ideas = await self._idea_repo.get_by_author(user_id, limit=100)

        if not user_ideas:
            return None

        # Проверяем, лайкнул ли автор идеи какую-то из идей user_id
        for user_idea in user_ideas:
            author_swipe = await self._swipe_repo.get_by_user_and_idea(
                idea.author_id,
                user_idea.id,
            )
            if author_swipe and author_swipe.is_positive:
                return [idea.author_id]

        return None

    async def get_swiped_idea_ids(self, user_id: UUID) -> set[UUID]:
        """Получить ID идей, которые пользователь уже свайпнул."""
        return await self._swipe_repo.get_swiped_idea_ids(user_id)

    async def get_my_likes(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IdeaSwipe]:
        """Получить лайки пользователя."""
        return await self._swipe_repo.get_user_likes(user_id, limit, offset)

    async def get_likes_on_my_ideas(
        self,
        author_id: UUID,
        limit: int = 50,
    ) -> list[tuple[UUID, UUID]]:
        """Получить пользователей, которые лайкнули мои идеи."""
        return await self._swipe_repo.get_users_who_liked_my_ideas(author_id, limit)

    async def undo_swipe(
        self,
        user_id: UUID,
        idea_id: UUID,
    ) -> bool:
        """Отменить свайп."""
        return await self._swipe_repo.delete_by_user_and_idea(user_id, idea_id)

    async def get_idea_likes_count(self, idea_id: UUID) -> int:
        """Получить количество лайков на идею."""
        return await self._swipe_repo.count_likes_for_idea(idea_id)
