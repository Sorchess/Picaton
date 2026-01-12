"""Доменные сущности для геймификации Фабрики Идей."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from domain.entities.base import Entity


class BadgeType(str, Enum):
    """Типы бейджей."""

    # Идеи
    INNOVATOR = "innovator"  # Первая опубликованная идея
    IDEA_MACHINE = "idea_machine"  # 10 идей
    VISIONARY = "visionary"  # 50 идей

    # Голосование
    VOTER = "voter"  # Первые 10 свайпов
    ACTIVE_VOTER = "active_voter"  # 100 свайпов
    SUPER_VOTER = "super_voter"  # 500 свайпов

    # Команды
    TEAM_BUILDER = "team_builder"  # Первая сформированная команда
    COLLABORATOR = "collaborator"  # 5 участий в проектах
    MENTOR = "mentor"  # 10 проектов

    # Проекты
    PROJECT_STARTER = "project_starter"  # Первый проект
    PROJECT_FINISHER = "project_finisher"  # Первый завершённый проект
    SERIAL_FINISHER = "serial_finisher"  # 5 завершённых проектов

    # Стрики
    STREAK_3 = "streak_3"  # 3 дня подряд голосований
    STREAK_7 = "streak_7"  # 7 дней подряд
    STREAK_30 = "streak_30"  # 30 дней подряд

    # Социальные
    POPULAR = "popular"  # Идея набрала 100 лайков
    SUPER_POPULAR = "super_popular"  # Идея набрала 500 лайков
    CHAT_ACTIVE = "chat_active"  # 100 сообщений в чатах


class PointsAction(str, Enum):
    """Действия за которые начисляются очки."""

    # Идеи
    IDEA_CREATED = "idea_created"  # +10
    IDEA_PUBLISHED = "idea_published"  # +5
    IDEA_LIKED = "idea_liked"  # +1 (автору)
    IDEA_SUPER_LIKED = "idea_super_liked"  # +3 (автору)

    # Голосование
    SWIPE = "swipe"  # +1
    SWIPE_WITH_FEEDBACK = "swipe_with_feedback"  # +3
    DAILY_VOTING = "daily_voting"  # +5 (бонус за ежедневное)

    # Команды
    TEAM_JOINED = "team_joined"  # +10
    TEAM_FORMED = "team_formed"  # +20 (автору идеи)
    EXPERT_INVITED = "expert_invited"  # +5

    # Проекты
    PROJECT_CREATED = "project_created"  # +15
    PROJECT_COMPLETED = "project_completed"  # +50

    # Чат
    CHAT_MESSAGE = "chat_message"  # +1 (max 5/day)

    # Бонусы
    STREAK_BONUS = "streak_bonus"  # +10 per streak day
    BADGE_EARNED = "badge_earned"  # +20


# Очки за действия
POINTS_MAP = {
    PointsAction.IDEA_CREATED: 10,
    PointsAction.IDEA_PUBLISHED: 5,
    PointsAction.IDEA_LIKED: 1,
    PointsAction.IDEA_SUPER_LIKED: 3,
    PointsAction.SWIPE: 1,
    PointsAction.SWIPE_WITH_FEEDBACK: 3,
    PointsAction.DAILY_VOTING: 5,
    PointsAction.TEAM_JOINED: 10,
    PointsAction.TEAM_FORMED: 20,
    PointsAction.EXPERT_INVITED: 5,
    PointsAction.PROJECT_CREATED: 15,
    PointsAction.PROJECT_COMPLETED: 50,
    PointsAction.CHAT_MESSAGE: 1,
    PointsAction.STREAK_BONUS: 10,
    PointsAction.BADGE_EARNED: 20,
}


@dataclass
class UserGamification(Entity):
    """
    Геймификация пользователя.
    Хранит очки, бейджи и статистику активности.
    """

    # Связь с пользователем
    user_id: UUID = field(default=None)

    # Очки
    total_points: int = field(default=0)
    weekly_points: int = field(default=0)
    monthly_points: int = field(default=0)

    # Уровень (рассчитывается из очков)
    level: int = field(default=1)

    # Бейджи
    badges: list[str] = field(default_factory=list)  # BadgeType values
    badges_earned_at: dict[str, str] = field(
        default_factory=dict
    )  # badge → ISO datetime

    # Стрики
    current_voting_streak: int = field(default=0)
    max_voting_streak: int = field(default=0)
    last_vote_date: str | None = field(default=None)  # ISO date

    # Статистика
    ideas_count: int = field(default=0)
    swipes_count: int = field(default=0)
    projects_count: int = field(default=0)
    completed_projects_count: int = field(default=0)
    chat_messages_count: int = field(default=0)

    # Репутация (0.0 - 1.0, влияет на IdeaScore)
    reputation: float = field(default=0.5)

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def add_points(self, action: PointsAction, multiplier: float = 1.0) -> int:
        """Добавить очки за действие."""
        base_points = POINTS_MAP.get(action, 0)
        points = int(base_points * multiplier)

        self.total_points += points
        self.weekly_points += points
        self.monthly_points += points

        # Пересчитываем уровень (каждые 100 очков = новый уровень)
        self.level = max(1, self.total_points // 100 + 1)

        self._touch()
        return points

    def add_badge(self, badge: BadgeType) -> bool:
        """Добавить бейдж. Возвращает True если бейдж новый."""
        if badge.value in self.badges:
            return False

        self.badges.append(badge.value)
        self.badges_earned_at[badge.value] = datetime.now(timezone.utc).isoformat()

        # Бонус за бейдж
        self.add_points(PointsAction.BADGE_EARNED)

        self._touch()
        return True

    def has_badge(self, badge: BadgeType) -> bool:
        """Проверить наличие бейджа."""
        return badge.value in self.badges

    def update_voting_streak(self, vote_date: str) -> int:
        """
        Обновить стрик голосования.
        vote_date в формате YYYY-MM-DD.
        Возвращает новое значение стрика.
        """
        from datetime import date as dt_date

        today = dt_date.fromisoformat(vote_date)

        if self.last_vote_date:
            last = dt_date.fromisoformat(self.last_vote_date)
            diff = (today - last).days

            if diff == 0:
                # Уже голосовали сегодня
                return self.current_voting_streak
            elif diff == 1:
                # Продолжаем стрик
                self.current_voting_streak += 1
            else:
                # Стрик сброшен
                self.current_voting_streak = 1
        else:
            # Первое голосование
            self.current_voting_streak = 1

        self.last_vote_date = vote_date
        self.max_voting_streak = max(self.max_voting_streak, self.current_voting_streak)

        # Бонус за стрик
        if self.current_voting_streak > 1:
            self.add_points(PointsAction.STREAK_BONUS)

        # Проверяем бейджи за стрики
        if self.current_voting_streak >= 3:
            self.add_badge(BadgeType.STREAK_3)
        if self.current_voting_streak >= 7:
            self.add_badge(BadgeType.STREAK_7)
        if self.current_voting_streak >= 30:
            self.add_badge(BadgeType.STREAK_30)

        self._touch()
        return self.current_voting_streak

    def increment_stat(self, stat: str, value: int = 1) -> None:
        """Увеличить статистику."""
        if hasattr(self, f"{stat}_count"):
            current = getattr(self, f"{stat}_count", 0)
            setattr(self, f"{stat}_count", current + value)
            self._touch()

    def update_reputation(self) -> float:
        """
        Пересчитать репутацию на основе активности.
        Формула: 0.3×Level + 0.3×Badges + 0.2×CompletedProjects + 0.2×Streak
        """
        level_score = min(self.level / 50, 1.0)
        badges_score = min(len(self.badges) / 15, 1.0)
        projects_score = min(self.completed_projects_count / 10, 1.0)
        streak_score = min(self.max_voting_streak / 30, 1.0)

        self.reputation = round(
            0.3 * level_score
            + 0.3 * badges_score
            + 0.2 * projects_score
            + 0.2 * streak_score,
            4,
        )

        self._touch()
        return self.reputation

    def reset_weekly_points(self) -> None:
        """Сбросить недельные очки (вызывается cron-ом)."""
        self.weekly_points = 0
        self._touch()

    def reset_monthly_points(self) -> None:
        """Сбросить месячные очки (вызывается cron-ом)."""
        self.monthly_points = 0
        self._touch()

    def _touch(self) -> None:
        """Обновить timestamp."""
        self.updated_at = datetime.now(timezone.utc)
