from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ============ User Schemas ============


class UserBase(BaseModel):
    """Базовая схема пользователя."""

    first_name: str = Field(default="", max_length=100)
    last_name: str = Field(default="", max_length=100)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=200)


class UserCreate(BaseModel):
    """Схема создания пользователя."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    first_name: str = Field(default="", max_length=100)
    last_name: str = Field(default="", max_length=100)


class UserUpdate(BaseModel):
    """Схема обновления профиля."""

    first_name: str | None = Field(default=None, max_length=100, examples=["Иван"])
    last_name: str | None = Field(default=None, max_length=100, examples=["Иванов"])
    avatar_url: str | None = Field(
        default=None, examples=["https://example.com/avatar.jpg"]
    )
    bio: str | None = Field(
        default=None, max_length=2000, examples=["Разработчик с 5-летним опытом"]
    )
    location: str | None = Field(default=None, max_length=200, examples=["Москва"])


class EmailUpdate(BaseModel):
    """Схема обновления email."""

    email: EmailStr = Field(description="Новый email адрес")


class EmailVerificationRequest(BaseModel):
    """Запрос на отправку кода верификации email."""

    email: EmailStr = Field(description="Email для верификации")


class EmailVerificationConfirm(BaseModel):
    """Подтверждение email с кодом."""

    code: str = Field(
        min_length=6, max_length=6, description="6-значный код подтверждения"
    )


class EmailVerificationResponse(BaseModel):
    """Ответ на запрос верификации."""

    message: str = Field(description="Сообщение о результате")
    email: str | None = Field(
        default=None,
        description="Подтверждённый email (только после успешной верификации)",
    )


class ContactInfo(BaseModel):
    """Информация о контакте."""

    type: str
    value: str
    is_primary: bool = False
    is_visible: bool = True


class UserContactAdd(BaseModel):
    """Добавление контакта пользователя в профиль."""

    type: str = Field(
        pattern="^(telegram|whatsapp|vk|messenger|email|phone|linkedin|github|instagram|tiktok|slack)$",
        examples=["telegram"],
    )
    value: str = Field(max_length=200, examples=["@username"])
    is_primary: bool = False
    is_visible: bool = True


class UserContactUpdate(BaseModel):
    """Обновление видимости контакта."""

    is_visible: bool


class UserContactDelete(BaseModel):
    """Удаление контакта."""

    type: str
    value: str


class ProfileVisibilityUpdate(BaseModel):
    """Обновление видимости профиля."""

    is_public: bool = Field(
        description="True - публичный профиль (виден всем), False - приватный (только внутри компании)"
    )


class TagInfo(BaseModel):
    """Информация о теге."""

    id: UUID
    name: str
    category: str
    proficiency: int = 1


class UserResponse(BaseModel):
    """Полная информация о пользователе."""

    id: UUID
    first_name: str
    last_name: str
    email: str
    avatar_url: str | None
    telegram_id: int | None = None
    telegram_username: str | None = None
    location: str | None
    bio: str | None
    ai_generated_bio: str | None
    status: str
    tags: list[TagInfo]
    search_tags: list[str]
    contacts: list[ContactInfo]
    random_facts: list[str]
    profile_completeness: int
    is_public: bool = True


class UserPublicResponse(BaseModel):
    """Публичная информация о пользователе (без приватных данных)."""

    id: UUID
    first_name: str
    last_name: str
    avatar_url: str | None
    bio: str | None
    ai_generated_bio: str | None
    location: str | None
    tags: list[TagInfo]
    search_tags: list[str]
    contacts: list[ContactInfo] = []  # Публичные контакты (is_visible=True)
    profile_completeness: int


# ============ Random Facts ============


class RandomFactAdd(BaseModel):
    """Добавление рандомного факта."""

    fact: str = Field(max_length=500)


class RandomFactsUpdate(BaseModel):
    """Обновление списка рандомных фактов."""

    facts: list[str] = Field(max_items=10)


# ============ Search Tags ============


class SearchTagsUpdate(BaseModel):
    """Обновление тегов для поиска."""

    tags: list[str]


# ============ AI Tag Suggestions ============


class SuggestedTagResponse(BaseModel):
    """Предложенный тег от AI."""

    name: str
    category: str
    confidence: float  # 0-1
    reason: str


class TagSuggestionsResponse(BaseModel):
    """Список предложенных тегов."""

    suggestions: list[SuggestedTagResponse]
    bio_used: str


class ApplyTagsRequest(BaseModel):
    """Запрос на применение выбранных тегов."""

    selected_tags: list[str] = Field(min_length=1, max_length=15)
    bio: str | None = None  # Опционально обновить bio


# ============ Search ============


class SearchRequest(BaseModel):
    """Запрос на поиск."""

    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=20, ge=1, le=100)
    include_users: bool = True
    include_contacts: bool = True
    company_ids: list[UUID] | None = Field(
        default=None,
        description="Фильтр по компаниям. Если указан, ищет только среди членов этих компаний.",
    )


class SearchCardContactInfo(BaseModel):
    """Информация о контакте в поиске."""

    type: str
    value: str
    is_primary: bool = False


class SearchCardResult(BaseModel):
    """Карточка в результатах поиска."""

    id: UUID
    owner_id: UUID
    display_name: str
    # Резервные поля для имени владельца (если display_name пустой)
    owner_first_name: str = ""
    owner_last_name: str = ""
    avatar_url: str | None = None
    bio: str | None = None
    ai_generated_bio: str | None = None
    search_tags: list[str] = []
    contacts: list[SearchCardContactInfo] = []
    completeness: int = 0


class SearchResult(BaseModel):
    """Результат поиска."""

    users: list[UserPublicResponse]  # deprecated, оставлено для совместимости
    cards: list[SearchCardResult] = []  # визитные карточки
    contacts: list["SavedContactResponse"]
    query: str
    expanded_tags: list[str] = Field(
        default_factory=list,
        description="Расширенные теги после ассоциативного анализа",
    )
    total_count: int


class SearchSuggestionsResponse(BaseModel):
    """Подсказки для поиска."""

    query: str
    suggestions: list[str]


# ============ QR Code ============


class QRCodeResponse(BaseModel):
    """Ответ с QR-кодом."""

    image_base64: str
    image_format: str = "png"


class QRCodeType(BaseModel):
    """Тип QR-кода."""

    type: str = Field(default="profile", pattern="^(profile|vcard)$")


# ============ Saved Contact Schemas ============


class SavedContactCreate(BaseModel):
    """Сохранение контакта пользователя."""

    user_id: UUID  # ID владельца карточки
    card_id: UUID | None = None  # ID конкретной карточки (опционально)
    search_tags: list[str] = []
    notes: str | None = None


class ManualContactCreate(BaseModel):
    """Добавление контакта вручную."""

    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    phone: str | None = None
    email: EmailStr | None = None
    messenger_type: str | None = Field(
        default=None,
        pattern="^(telegram|whatsapp|vk|messenger)$",
        description="Тип мессенджера",
    )
    messenger_value: str | None = Field(
        default=None,
        max_length=200,
        description="Username или номер в мессенджере",
    )
    notes: str | None = Field(default=None, max_length=1000)
    search_tags: list[str] = Field(default_factory=list)
    name: str | None = Field(
        default=None, max_length=200, description="Legacy: полное имя"
    )


class SavedContactUpdate(BaseModel):
    """Обновление контакта."""

    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = None
    email: EmailStr | None = None
    messenger_type: str | None = Field(
        default=None,
        pattern="^(telegram|whatsapp|vk|messenger)$",
    )
    messenger_value: str | None = None
    notes: str | None = None
    search_tags: list[str] | None = None


class SavedContactResponse(BaseModel):
    """Информация о сохраненном контакте."""

    id: UUID
    owner_id: UUID
    saved_user_id: UUID | None
    saved_card_id: UUID | None = None  # ID конкретной карточки
    name: str  # Legacy: full_name
    first_name: str
    last_name: str
    phone: str | None
    email: str | None
    avatar_url: str | None = None
    contacts: list[ContactInfo] = []  # Контакты для связи
    messenger_type: str | None
    messenger_value: str | None
    notes: str | None
    search_tags: list[str]
    source: str
    created_at: datetime
    updated_at: datetime


# ============ Contact Import ============


class ImportContactItem(BaseModel):
    """Контакт для импорта."""

    name: str
    phone: str | None = None
    email: EmailStr | None = None


class ContactImportRequest(BaseModel):
    """Запрос на импорт контактов."""

    contacts: list[ImportContactItem]


class ImportResult(BaseModel):
    """Результат импорта."""

    imported_count: int
    skipped_count: int
    errors: list[str]


# ============ Contact Sync (Enterprise/Privacy-First) ============


class HashedContactItem(BaseModel):
    """Хешированный контакт для синхронизации."""

    name: str = Field(max_length=200)
    hash: str = Field(
        min_length=64, max_length=64, description="SHA-256 hash номера телефона"
    )


class ContactSyncRequest(BaseModel):
    """Запрос на синхронизацию контактов по хешам."""

    hashed_contacts: list[HashedContactItem] = Field(max_length=1000)


class FoundUserInfo(BaseModel):
    """Информация о найденном пользователе."""

    id: UUID
    name: str
    avatar_url: str | None = None


class FoundContact(BaseModel):
    """Найденный контакт при синхронизации."""

    hash: str
    original_name: str
    user: FoundUserInfo


class ContactSyncResponse(BaseModel):
    """Результат синхронизации контактов."""

    found: list[FoundContact]
    found_count: int
    pending_count: int


# ============ AI Bio ============


class GenerateBioRequest(BaseModel):
    """Запрос на генерацию самопрезентации."""

    pass  # Генерируется на основе данных пользователя


# ============ Contact Tags Generation ============


class GenerateContactTagsRequest(BaseModel):
    """Запрос на генерацию тегов из заметок о контакте."""

    notes: str = Field(min_length=3, max_length=2000)


class GenerateContactTagsResponse(BaseModel):
    """Ответ с сгенерированными тегами для контакта."""

    tags: list[str]


class GenerateBioFromFactsRequest(BaseModel):
    """Генерация из списка фактов."""

    facts: list[str] = Field(max_items=10)
    name: str


class GeneratedBioResponse(BaseModel):
    """Сгенерированная самопрезентация."""

    bio: str


# ============ Avatar Upload ============


class AvatarUploadResponse(BaseModel):
    """Результат загрузки аватарки."""

    avatar_url: str


# Обновляем forward reference
SearchResult.model_rebuild()
