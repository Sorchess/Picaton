"""Интерфейс репозитория геймификации."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.gamification import UserGamification


class GamificationRepositoryInterface(ABC):
    """Интерфейс репозитория геймификации."""

    @abstractmethod
    async def create(self, gamification: UserGamification) -> UserGamification:
        """Создать запись геймификации."""
        pass

    @abstractmethod
    async def get_by_id(self, gamification_id: UUID) -> UserGamification | None:
        """Получить по ID."""
        pass

    @abstractmethod
    async def get_by_user(self, user_id: UUID) -> UserGamification | None:
        """Получить по ID пользователя."""
        pass

    @abstractmethod
    async def update(self, gamification: UserGamification) -> UserGamification:
        """Обновить запись."""
        pass

    @abstractmethod
    async def get_leaderboard(
        self,
        period: str = "all",  # "all" | "weekly" | "monthly"
        company_id: UUID | None = None,
        department_id: UUID | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """
        Получить таблицу лидеров.
        Возвращает list of dicts с полями:
        - user_id, display_name, avatar_url, points, level, badges_count, rank
        """
        pass

    @abstractmethod
    async def reset_weekly_points(self) -> int:
        """Сбросить недельные очки для всех. Возвращает количество обновлённых."""
        pass

    @abstractmethod
    async def reset_monthly_points(self) -> int:
        """Сбросить месячные очки для всех. Возвращает количество обновлённых."""
        pass
