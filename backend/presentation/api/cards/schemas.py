"""Pydantic schemas для визитных карточек."""

from uuid import UUID

from pydantic import BaseModel, Field


# ============ Contact Info ============


class CardContactInfo(BaseModel):
    """Информация о контакте карточки."""

    type: str
    value: str
    is_primary: bool = False
    is_visible: bool = True


class CardContactAdd(BaseModel):
    """Добавление контакта в карточку."""

    type: str = Field(
        pattern="^(telegram|whatsapp|vk|messenger|email|phone|linkedin|github|instagram|tiktok|slack)$",
        examples=["telegram"],
    )
    value: str = Field(max_length=200, examples=["@username"])
    is_primary: bool = False
    is_visible: bool = True


class CardContactUpdate(BaseModel):
    """Обновление видимости контакта."""

    is_visible: bool


# ============ Tag Info ============


class CardTagInfo(BaseModel):
    """Информация о теге."""

    id: UUID
    name: str
    category: str
    proficiency: int = 1


# ============ Business Card Schemas ============


class BusinessCardCreate(BaseModel):
    """Схема создания визитной карточки."""

    title: str = Field(default="Основная", max_length=100, examples=["Рабочая"])
    display_name: str = Field(default="", max_length=200, examples=["Иван Иванов"])
    is_primary: bool = False


class BusinessCardUpdate(BaseModel):
    """Схема обновления визитной карточки."""

    title: str | None = Field(default=None, max_length=100, examples=["Рабочая"])
    display_name: str | None = Field(
        default=None, max_length=200, examples=["Иван Иванов"]
    )
    avatar_url: str | None = Field(
        default=None, examples=["https://example.com/avatar.jpg"]
    )
    bio: str | None = Field(
        default=None, max_length=2000, examples=["Разработчик с 5-летним опытом"]
    )
    is_active: bool | None = None


class BusinessCardResponse(BaseModel):
    """Полная информация о визитной карточке."""

    id: UUID
    owner_id: UUID
    title: str
    is_primary: bool
    is_active: bool
    display_name: str
    avatar_url: str | None
    bio: str | None
    ai_generated_bio: str | None
    tags: list[CardTagInfo]
    search_tags: list[str]
    contacts: list[CardContactInfo]
    random_facts: list[str]
    completeness: int


class BusinessCardPublicResponse(BaseModel):
    """Публичная информация о визитной карточке."""

    id: UUID
    owner_id: UUID
    title: str
    display_name: str
    avatar_url: str | None
    bio: str | None
    ai_generated_bio: str | None
    tags: list[CardTagInfo]
    search_tags: list[str]
    contacts: list[CardContactInfo] = []  # Только is_visible=True
    completeness: int


class BusinessCardListResponse(BaseModel):
    """Список визитных карточек."""

    cards: list[BusinessCardResponse]
    total: int


# ============ Search Tags ============


class CardSearchTagsUpdate(BaseModel):
    """Обновление тегов для поиска."""

    tags: list[str]


# ============ Random Facts ============


class CardRandomFactAdd(BaseModel):
    """Добавление рандомного факта."""

    fact: str = Field(max_length=500)


# ============ AI Bio ============


class CardGeneratedBioResponse(BaseModel):
    """Ответ с AI-сгенерированной презентацией."""

    bio: str
    card_id: UUID


# ============ Tag Suggestions ============


class CardSuggestedTag(BaseModel):
    """Предложенный тег от AI."""

    name: str
    category: str
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str


class CardTagSuggestionsResponse(BaseModel):
    """Ответ с предложенными тегами."""

    suggestions: list[CardSuggestedTag]
    bio_used: str
    card_id: UUID


# ============ QR Code ============


class CardQRCodeResponse(BaseModel):
    """Ответ с QR-кодом карточки."""

    image_base64: str
    card_id: UUID


# ============ Text Tags Generation (Groq) ============


class TextTagGenerationRequest(BaseModel):
    """Запрос на генерацию тегов из произвольного текста."""

    text: str = Field(
        min_length=10,
        max_length=1000,
        examples=["Я занимаюсь веб-разработкой, работаю с React и Python..."],
    )


class TextTagGenerationResponse(BaseModel):
    """Ответ с сгенерированными тегами из текста."""

    suggestions: list[str] = Field(
        description="Список предложенных search_tags",
        examples=[["веб-разработка", "react", "python", "frontend"]],
    )
    source_text: str = Field(description="Исходный текст, из которого генерировались теги")
