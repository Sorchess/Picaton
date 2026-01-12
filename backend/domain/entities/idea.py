"""Доменная сущность идеи для формирования команды (Фабрика Идей)."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.enums.idea import IdeaStatus, IdeaVisibility


MAX_TITLE_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 5000
MAX_SKILLS_COUNT = 20
MAX_PRD_FIELD_LENGTH = 3000


class InvalidIdeaTitleError(ValueError):
    """Невалидное название идеи."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Invalid idea title: {reason}")


class InvalidIdeaDescriptionError(ValueError):
    """Невалидное описание идеи."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Invalid idea description: {reason}")


@dataclass
class Idea(Entity):
    """
    Доменная сущность идеи (Фабрика Идей).
    Представляет идею пользователя для формирования команды.
    Включает полноценную PRD структуру.
    """

    # Автор идеи
    author_id: UUID = field(default=None)

    # Основные данные (PRD структура)
    title: str = field(default="")
    description: str = field(default="")  # Краткое описание / исходный текст

    # PRD поля (Product Requirements Document)
    problem_statement: str = field(default="")  # Описание проблемы
    solution_description: str = field(default="")  # Описание решения
    target_users: str = field(default="")  # Целевая аудитория
    mvp_scope: str = field(default="")  # Минимальный функционал MVP
    success_metrics: str = field(default="")  # Критерии успеха
    risks: str = field(default="")  # Риски и ограничения
    timeline: str = field(default="")  # Примерные сроки

    # Навыки для реализации
    required_skills: list[str] = field(default_factory=list)  # Указанные автором
    ai_suggested_skills: list[str] = field(default_factory=list)  # Предложенные AI
    ai_suggested_roles: list[str] = field(default_factory=list)  # Роли от AI

    # Статус и видимость
    status: IdeaStatus = field(default=IdeaStatus.DRAFT)
    visibility: IdeaVisibility = field(default=IdeaVisibility.PUBLIC)

    # Связь с компанией/департаментом
    company_id: UUID | None = field(default=None)
    department_id: UUID | None = field(default=None)  # Для dept-restricted идей

    # AI флаги
    prd_generated_by_ai: bool = field(default=False)  # PRD сгенерирован AI
    skills_confidence: float = field(default=0.0)  # Уверенность AI в навыках (0-1)

    # Embedding для семантического поиска
    embedding: list[float] = field(default_factory=list)

    # Статистика взаимодействий
    likes_count: int = field(default=0)
    super_likes_count: int = field(default=0)
    dislikes_count: int = field(default=0)
    views_count: int = field(default=0)
    comments_count: int = field(default=0)
    engagement_time_seconds: int = field(default=0)  # Суммарное время просмотра

    # Рассчитанный IdeaScore (обновляется cron-ом)
    idea_score: float = field(default=0.0)
    score_updated_at: datetime | None = field(default=None)

    # Gamification
    points_awarded: int = field(default=0)  # Очки за идею

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    published_at: datetime | None = field(default=None)

    def __post_init__(self) -> None:
        """Валидация данных при создании."""
        if self.title:
            self._validate_title(self.title)
        if self.description:
            self._validate_description(self.description)

    @staticmethod
    def _validate_title(title: str) -> None:
        """Валидация названия идеи."""
        if len(title) > MAX_TITLE_LENGTH:
            raise InvalidIdeaTitleError(
                f"Title must not exceed {MAX_TITLE_LENGTH} characters"
            )
        if len(title.strip()) < 3:
            raise InvalidIdeaTitleError("Title must be at least 3 characters")

    @staticmethod
    def _validate_description(description: str) -> None:
        """Валидация описания идеи."""
        if len(description) > MAX_DESCRIPTION_LENGTH:
            raise InvalidIdeaDescriptionError(
                f"Description must not exceed {MAX_DESCRIPTION_LENGTH} characters"
            )

    def set_title(self, title: str) -> None:
        """Установить название идеи."""
        self._validate_title(title)
        self.title = title
        self._touch()

    def set_description(self, description: str) -> None:
        """Установить описание идеи."""
        self._validate_description(description)
        self.description = description
        self._touch()

    def add_required_skill(self, skill: str) -> None:
        """Добавить требуемый навык."""
        normalized = skill.strip().lower()
        if normalized and normalized not in self.required_skills:
            if len(self.required_skills) >= MAX_SKILLS_COUNT:
                return
            self.required_skills.append(normalized)
            self._touch()

    def remove_required_skill(self, skill: str) -> None:
        """Удалить требуемый навык."""
        normalized = skill.strip().lower()
        if normalized in self.required_skills:
            self.required_skills.remove(normalized)
            self._touch()

    def set_required_skills(self, skills: list[str]) -> None:
        """Установить список требуемых навыков."""
        self.required_skills = [
            s.strip().lower() for s in skills[:MAX_SKILLS_COUNT] if s.strip()
        ]
        self._touch()

    def set_ai_suggested_skills(
        self, skills: list[str], confidence: float = 0.0
    ) -> None:
        """Установить AI-предложенные навыки."""
        self.ai_suggested_skills = [
            s.strip().lower() for s in skills[:MAX_SKILLS_COUNT] if s.strip()
        ]
        self.skills_confidence = min(max(confidence, 0.0), 1.0)
        self._touch()

    def set_ai_suggested_roles(self, roles: list[str]) -> None:
        """Установить AI-предложенные роли."""
        self.ai_suggested_roles = [r.strip() for r in roles[:10] if r.strip()]
        self._touch()

    def set_prd(
        self,
        problem_statement: str = "",
        solution_description: str = "",
        target_users: str = "",
        mvp_scope: str = "",
        success_metrics: str = "",
        risks: str = "",
        timeline: str = "",
        generated_by_ai: bool = False,
    ) -> None:
        """Установить PRD поля."""
        self.problem_statement = problem_statement[:MAX_PRD_FIELD_LENGTH]
        self.solution_description = solution_description[:MAX_PRD_FIELD_LENGTH]
        self.target_users = target_users[:MAX_PRD_FIELD_LENGTH]
        self.mvp_scope = mvp_scope[:MAX_PRD_FIELD_LENGTH]
        self.success_metrics = success_metrics[:MAX_PRD_FIELD_LENGTH]
        self.risks = risks[:MAX_PRD_FIELD_LENGTH]
        self.timeline = timeline[:MAX_PRD_FIELD_LENGTH]
        self.prd_generated_by_ai = generated_by_ai
        self._touch()

    def has_prd(self) -> bool:
        """Есть ли заполненный PRD."""
        return bool(
            self.problem_statement or self.solution_description or self.mvp_scope
        )

    def publish(self) -> None:
        """Опубликовать идею."""
        if self.status == IdeaStatus.DRAFT:
            self.status = IdeaStatus.ACTIVE
            self.published_at = datetime.now(timezone.utc)
            self._touch()

    def submit_for_review(self) -> None:
        """Отправить на ревью (для компаний)."""
        if self.status == IdeaStatus.DRAFT:
            self.status = IdeaStatus.IN_REVIEW
            self._touch()

    def approve(self) -> None:
        """Одобрить идею (после ревью)."""
        if self.status == IdeaStatus.IN_REVIEW:
            self.status = IdeaStatus.ACTIVE
            self.published_at = datetime.now(timezone.utc)
            self._touch()

    def reject(self) -> None:
        """Отклонить идею (после ревью)."""
        if self.status == IdeaStatus.IN_REVIEW:
            self.status = IdeaStatus.DRAFT
            self._touch()

    def start_team_forming(self) -> None:
        """Начать формирование команды."""
        if self.status == IdeaStatus.ACTIVE:
            self.status = IdeaStatus.TEAM_FORMING
            self._touch()

    def mark_team_formed(self) -> None:
        """Отметить что команда сформирована."""
        if self.status in (IdeaStatus.ACTIVE, IdeaStatus.TEAM_FORMING):
            self.status = IdeaStatus.TEAM_FORMED
            self._touch()

    def archive(self) -> None:
        """Архивировать идею."""
        self.status = IdeaStatus.ARCHIVED
        self._touch()

    def increment_likes(self, is_super: bool = False) -> None:
        """Увеличить счётчик лайков."""
        if is_super:
            self.super_likes_count += 1
        else:
            self.likes_count += 1
        self._touch()

    def increment_dislikes(self) -> None:
        """Увеличить счётчик дизлайков."""
        self.dislikes_count += 1

    def increment_views(self) -> None:
        """Увеличить счётчик просмотров."""
        self.views_count += 1

    def add_engagement_time(self, seconds: int) -> None:
        """Добавить время вовлечённости."""
        self.engagement_time_seconds += max(0, seconds)

    def increment_comments(self) -> None:
        """Увеличить счётчик комментариев."""
        self.comments_count += 1
        self._touch()

    def calculate_score(self, author_reputation: float = 1.0) -> float:
        """
        Рассчитать IdeaScore.
        Формула: 0.4×LikeRatio + 0.3×SuperLikeCount + 0.2×EngagementTime + 0.1×AuthorReputation
        """
        total_votes = self.likes_count + self.super_likes_count + self.dislikes_count
        like_ratio = (
            (self.likes_count + self.super_likes_count) / total_votes
            if total_votes > 0
            else 0.5
        )

        # Нормализуем super_likes (max 100 для score=1)
        super_like_score = min(self.super_likes_count / 100, 1.0)

        # Нормализуем время вовлечённости (max 1 час суммарно)
        engagement_score = min(self.engagement_time_seconds / 3600, 1.0)

        # Рассчитываем итоговый score
        score = (
            0.4 * like_ratio
            + 0.3 * super_like_score
            + 0.2 * engagement_score
            + 0.1 * min(author_reputation, 1.0)
        )

        self.idea_score = round(score, 4)
        self.score_updated_at = datetime.now(timezone.utc)
        return self.idea_score

    def set_embedding(self, embedding: list[float]) -> None:
        """Установить embedding для семантического поиска."""
        self.embedding = embedding
        self._touch()

    def _touch(self) -> None:
        """Обновить timestamp."""
        self.updated_at = datetime.now(timezone.utc)

    def get_all_skills(self) -> list[str]:
        """Получить все навыки (требуемые + AI)."""
        all_skills = set(self.required_skills)
        all_skills.update(self.ai_suggested_skills)
        return list(all_skills)

    def get_searchable_text(self) -> str:
        """Получить текст для индексации и поиска."""
        parts = [
            self.title,
            self.description,
            self.problem_statement,
            self.solution_description,
            self.target_users,
            self.mvp_scope,
            " ".join(self.required_skills),
            " ".join(self.ai_suggested_skills),
        ]
        return " ".join(filter(None, parts))

    def get_prd_text(self) -> str:
        """Получить полный текст PRD."""
        sections = []
        if self.problem_statement:
            sections.append(f"Проблема: {self.problem_statement}")
        if self.solution_description:
            sections.append(f"Решение: {self.solution_description}")
        if self.target_users:
            sections.append(f"Целевая аудитория: {self.target_users}")
        if self.mvp_scope:
            sections.append(f"MVP: {self.mvp_scope}")
        if self.success_metrics:
            sections.append(f"Метрики успеха: {self.success_metrics}")
        if self.risks:
            sections.append(f"Риски: {self.risks}")
        if self.timeline:
            sections.append(f"Сроки: {self.timeline}")
        return "\n\n".join(sections)

    @property
    def is_active(self) -> bool:
        """Активна ли идея для свайпов."""
        return self.status in (IdeaStatus.ACTIVE, IdeaStatus.TEAM_FORMING)

    @property
    def can_be_edited(self) -> bool:
        """Можно ли редактировать идею."""
        return self.status in (
            IdeaStatus.DRAFT,
            IdeaStatus.ACTIVE,
            IdeaStatus.IN_REVIEW,
        )
