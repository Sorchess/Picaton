"""Сервис геймификации для Фабрики Идей."""

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from domain.entities.gamification import (
    UserGamification,
    BadgeType,
    PointsAction,
    POINTS_MAP,
)
from domain.repositories.gamification import GamificationRepositoryInterface


logger = logging.getLogger(__name__)


@dataclass
class PointsResult:
    """Результат начисления очков."""

    points_added: int
    total_points: int
    level: int
    new_badges: list[str]
    current_streak: int = 0

    @property
    def points_earned(self) -> int:
        """Алиас для совместимости."""
        return self.points_added


@dataclass
class LeaderboardEntry:
    """Запись в таблице лидеров."""

    user_id: UUID
    display_name: str
    avatar_url: str | None
    points: int
    level: int
    badges_count: int
    rank: int


class GamificationService:
    """Сервис управления геймификацией."""

    def __init__(self, gamification_repository: GamificationRepositoryInterface):
        self._repo = gamification_repository

    async def get_or_create_user_gamification(self, user_id: UUID) -> UserGamification:
        """Получить или создать запись геймификации для пользователя."""
        gamification = await self._repo.get_by_user(user_id)

        if not gamification:
            gamification = UserGamification(
                id=uuid4(),
                user_id=user_id,
            )
            gamification = await self._repo.create(gamification)

        return gamification

    async def award_points(
        self,
        user_id: UUID,
        action: PointsAction,
        multiplier: float = 1.0,
    ) -> PointsResult:
        """
        Начислить очки за действие.

        Args:
            user_id: ID пользователя
            action: Тип действия
            multiplier: Множитель очков

        Returns:
            Результат с информацией о начисленных очках
        """
        gamification = await self.get_or_create_user_gamification(user_id)

        # Начисляем очки
        points_added = gamification.add_points(action, multiplier)

        # Проверяем новые бейджи
        new_badges = await self._check_and_award_badges(gamification)

        # Сохраняем
        await self._repo.update(gamification)

        return PointsResult(
            points_added=points_added,
            total_points=gamification.total_points,
            level=gamification.level,
            new_badges=new_badges,
        )

    async def record_idea_created(self, user_id: UUID) -> PointsResult:
        """Записать создание идеи."""
        gamification = await self.get_or_create_user_gamification(user_id)
        gamification.increment_stat("ideas")

        result = await self.award_points(user_id, PointsAction.IDEA_CREATED)

        # Проверяем бейдж Innovator
        if gamification.ideas_count == 1:
            gamification.add_badge(BadgeType.INNOVATOR)
            result.new_badges.append(BadgeType.INNOVATOR.value)
        elif gamification.ideas_count >= 10:
            if gamification.add_badge(BadgeType.IDEA_MACHINE):
                result.new_badges.append(BadgeType.IDEA_MACHINE.value)
        elif gamification.ideas_count >= 50:
            if gamification.add_badge(BadgeType.VISIONARY):
                result.new_badges.append(BadgeType.VISIONARY.value)

        await self._repo.update(gamification)
        return result

    async def record_swipe(
        self,
        user_id: UUID,
        with_feedback: bool = False,
    ) -> PointsResult:
        """Записать свайп."""
        gamification = await self.get_or_create_user_gamification(user_id)
        gamification.increment_stat("swipes")

        # Обновляем стрик
        today = date.today().isoformat()
        gamification.update_voting_streak(today)

        # Начисляем очки
        action = (
            PointsAction.SWIPE_WITH_FEEDBACK if with_feedback else PointsAction.SWIPE
        )
        result = await self.award_points(user_id, action)

        # Устанавливаем текущий стрик
        result.current_streak = gamification.current_voting_streak

        # Проверяем бейджи за голосование
        new_badges = []
        if gamification.swipes_count >= 10:
            if gamification.add_badge(BadgeType.VOTER):
                new_badges.append(BadgeType.VOTER.value)
        if gamification.swipes_count >= 100:
            if gamification.add_badge(BadgeType.ACTIVE_VOTER):
                new_badges.append(BadgeType.ACTIVE_VOTER.value)
        if gamification.swipes_count >= 500:
            if gamification.add_badge(BadgeType.SUPER_VOTER):
                new_badges.append(BadgeType.SUPER_VOTER.value)

        result.new_badges.extend(new_badges)
        await self._repo.update(gamification)
        return result

    async def record_idea_liked(
        self,
        author_id: UUID,
        is_super: bool = False,
    ) -> PointsResult:
        """Записать получение лайка (автору идеи)."""
        action = PointsAction.IDEA_SUPER_LIKED if is_super else PointsAction.IDEA_LIKED
        return await self.award_points(author_id, action)

    async def record_project_created(self, user_id: UUID) -> PointsResult:
        """Записать создание проекта."""
        gamification = await self.get_or_create_user_gamification(user_id)
        gamification.increment_stat("projects")

        result = await self.award_points(user_id, PointsAction.PROJECT_CREATED)

        if gamification.projects_count == 1:
            if gamification.add_badge(BadgeType.PROJECT_STARTER):
                result.new_badges.append(BadgeType.PROJECT_STARTER.value)

        await self._repo.update(gamification)
        return result

    async def record_project_completed(self, user_id: UUID) -> PointsResult:
        """Записать завершение проекта."""
        gamification = await self.get_or_create_user_gamification(user_id)
        gamification.increment_stat("completed_projects")

        result = await self.award_points(user_id, PointsAction.PROJECT_COMPLETED)

        new_badges = []
        if gamification.completed_projects_count == 1:
            if gamification.add_badge(BadgeType.PROJECT_FINISHER):
                new_badges.append(BadgeType.PROJECT_FINISHER.value)
        if gamification.completed_projects_count >= 5:
            if gamification.add_badge(BadgeType.SERIAL_FINISHER):
                new_badges.append(BadgeType.SERIAL_FINISHER.value)

        result.new_badges.extend(new_badges)
        await self._repo.update(gamification)
        return result

    async def record_team_joined(self, user_id: UUID) -> PointsResult:
        """Записать вступление в команду."""
        gamification = await self.get_or_create_user_gamification(user_id)
        gamification.increment_stat("projects")

        result = await self.award_points(user_id, PointsAction.TEAM_JOINED)

        if gamification.projects_count >= 5:
            if gamification.add_badge(BadgeType.COLLABORATOR):
                result.new_badges.append(BadgeType.COLLABORATOR.value)
        if gamification.projects_count >= 10:
            if gamification.add_badge(BadgeType.MENTOR):
                result.new_badges.append(BadgeType.MENTOR.value)

        await self._repo.update(gamification)
        return result

    async def record_team_formed(self, author_id: UUID) -> PointsResult:
        """Записать формирование команды (автору идеи)."""
        gamification = await self.get_or_create_user_gamification(author_id)

        result = await self.award_points(author_id, PointsAction.TEAM_FORMED)

        if gamification.add_badge(BadgeType.TEAM_BUILDER):
            result.new_badges.append(BadgeType.TEAM_BUILDER.value)

        await self._repo.update(gamification)
        return result

    async def record_chat_message(self, user_id: UUID) -> PointsResult:
        """Записать сообщение в чате (с лимитом 5/день)."""
        gamification = await self.get_or_create_user_gamification(user_id)
        gamification.increment_stat("chat_messages")

        # TODO: Проверить лимит 5 сообщений в день
        result = await self.award_points(user_id, PointsAction.CHAT_MESSAGE)

        if gamification.chat_messages_count >= 100:
            if gamification.add_badge(BadgeType.CHAT_ACTIVE):
                result.new_badges.append(BadgeType.CHAT_ACTIVE.value)

        await self._repo.update(gamification)
        return result

    async def check_popularity_badges(
        self,
        author_id: UUID,
        likes_count: int,
    ) -> list[str]:
        """Проверить бейджи популярности для идеи."""
        gamification = await self.get_or_create_user_gamification(author_id)

        new_badges = []
        if likes_count >= 100:
            if gamification.add_badge(BadgeType.POPULAR):
                new_badges.append(BadgeType.POPULAR.value)
        if likes_count >= 500:
            if gamification.add_badge(BadgeType.SUPER_POPULAR):
                new_badges.append(BadgeType.SUPER_POPULAR.value)

        if new_badges:
            await self._repo.update(gamification)

        return new_badges

    async def get_user_stats(self, user_id: UUID) -> UserGamification:
        """Получить статистику пользователя."""
        return await self.get_or_create_user_gamification(user_id)

    async def get_leaderboard(
        self,
        period: str = "all",  # "all" | "weekly" | "monthly"
        company_id: UUID | None = None,
        department_id: UUID | None = None,
        limit: int = 10,
    ) -> list[LeaderboardEntry]:
        """
        Получить таблицу лидеров.

        Args:
            period: Период (all/weekly/monthly)
            company_id: Фильтр по компании
            department_id: Фильтр по департаменту
            limit: Количество записей

        Returns:
            Список лидеров
        """
        results = await self._repo.get_leaderboard(
            period=period,
            company_id=company_id,
            department_id=department_id,
            limit=limit,
        )

        # Преобразуем dict в LeaderboardEntry
        return [
            LeaderboardEntry(
                user_id=r["user_id"],
                display_name=r.get("display_name", "Unknown"),
                avatar_url=r.get("avatar_url"),
                points=r.get("points", 0),
                level=r.get("level", 1),
                badges_count=r.get("badges_count", 0),
                rank=r.get("rank", 0),
            )
            for r in results
        ]

    async def get_user_reputation(self, user_id: UUID) -> float:
        """Получить репутацию пользователя (для IdeaScore)."""
        gamification = await self.get_or_create_user_gamification(user_id)
        return gamification.update_reputation()

    async def _check_and_award_badges(
        self, gamification: UserGamification
    ) -> list[str]:
        """Проверить и выдать бейджи на основе текущей статистики."""
        new_badges = []
        # Бейджи проверяются в специфических методах record_*
        return new_badges
