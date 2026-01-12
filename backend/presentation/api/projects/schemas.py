"""Pydantic schemas для API проектов."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ============ Request Schemas ============


class CreateProjectRequest(BaseModel):
    """Запрос на создание проекта."""

    name: str = Field(..., min_length=2, max_length=200)
    description: str = Field(default="", max_length=5000)
    idea_id: UUID | None = None
    company_id: UUID | None = None
    is_public: bool = True
    allow_join_requests: bool = True


class UpdateProjectRequest(BaseModel):
    """Запрос на обновление проекта."""

    name: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = Field(None, max_length=5000)
    is_public: bool | None = None
    allow_join_requests: bool | None = None


class InviteMemberRequest(BaseModel):
    """Запрос на приглашение участника."""

    user_id: UUID
    message: str | None = Field(None, max_length=500)


class JoinRequestRequest(BaseModel):
    """Запрос на вступление в проект."""

    message: str | None = Field(None, max_length=500)


class UpdateMemberRequest(BaseModel):
    """Запрос на обновление участника."""

    position: str | None = Field(None, max_length=100)
    skills: list[str] | None = Field(None, max_length=10)


# ============ Response Schemas ============


class ProjectMemberResponse(BaseModel):
    """Информация об участнике проекта."""

    id: UUID
    project_id: UUID
    user_id: UUID
    role: str
    position: str | None = None
    skills: list[str] = []
    joined_at: datetime
    # User info (populated separately)
    user_name: str | None = None
    user_avatar_url: str | None = None

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    """Ответ с данными проекта."""

    id: UUID
    idea_id: UUID | None = None
    name: str
    description: str
    owner_id: UUID
    status: str
    company_id: UUID | None = None
    avatar_url: str | None = None
    is_public: bool
    allow_join_requests: bool
    members_count: int
    created_at: datetime
    updated_at: datetime
    # Additional fields
    is_member: bool = False
    my_role: str | None = None
    unread_count: int = 0

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Список проектов."""

    projects: list[ProjectResponse]
    total: int


class ProjectDetailResponse(ProjectResponse):
    """Детальная информация о проекте."""

    members: list[ProjectMemberResponse] = []
    idea_title: str | None = None


class InvitationResponse(BaseModel):
    """Информация о приглашении."""

    id: UUID
    project_id: UUID
    project_name: str
    invited_by: UUID | None = None
    inviter_name: str | None = None
    message: str | None = None
    created_at: datetime
