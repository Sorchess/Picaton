"""
Pydantic схемы для API корпоративных карточек.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# === Tag Settings Schemas ===

class TagFieldSettingsSchema(BaseModel):
    """Настройки одного поля тега."""
    
    is_required: bool = Field(default=False, description="Обязательно ли поле")
    is_enabled: bool = Field(default=True, description="Включено ли поле")
    display_name: str | None = Field(default=None, description="Отображаемое название")
    placeholder: str | None = Field(default=None, description="Подсказка")
    options: list[str] = Field(default_factory=list, description="Варианты для выбора")
    restrict_to_options: bool = Field(
        default=False, 
        description="Ограничить значения только вариантами из списка"
    )


class TagFieldSettingsUpdateSchema(BaseModel):
    """Обновление настроек поля тега."""
    
    is_required: bool | None = None
    is_enabled: bool | None = None
    display_name: str | None = None
    placeholder: str | None = None
    options: list[str] | None = None
    restrict_to_options: bool | None = None


class CompanyTagSettingsSchema(BaseModel):
    """Полные настройки тегов компании."""
    
    id: UUID
    company_id: UUID
    company_tag: TagFieldSettingsSchema
    position_tag: TagFieldSettingsSchema
    department_tag: TagFieldSettingsSchema
    custom_tags: dict[str, TagFieldSettingsSchema]
    created_at: datetime
    updated_at: datetime


class UpdateTagSettingsRequest(BaseModel):
    """Запрос на обновление настроек тегов."""
    
    company_tag: TagFieldSettingsUpdateSchema | None = None
    position_tag: TagFieldSettingsUpdateSchema | None = None
    department_tag: TagFieldSettingsUpdateSchema | None = None


class AddCustomTagRequest(BaseModel):
    """Запрос на добавление кастомного тега."""
    
    tag_id: str = Field(..., description="Уникальный ID тега", min_length=1, max_length=50)
    display_name: str = Field(..., description="Отображаемое название", min_length=1, max_length=100)
    is_required: bool = Field(default=False, description="Обязательность")
    placeholder: str | None = Field(default=None, description="Подсказка", max_length=200)
    options: list[str] | None = Field(default=None, description="Варианты для выбора")
    restrict_to_options: bool = Field(default=False, description="Ограничить значения списком")


class UpdateCustomTagRequest(BaseModel):
    """Запрос на обновление кастомного тега."""
    
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    is_required: bool | None = None
    placeholder: str | None = Field(default=None, max_length=200)
    options: list[str] | None = None
    restrict_to_options: bool | None = None


# === Contact Schema ===

class ContactSchema(BaseModel):
    """Схема контакта."""
    
    type: str = Field(..., description="Тип контакта")
    value: str = Field(..., description="Значение контакта")
    label: str | None = Field(default=None, description="Метка")
    is_primary: bool = Field(default=False, description="Основной контакт")


class AddContactRequest(BaseModel):
    """Запрос на добавление контакта."""
    
    type: str = Field(..., description="Тип контакта (email, phone, telegram, etc.)")
    value: str = Field(..., description="Значение контакта")
    label: str | None = Field(default=None, description="Метка")
    is_primary: bool = Field(default=False, description="Основной контакт")


# === Tag Schema ===

class TagSchema(BaseModel):
    """Схема тега."""
    
    id: UUID | None = None
    name: str
    category: str | None = None


class AddTagRequest(BaseModel):
    """Запрос на добавление тега."""
    
    name: str = Field(..., description="Название тега", min_length=1, max_length=100)
    category: str | None = Field(default=None, description="Категория тега")


# === Company Card Schemas ===

class CompanyCardSchema(BaseModel):
    """Полная схема корпоративной карточки."""
    
    id: UUID
    company_id: UUID
    member_id: UUID
    user_id: UUID
    
    # Корпоративные теги
    company_name: str
    position: str | None
    department: str | None
    
    # Профиль
    display_name: str
    avatar_url: str | None
    bio: str | None
    ai_generated_bio: str | None
    
    # Контакты и теги
    contacts: list[ContactSchema]
    tags: list[TagSchema]
    custom_tag_values: dict[str, str]
    
    # Статус
    is_active: bool
    is_public: bool
    completeness: int
    
    # Timestamps
    created_at: datetime
    updated_at: datetime


class CompanyCardListSchema(BaseModel):
    """Карточка в списке (краткая информация)."""
    
    id: UUID
    user_id: UUID
    display_name: str
    avatar_url: str | None
    position: str | None
    department: str | None
    completeness: int
    is_active: bool


class CreateCompanyCardRequest(BaseModel):
    """Запрос на создание карточки."""
    
    display_name: str = Field(..., min_length=1, max_length=100)
    position: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=2000)
    custom_tag_values: dict[str, str] | None = None


class UpdateCompanyCardRequest(BaseModel):
    """Запрос на обновление карточки."""
    
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    position: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=2000)
    custom_tag_values: dict[str, str] | None = None


class SetVisibilityRequest(BaseModel):
    """Запрос на изменение видимости карточки."""
    
    is_public: bool = Field(..., description="Видна ли карточка вне компании")


class SearchCardsRequest(BaseModel):
    """Запрос на поиск карточек."""
    
    query: str | None = Field(default=None, description="Текстовый поиск")
    tags: list[str] | None = Field(default=None, description="Фильтр по тегам")
    position: str | None = Field(default=None, description="Фильтр по должности")
    department: str | None = Field(default=None, description="Фильтр по отделу")
    limit: int = Field(default=50, ge=1, le=200)


class CompanyCardListResponse(BaseModel):
    """Ответ со списком карточек."""
    
    cards: list[CompanyCardListSchema]
    total: int
    limit: int
    offset: int
