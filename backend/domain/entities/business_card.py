"""
Доменная сущность визитной карточки.
"""

import re
from dataclasses import dataclass, field
from uuid import UUID

from domain.entities.base import Entity
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.values.contact import Contact


URL_REGEX = re.compile(r"^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$")

MAX_TITLE_LENGTH = 100
MAX_BIO_LENGTH = 2000
MAX_AVATAR_URL_LENGTH = 500
MAX_RANDOM_FACT_LENGTH = 500
MAX_RANDOM_FACTS_COUNT = 10


class InvalidCardTitleError(Exception):
    """Ошибка валидации названия карточки."""

    def __init__(self, title: str, reason: str):
        self.title = title
        self.reason = reason
        super().__init__(f"Invalid card title '{title}': {reason}")


class InvalidCardBioError(Exception):
    """Ошибка валидации bio карточки."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Invalid card bio: {reason}")


class InvalidCardAvatarUrlError(Exception):
    """Ошибка валидации URL аватара карточки."""

    def __init__(self, url: str, reason: str):
        self.url = url
        self.reason = reason
        super().__init__(f"Invalid avatar URL '{url}': {reason}")


class InvalidCardRandomFactError(Exception):
    """Ошибка валидации рандомного факта."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Invalid random fact: {reason}")


@dataclass
class BusinessCard(Entity):
    """
    Доменная сущность визитной карточки.
    Пользователь может иметь несколько карточек для разных целей.
    """

    # Связь с владельцем
    owner_id: UUID = field(default=None)

    # Метаданные карточки
    title: str = field(
        default="Основная"
    )  # Название карточки (напр. "Рабочая", "Личная")
    is_primary: bool = field(default=False)  # Основная карточка
    is_active: bool = field(default=True)  # Активна/видима

    # Данные визитки
    display_name: str = field(
        default=""
    )  # Отображаемое имя (может отличаться от имени юзера)
    avatar_url: str | None = field(default=None)

    # Навыки и теги для ассоциативного поиска
    tags: list[Tag] = field(default_factory=list)
    search_tags: list[str] = field(default_factory=list)

    # Связь и мессенджеры
    contacts: list[Contact] = field(default_factory=list)

    # Профиль
    bio: str | None = field(default=None)

    # Рандомные факты для AI-генерации презентации
    random_facts: list[str] = field(default_factory=list)
    ai_generated_bio: str | None = field(default=None)

    # Embedding для семантического поиска
    embedding: list[float] = field(default_factory=list)

    # Полнота карточки
    completeness: int = field(default=0)

    # Эмодзи для декоративного отображения профиля
    emojis: list[str] = field(
        default_factory=lambda: ["🥁", "📈", "🎸", "🧭", "😍", "🫶"]
    )

    # Видимость карточки (наследуется от пользователя)
    # Приватные карточки видны только внутри компании
    is_public: bool = field(default=True)

    def __post_init__(self) -> None:
        """Валидация данных при создании сущности."""
        if self.title:
            self._validate_title(self.title)
        if self.avatar_url:
            self._validate_avatar_url(self.avatar_url)
        if self.bio:
            self._validate_bio(self.bio)

    @staticmethod
    def _validate_title(title: str) -> None:
        """Валидация названия карточки."""
        if len(title) > MAX_TITLE_LENGTH:
            raise InvalidCardTitleError(title, f"Max length is {MAX_TITLE_LENGTH}")

    @staticmethod
    def _validate_avatar_url(url: str) -> None:
        """Валидация URL аватара."""
        if len(url) > MAX_AVATAR_URL_LENGTH:
            raise InvalidCardAvatarUrlError(
                url, f"Max length is {MAX_AVATAR_URL_LENGTH}"
            )
        if not URL_REGEX.match(url):
            raise InvalidCardAvatarUrlError(url, "Invalid URL format")

    @staticmethod
    def _validate_bio(bio: str) -> None:
        """Валидация биографии."""
        if len(bio) > MAX_BIO_LENGTH:
            raise InvalidCardBioError(f"Max length is {MAX_BIO_LENGTH}")

    @staticmethod
    def _validate_random_fact(fact: str) -> None:
        """Валидация рандомного факта."""
        if len(fact) > MAX_RANDOM_FACT_LENGTH:
            raise InvalidCardRandomFactError(f"Max length is {MAX_RANDOM_FACT_LENGTH}")

    def update_title(self, title: str) -> None:
        """Обновить название карточки."""
        self._validate_title(title)
        self.title = title

    def update_display_name(self, name: str) -> None:
        """Обновить отображаемое имя."""
        self.display_name = name
        self._recalculate_completeness()

    def update_avatar(self, avatar_url: str | None) -> None:
        """Обновить аватар."""
        if avatar_url:
            self._validate_avatar_url(avatar_url)
        self.avatar_url = avatar_url
        self._recalculate_completeness()

    def update_bio(self, bio: str | None) -> None:
        """Обновить биографию."""
        if bio:
            self._validate_bio(bio)
        self.bio = bio
        self._recalculate_completeness()

    def set_ai_generated_bio(self, bio: str) -> None:
        """Установить AI-сгенерированную самопрезентацию."""
        self._validate_bio(bio)
        self.ai_generated_bio = bio

    def clear_ai_generated_bio(self) -> None:
        """Очистить AI-сгенерированную самопрезентацию."""
        self.ai_generated_bio = None

    def clear_content(self) -> None:
        """Очистить всё содержимое карточки (bio, AI bio, теги, контакты, факты)."""
        self.bio = None
        self.ai_generated_bio = None
        self.search_tags = []
        self.contacts = []
        self.random_facts = []
        self.tags = []
        self.embedding = []
        self._recalculate_completeness()

    def add_random_fact(self, fact: str) -> None:
        """Добавить рандомный факт о себе."""
        self._validate_random_fact(fact)
        if len(self.random_facts) >= MAX_RANDOM_FACTS_COUNT:
            raise InvalidCardRandomFactError(
                f"Max facts count is {MAX_RANDOM_FACTS_COUNT}"
            )
        if fact not in self.random_facts:
            self.random_facts.append(fact)
            self._recalculate_completeness()

    def remove_random_fact(self, fact: str) -> None:
        """Удалить рандомный факт."""
        if fact in self.random_facts:
            self.random_facts.remove(fact)
            self._recalculate_completeness()

    def add_search_tag(self, tag: str) -> None:
        """Добавить тег для поиска."""
        normalized_tag = tag.strip().lower()
        if normalized_tag and normalized_tag not in self.search_tags:
            self.search_tags.append(normalized_tag)
            self._recalculate_completeness()

    def remove_search_tag(self, tag: str) -> None:
        """Удалить тег для поиска."""
        normalized_tag = tag.strip().lower()
        if normalized_tag in self.search_tags:
            self.search_tags.remove(normalized_tag)
            self._recalculate_completeness()

    def set_search_tags(self, tags: list[str]) -> None:
        """Установить теги для поиска."""
        self.search_tags = [t.strip().lower() for t in tags if t.strip()]
        self._recalculate_completeness()

    def set_emojis(self, emojis: list[str]) -> None:
        """Установить эмодзи для профиля (максимум 6)."""
        # Ограничиваем количество эмодзи
        self.emojis = emojis[:6] if emojis else ["🥁", "📈", "🎸", "🧭", "😍", "🫶"]

    def add_contact(
        self,
        contact_type: ContactType,
        value: str,
        is_primary: bool = False,
        is_visible: bool = True,
    ) -> None:
        """Добавить контакт. Если он primary, сбрасываем флаг у других."""
        if not any(c.type == contact_type and c.value == value for c in self.contacts):
            if is_primary:
                self.contacts = [
                    Contact(c.type, c.value, is_primary=False, is_visible=c.is_visible)
                    for c in self.contacts
                ]

            self.contacts.append(Contact(contact_type, value, is_primary, is_visible))
            self._recalculate_completeness()

    def update_contact_visibility(
        self, contact_type: ContactType, value: str, is_visible: bool
    ) -> None:
        """Обновить видимость контакта в публичном профиле."""
        self.contacts = [
            (
                Contact(c.type, c.value, c.is_primary, is_visible)
                if c.type == contact_type and c.value == value
                else c
            )
            for c in self.contacts
        ]

    def remove_contact(self, contact_type: ContactType, value: str) -> None:
        """Удалить контакт."""
        self.contacts = [
            c
            for c in self.contacts
            if not (c.type == contact_type and c.value == value)
        ]
        self._recalculate_completeness()

    def get_visible_contacts(self) -> list[Contact]:
        """Получить контакты для публичного отображения."""
        return [c for c in self.contacts if c.is_visible]

    def has_visible_contact(self) -> bool:
        """Проверить есть ли хотя бы один публичный контакт."""
        return any(c.is_visible for c in self.contacts)

    def add_tag(self, tag: Tag) -> None:
        """Добавить тег навыка."""
        if tag not in self.tags:
            self.tags.append(tag)
            self._recalculate_completeness()

    def remove_tag(self, tag: Tag) -> None:
        """Удалить тег навыка."""
        if tag in self.tags:
            self.tags.remove(tag)
            self._recalculate_completeness()

    def set_primary(self, is_primary: bool) -> None:
        """Установить как основную карточку."""
        self.is_primary = is_primary

    def set_active(self, is_active: bool) -> None:
        """Установить активность карточки."""
        self.is_active = is_active

    def set_embedding(self, embedding: list[float]) -> None:
        """Установить embedding вектор для поиска."""
        self.embedding = embedding

    def _recalculate_completeness(self) -> None:
        """Пересчитать полноту карточки."""
        fields = [
            self.display_name,
            self.avatar_url,
            self.contacts,
            self.tags,
            self.bio or self.ai_generated_bio,
            self.search_tags,
            self.random_facts,
        ]
        filled = sum(1 for f in fields if f)
        self.completeness = int((filled / len(fields)) * 100)

    def get_searchable_text(self) -> str:
        """Получить текст для индексации и поиска."""
        parts = [
            self.display_name,
            self.bio or "",
            self.ai_generated_bio or "",
            " ".join(self.search_tags),
            " ".join(self.random_facts),
            " ".join(tag.name for tag in self.tags),
        ]
        return " ".join(filter(None, parts))
