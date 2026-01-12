"""Сервис управления идеями."""

import logging
from dataclasses import dataclass
from uuid import UUID, uuid4

from domain.entities.idea import Idea
from domain.enums.idea import IdeaStatus, IdeaVisibility
from domain.repositories.idea import IdeaRepositoryInterface
from domain.repositories.idea_swipe import IdeaSwipeRepositoryInterface


logger = logging.getLogger(__name__)


class IdeaNotFoundError(Exception):
    """Идея не найдена."""

    def __init__(self, idea_id: str):
        self.idea_id = idea_id
        super().__init__(f"Idea not found: {idea_id}")


class IdeaAccessDeniedError(Exception):
    """Доступ к идее запрещён."""

    def __init__(self, idea_id: str, user_id: str):
        self.idea_id = idea_id
        self.user_id = user_id
        super().__init__(f"Access denied to idea {idea_id} for user {user_id}")


@dataclass
class CreateIdeaData:
    """Данные для создания идеи."""

    title: str
    description: str
    required_skills: list[str] | None = None
    visibility: IdeaVisibility = IdeaVisibility.PUBLIC
    company_id: UUID | None = None


@dataclass
class UpdateIdeaData:
    """Данные для обновления идеи."""

    title: str | None = None
    description: str | None = None
    required_skills: list[str] | None = None
    visibility: IdeaVisibility | None = None


class IdeaService:
    """Сервис управления идеями."""

    def __init__(
        self,
        idea_repository: IdeaRepositoryInterface,
        swipe_repository: IdeaSwipeRepositoryInterface,
    ):
        self._idea_repo = idea_repository
        self._swipe_repo = swipe_repository

    async def create_idea(
        self,
        author_id: UUID,
        data: CreateIdeaData,
    ) -> Idea:
        """Создать новую идею."""
        idea = Idea(
            id=uuid4(),
            author_id=author_id,
            title=data.title,
            description=data.description,
            required_skills=data.required_skills or [],
            visibility=data.visibility,
            company_id=data.company_id,
            status=IdeaStatus.DRAFT,
        )

        return await self._idea_repo.create(idea)

    async def get_idea(self, idea_id: UUID) -> Idea:
        """Получить идею по ID."""
        idea = await self._idea_repo.get_by_id(idea_id)
        if not idea:
            raise IdeaNotFoundError(str(idea_id))
        return idea

    async def update_idea(
        self,
        idea_id: UUID,
        owner_id: UUID,
        data: UpdateIdeaData,
    ) -> Idea:
        """Обновить идею."""
        idea = await self.get_idea(idea_id)

        if idea.author_id != owner_id:
            raise IdeaAccessDeniedError(str(idea_id), str(owner_id))

        if not idea.can_be_edited:
            raise ValueError("Idea cannot be edited in current status")

        if data.title is not None:
            idea.set_title(data.title)
        if data.description is not None:
            idea.set_description(data.description)
        if data.required_skills is not None:
            idea.set_required_skills(data.required_skills)
        if data.visibility is not None:
            idea.visibility = data.visibility

        return await self._idea_repo.update(idea)

    async def delete_idea(self, idea_id: UUID, owner_id: UUID) -> bool:
        """Удалить идею."""
        idea = await self.get_idea(idea_id)

        if idea.author_id != owner_id:
            raise IdeaAccessDeniedError(str(idea_id), str(owner_id))

        return await self._idea_repo.delete(idea_id)

    async def publish_idea(self, idea_id: UUID, owner_id: UUID) -> Idea:
        """Опубликовать идею (сделать активной)."""
        idea = await self.get_idea(idea_id)

        if idea.author_id != owner_id:
            raise IdeaAccessDeniedError(str(idea_id), str(owner_id))

        idea.publish()
        return await self._idea_repo.update(idea)

    async def archive_idea(self, idea_id: UUID, owner_id: UUID) -> Idea:
        """Архивировать идею."""
        idea = await self.get_idea(idea_id)

        if idea.author_id != owner_id:
            raise IdeaAccessDeniedError(str(idea_id), str(owner_id))

        idea.archive()
        return await self._idea_repo.update(idea)

    async def get_my_ideas(
        self,
        author_id: UUID,
        status: IdeaStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Idea]:
        """Получить идеи текущего пользователя."""
        return await self._idea_repo.get_by_author(
            author_id=author_id,
            status=status,
            limit=limit,
            offset=offset,
        )

    async def get_ideas_for_swipe(
        self,
        user_id: UUID,
        company_id: UUID | None = None,
        limit: int = 20,
    ) -> list[Idea]:
        """
        Получить идеи для свайпа.
        Исключает идеи самого пользователя и уже просмотренные.
        """
        # Получаем ID уже просмотренных идей
        swiped_ids = await self._swipe_repo.get_swiped_idea_ids(user_id)

        # Получаем активные идеи
        ideas = await self._idea_repo.get_active_ideas(
            exclude_author_id=user_id,
            exclude_idea_ids=swiped_ids,
            visibility=IdeaVisibility.PUBLIC,
            company_id=company_id,
            limit=limit,
        )

        return ideas

    async def set_ai_suggested_skills(
        self,
        idea_id: UUID,
        skills: list[str],
    ) -> Idea:
        """Установить AI-предложенные навыки."""
        idea = await self.get_idea(idea_id)
        idea.set_ai_suggested_skills(skills)
        return await self._idea_repo.update(idea)

    async def set_embedding(
        self,
        idea_id: UUID,
        embedding: list[float],
    ) -> Idea:
        """Установить embedding для семантического поиска."""
        idea = await self.get_idea(idea_id)
        idea.set_embedding(embedding)
        return await self._idea_repo.update(idea)

    async def search_ideas(
        self,
        query: str,
        limit: int = 20,
    ) -> list[Idea]:
        """Поиск идей по тексту."""
        return await self._idea_repo.search_by_text(query, limit)

    async def search_by_skills(
        self,
        skills: list[str],
        limit: int = 20,
    ) -> list[Idea]:
        """Поиск идей по навыкам."""
        return await self._idea_repo.search_by_skills(skills, limit)
