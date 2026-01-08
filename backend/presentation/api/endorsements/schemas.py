"""Pydantic schemas для подтверждений навыков."""

from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class EndorserInfo(BaseModel):
    """Информация о пользователе, который подтвердил навык."""

    id: UUID
    name: str
    avatar_url: str | None = None


class SkillEndorsementCreate(BaseModel):
    """Схема для создания подтверждения навыка."""

    card_id: UUID = Field(..., description="ID карточки с навыком")
    tag_id: UUID = Field(..., description="ID навыка для подтверждения")


class SkillEndorsementResponse(BaseModel):
    """Ответ при создании/получении подтверждения."""

    id: UUID
    endorser_id: UUID
    card_id: UUID
    tag_id: UUID
    tag_name: str
    tag_category: str | None = None
    card_owner_id: UUID
    created_at: datetime
    endorser_name: str
    endorser_avatar_url: str | None = None


class SkillWithEndorsementsResponse(BaseModel):
    """Навык с информацией о подтверждениях."""

    tag_id: UUID
    tag_name: str
    tag_category: str | None = None
    proficiency: int
    endorsement_count: int = Field(..., description="Общее количество подтверждений")
    endorsed_by_current_user: bool = Field(
        default=False, description="Подтвердил ли текущий пользователь этот навык"
    )
    endorsers: list[EndorserInfo] = Field(
        default_factory=list,
        description="Список пользователей, подтвердивших навык (до 5)",
    )


class CardSkillsWithEndorsementsResponse(BaseModel):
    """Все навыки карточки с подтверждениями."""

    card_id: UUID
    skills: list[SkillWithEndorsementsResponse]


class ToggleEndorsementResponse(BaseModel):
    """Ответ на toggle операцию."""

    is_endorsed: bool = Field(..., description="Текущее состояние: True = лайк стоит")
    endorsement: SkillEndorsementResponse | None = Field(
        default=None, description="Объект подтверждения если был создан"
    )
    endorsement_count: int = Field(..., description="Новое количество подтверждений")


class MyEndorsementsResponse(BaseModel):
    """Список подтверждений пользователя."""

    endorsements: list[SkillEndorsementResponse]
    total: int


class ContactEndorsersResponse(BaseModel):
    """Подтверждения от контактов пользователя."""

    card_id: UUID
    tag_id: UUID
    tag_name: str
    endorsers_from_contacts: list[EndorserInfo]
    total_from_contacts: int
    message: str = Field(
        ..., description="Например: '3 из ваших контактов подтвердили этот навык'"
    )
