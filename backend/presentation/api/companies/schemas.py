"""Pydantic схемы для API компаний."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr

from domain.enums.company import InvitationStatus


# ==================== Company ====================


class CreateCompanyRequest(BaseModel):
    """Запрос на создание компании."""

    name: str = Field(
        ..., min_length=2, max_length=100, description="Название компании"
    )
    email_domain: str = Field(
        ..., min_length=3, max_length=255, description="Домен email компании"
    )
    logo_url: str | None = Field(None, max_length=500, description="URL логотипа")
    description: str | None = Field(
        None, max_length=1000, description="Описание компании"
    )
    allow_auto_join: bool = Field(
        False, description="Разрешить автоматическое вступление по домену email"
    )


class UpdateCompanyRequest(BaseModel):
    """Запрос на обновление компании."""

    name: str | None = Field(
        None, min_length=2, max_length=100, description="Название компании"
    )
    logo_url: str | None = Field(None, max_length=500, description="URL логотипа")
    description: str | None = Field(
        None, max_length=1000, description="Описание компании"
    )
    allow_auto_join: bool | None = Field(
        None, description="Разрешить автоматическое вступление"
    )


class CompanyResponse(BaseModel):
    """Ответ с данными компании."""

    id: UUID
    name: str
    email_domain: str
    logo_url: str | None = None
    description: str | None = None
    owner_id: UUID | None = None
    allow_auto_join: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CompanyRoleInfo(BaseModel):
    """Информация о роли в компании."""

    id: UUID
    name: str
    color: str = "#808080"
    priority: int = 100
    is_system: bool = False

    class Config:
        from_attributes = True


class CompanyWithRoleResponse(BaseModel):
    """Компания с ролью пользователя."""

    company: CompanyResponse
    role: CompanyRoleInfo | None = None
    joined_at: datetime


# ==================== Members ====================


class MemberUserInfo(BaseModel):
    """Базовая информация о пользователе-члене."""

    id: UUID
    first_name: str
    last_name: str
    email: str
    avatar_url: str | None = None


class CompanyMemberResponse(BaseModel):
    """Ответ с данными члена компании."""

    id: UUID
    user: MemberUserInfo
    role: CompanyRoleInfo | None = None
    selected_card_id: UUID | None = None
    joined_at: datetime


class UpdateMemberRoleRequest(BaseModel):
    """Запрос на изменение роли члена."""

    role_id: UUID = Field(..., description="ID новой роли")


# ==================== Invitations ====================


class CreateInvitationRequest(BaseModel):
    """Запрос на создание приглашения."""

    email: EmailStr = Field(..., description="Email приглашаемого")
    role_id: UUID | None = Field(
        None, description="ID роли в компании (None = роль по умолчанию)"
    )


class InvitationResponse(BaseModel):
    """Ответ с данными приглашения."""

    id: UUID
    company_id: UUID
    email: str
    role: CompanyRoleInfo
    invited_by_id: UUID | None = None
    status: InvitationStatus
    created_at: datetime
    expires_at: datetime | None = None

    class Config:
        from_attributes = True


class InvitationWithCompanyResponse(BaseModel):
    """Приглашение с данными компании."""

    id: UUID
    company: CompanyResponse
    role: CompanyRoleInfo
    invited_by: MemberUserInfo | None = None
    status: InvitationStatus
    token: str
    created_at: datetime
    expires_at: datetime | None = None


class AcceptInvitationRequest(BaseModel):
    """Запрос на принятие приглашения."""

    token: str = Field(..., description="Токен приглашения")


class DeclineInvitationRequest(BaseModel):
    """Запрос на отклонение приглашения."""

    token: str = Field(..., description="Токен приглашения")


# ==================== Card Selection ====================


class SetSelectedCardRequest(BaseModel):
    """Запрос на установку выбранной визитки для компании."""

    card_id: UUID | None = Field(None, description="ID визитки (или None для сброса)")


class CompanyCardAssignment(BaseModel):
    """Информация о выбранной визитке для компании."""

    company_id: UUID
    company_name: str
    selected_card_id: UUID | None = None


# ==================== Generic ====================


class MessageResponse(BaseModel):
    """Простой ответ с сообщением."""

    message: str
    success: bool = True
