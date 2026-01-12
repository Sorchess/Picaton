"""Pydantic schemas для API идей (Фабрика Идей)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ============ Request Schemas ============


class CreateIdeaRequest(BaseModel):
    """Запрос на создание идеи."""

    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., max_length=5000)
    required_skills: list[str] = Field(default_factory=list, max_length=20)
    visibility: str = Field(default="public")  # public, company, department, private
    company_id: UUID | None = None
    department_id: UUID | None = None


class CreateIdeaFromVoiceRequest(BaseModel):
    """Запрос на создание идеи из голосового ввода."""

    transcript: str = Field(..., min_length=10, max_length=10000)
    visibility: str = Field(default="public")
    company_id: UUID | None = None
    department_id: UUID | None = None


class GeneratePRDRequest(BaseModel):
    """Запрос на генерацию PRD."""

    raw_input: str = Field(..., min_length=10, max_length=10000)
    input_type: str = Field(default="text", pattern="^(text|voice_transcript)$")
    context: str | None = None


class UpdateIdeaRequest(BaseModel):
    """Запрос на обновление идеи."""

    title: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = Field(None, max_length=5000)
    required_skills: list[str] | None = Field(None, max_length=20)
    visibility: str | None = None
    # PRD поля
    problem_statement: str | None = Field(None, max_length=3000)
    solution_description: str | None = Field(None, max_length=3000)
    target_users: str | None = Field(None, max_length=3000)
    mvp_scope: str | None = Field(None, max_length=3000)
    success_metrics: str | None = Field(None, max_length=3000)
    risks: str | None = Field(None, max_length=3000)
    timeline: str | None = Field(None, max_length=3000)


class SwipeRequest(BaseModel):
    """Запрос на свайп."""

    idea_id: UUID
    direction: str = Field(..., pattern="^(like|dislike|super_like)$")
    feedback: str | None = Field(None, max_length=1000)  # Опциональный комментарий
    engagement_time_seconds: int | None = Field(None, ge=0, le=600)  # Время просмотра


class AddCommentRequest(BaseModel):
    """Запрос на добавление комментария."""

    content: str = Field(..., min_length=1, max_length=1000)
    is_question: bool = False


# ============ Response Schemas ============


class IdeaAuthorResponse(BaseModel):
    """Информация об авторе идеи."""

    id: UUID
    first_name: str
    last_name: str
    avatar_url: str | None = None
    reputation: float | None = None


class PRDResponse(BaseModel):
    """PRD данные идеи."""

    problem_statement: str
    solution_description: str
    target_users: str
    mvp_scope: str
    success_metrics: str
    risks: str
    timeline: str
    generated_by_ai: bool


class IdeaResponse(BaseModel):
    """Ответ с данными идеи."""

    id: UUID
    author_id: UUID
    author: IdeaAuthorResponse | None = None
    title: str
    description: str
    # PRD
    prd: PRDResponse | None = None
    # Навыки
    required_skills: list[str]
    ai_suggested_skills: list[str]
    ai_suggested_roles: list[str] = []
    skills_confidence: float = 0.0
    # Статус
    status: str
    visibility: str
    company_id: UUID | None = None
    department_id: UUID | None = None
    # Статистика
    likes_count: int
    super_likes_count: int
    dislikes_count: int = 0
    views_count: int
    comments_count: int = 0
    # Score
    idea_score: float = 0.0
    # Timestamps
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None

    class Config:
        from_attributes = True


class IdeaListResponse(BaseModel):
    """Список идей."""

    ideas: list[IdeaResponse]
    total: int


class LeaderboardIdeaResponse(BaseModel):
    """Идея в таблице лидеров."""

    id: UUID
    title: str
    author: IdeaAuthorResponse
    idea_score: float
    likes_count: int
    super_likes_count: int
    rank: int


class IdeaLeaderboardResponse(BaseModel):
    """Таблица лидеров идей."""

    ideas: list[LeaderboardIdeaResponse]
    period: str  # all, weekly, monthly


class SwipeResponse(BaseModel):
    """Ответ на свайп."""

    swipe_id: UUID
    idea_id: UUID
    direction: str
    is_match: bool = False
    match_user_ids: list[UUID] | None = None
    # Gamification
    points_earned: int = 0
    new_badges: list[str] = []
    current_streak: int = 0


class CommentResponse(BaseModel):
    """Комментарий к идее."""

    id: UUID
    idea_id: UUID
    author_id: UUID
    author_name: str
    author_avatar: str | None = None
    content: str
    is_question: bool
    created_at: datetime


class CommentListResponse(BaseModel):
    """Список комментариев."""

    comments: list[CommentResponse]
    total: int


class MatchedExpertResponse(BaseModel):
    """Подобранный эксперт."""

    user_id: UUID
    card_id: UUID
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    matching_skills: list[str]
    all_skills: list[str]
    match_score: float


class TeamSuggestionResponse(BaseModel):
    """Предложение по составу команды."""

    experts: list[MatchedExpertResponse]
    coverage: dict[str, list[str]]
    missing_skills: list[str]
    team_score: float


class IdeaAnalysisResponse(BaseModel):
    """Результат AI-анализа идеи."""

    skills: list[str]
    roles: list[str]
    priority_skills: list[str]


class GeneratedPRDResponse(BaseModel):
    """Результат генерации PRD."""

    title: str
    problem_statement: str
    solution_description: str
    target_users: str
    mvp_scope: str
    success_metrics: str
    risks: str
    timeline: str
    required_skills: list[str]
    roles: list[str]
    confidence: float


class LikeInfoResponse(BaseModel):
    """Информация о лайке на идею."""

    user_id: UUID
    idea_id: UUID
    idea_title: str
    created_at: datetime


# ============ Gamification Schemas ============


class UserGamificationResponse(BaseModel):
    """Геймификация пользователя."""

    total_points: int
    weekly_points: int
    monthly_points: int
    level: int
    badges: list[str]
    current_voting_streak: int
    max_voting_streak: int
    reputation: float
    # Статистика
    ideas_count: int
    swipes_count: int
    projects_count: int
    completed_projects_count: int


class LeaderboardEntryResponse(BaseModel):
    """Запись в таблице лидеров."""

    user_id: UUID
    display_name: str
    avatar_url: str | None
    points: int
    level: int
    badges_count: int
    rank: int


class LeaderboardResponse(BaseModel):
    """Таблица лидеров пользователей."""

    entries: list[LeaderboardEntryResponse]
    period: str
    my_rank: int | None = None
