import re
from dataclasses import dataclass, field
from uuid import UUID

from domain.entities.base import Entity
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.enums.status import UserStatus
from domain.exceptions.user import (
    InvalidAvatarUrlError,
    InvalidBioError,
    InvalidContactValueError,
    InvalidEmailError,
    InvalidEmbeddingError,
    InvalidLocationError,
    InvalidNameError,
    InvalidPasswordError,
    InvalidRandomFactError,
)
from domain.values.contact import Contact


EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
NAME_REGEX = re.compile(r"^[\w\s\-']{1,100}$", re.UNICODE)
PHONE_REGEX = re.compile(r"^\+?[1-9]\d{6,14}$")
TELEGRAM_REGEX = re.compile(r"^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$")
URL_REGEX = re.compile(r"^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$")

MAX_NAME_LENGTH = 100
MAX_BIO_LENGTH = 2000
MAX_LOCATION_LENGTH = 200
MAX_AVATAR_URL_LENGTH = 500
MIN_PASSWORD_HASH_LENGTH = 20
MAX_RANDOM_FACT_LENGTH = 500
MAX_RANDOM_FACTS_COUNT = 10


@dataclass
class User(Entity):
    """
    Доменная сущность пользователя.
    Представляет эксперта в системе поиска контактов.
    """

    # Основные данные
    first_name: str = field(default="")
    last_name: str = field(default="")
    email: str = field(default="")
    hashed_password: str = field(default="")
    phone_hash: str | None = field(default=None)  # SHA-256 hash телефона для sync
    avatar_url: str | None = field(default=None)

    # Telegram авторизация
    telegram_id: int | None = field(default=None)  # Telegram user ID
    telegram_username: str | None = field(default=None)  # @username в Telegram

    # Локация
    location: str | None = field(default=None)

    # Должность / роль
    position: str | None = field(default=None)

    # Навыки и теги для ассоциативного поиска
    tags: list[Tag] = field(default_factory=list)
    search_tags: list[str] = field(default_factory=list)  # Облако тегов для поиска

    # Связь и мессенджеры
    contacts: list[Contact] = field(default_factory=list)

    # Статус и профиль
    status: UserStatus = UserStatus.AVAILABLE
    bio: str | None = field(default=None)  # Короткая самопрезентация

    # Рандомные факты для AI-генерации презентации
    random_facts: list[str] = field(default_factory=list)
    ai_generated_bio: str | None = field(default=None)

    # Embedding для семантического поиска
    embedding: list[float] = field(default_factory=list)

    # Полнота профиля
    profile_completeness: int = field(default=0)

    # Видимость профиля (публичный или приватный)
    # Приватный профиль виден только внутри компании
    is_public: bool = field(default=True)

    def __post_init__(self) -> None:
        """Валидация данных при создании сущности."""
        if self.email:
            self._validate_email(self.email)
        if self.first_name:
            self._validate_name("first_name", self.first_name)
        if self.last_name:
            self._validate_name("last_name", self.last_name)
        if self.hashed_password:
            self._validate_hashed_password(self.hashed_password)
        if self.avatar_url:
            self._validate_avatar_url(self.avatar_url)
        if self.location:
            self._validate_location(self.location)
        if self.bio:
            self._validate_bio(self.bio)

    @property
    def full_name(self) -> str:
        """Получить полное имя пользователя."""
        return f"{self.first_name} {self.last_name}".strip()

    @staticmethod
    def _validate_email(email: str) -> None:
        """Валидация email."""
        if not EMAIL_REGEX.match(email):
            raise InvalidEmailError(email)

    @staticmethod
    def _validate_name(field_name: str, value: str) -> None:
        """Валидация имени/фамилии."""
        if len(value) > MAX_NAME_LENGTH:
            raise InvalidNameError(
                field_name, value, f"Max length is {MAX_NAME_LENGTH}"
            )
        if not NAME_REGEX.match(value):
            raise InvalidNameError(field_name, value, "Contains invalid characters")

    @staticmethod
    def _validate_hashed_password(hashed_password: str) -> None:
        """Валидация хэшированного пароля."""
        if len(hashed_password) < MIN_PASSWORD_HASH_LENGTH:
            raise InvalidPasswordError("Hash is too short")

    @staticmethod
    def _validate_avatar_url(url: str) -> None:
        """Валидация URL аватара."""
        if len(url) > MAX_AVATAR_URL_LENGTH:
            raise InvalidAvatarUrlError(url, f"Max length is {MAX_AVATAR_URL_LENGTH}")
        if not URL_REGEX.match(url):
            raise InvalidAvatarUrlError(url, "Invalid URL format")

    @staticmethod
    def _validate_location(location: str) -> None:
        """Валидация локации."""
        if len(location) > MAX_LOCATION_LENGTH:
            raise InvalidLocationError(location, f"Max length is {MAX_LOCATION_LENGTH}")

    @staticmethod
    def _validate_bio(bio: str) -> None:
        """Валидация биографии."""
        if len(bio) > MAX_BIO_LENGTH:
            raise InvalidBioError(f"Max length is {MAX_BIO_LENGTH}")

    @staticmethod
    def _validate_random_fact(fact: str) -> None:
        """Валидация рандомного факта."""
        if len(fact) > MAX_RANDOM_FACT_LENGTH:
            raise InvalidRandomFactError(f"Max length is {MAX_RANDOM_FACT_LENGTH}")

    @staticmethod
    def _validate_contact(contact_type: ContactType, value: str) -> None:
        """Валидация контакта в зависимости от типа."""
        if not value or not value.strip():
            raise InvalidContactValueError(
                contact_type.value, value, "Value cannot be empty"
            )

        if contact_type == ContactType.EMAIL:
            if not EMAIL_REGEX.match(value):
                raise InvalidContactValueError(
                    contact_type.value, value, "Invalid email format"
                )
        elif contact_type in (ContactType.PHONE, ContactType.WHATSAPP):
            # Телефон и WhatsApp используют номер телефона
            clean_phone = (
                value.replace(" ", "")
                .replace("-", "")
                .replace("(", "")
                .replace(")", "")
            )
            if not PHONE_REGEX.match(clean_phone):
                raise InvalidContactValueError(
                    contact_type.value, value, "Invalid phone format"
                )
        elif contact_type == ContactType.TELEGRAM:
            if not TELEGRAM_REGEX.match(value):
                raise InvalidContactValueError(
                    contact_type.value, value, "Invalid Telegram username"
                )
        elif contact_type in (
            ContactType.GITHUB,
            ContactType.LINKEDIN,
            ContactType.VK,
            ContactType.INSTAGRAM,
            ContactType.TIKTOK,
            ContactType.MESSENGER,
        ):
            # Username или URL для соц.сетей
            if (
                not URL_REGEX.match(value)
                and not value.replace("_", "")
                .replace("-", "")
                .replace(".", "")
                .isalnum()
            ):
                raise InvalidContactValueError(
                    contact_type.value, value, "Invalid username or URL"
                )

    @staticmethod
    def _validate_embedding(embedding: list[float]) -> None:
        """Валидация embedding вектора."""
        if not embedding:
            raise InvalidEmbeddingError("Embedding cannot be empty")
        if not all(isinstance(x, (int, float)) for x in embedding):
            raise InvalidEmbeddingError("All values must be numeric")

    def update_profile(
        self,
        first_name: str | None = None,
        last_name: str | None = None,
        avatar_url: str | None = None,
        bio: str | None = None,
        position: str | None = ...,
    ) -> None:
        """Обновить основные данные профиля."""
        if first_name is not None:
            if first_name:
                self._validate_name("first_name", first_name)
            self.first_name = first_name

        if last_name is not None:
            if last_name:
                self._validate_name("last_name", last_name)
            self.last_name = last_name

        if avatar_url is not None:
            if avatar_url:
                self._validate_avatar_url(avatar_url)
            self.avatar_url = avatar_url

        if bio is not None:
            if bio:
                self._validate_bio(bio)
            self.bio = bio

        if position is not ...:
            self.position = position.strip() if position else None

        self._recalculate_completeness()

    def update_status(self, status: UserStatus) -> None:
        """Обновить статус пользователя."""
        self.status = status

    def update_bio(self, bio: str | None) -> None:
        """Обновить биографию."""
        if bio:
            self._validate_bio(bio)
        self.bio = bio
        self._recalculate_completeness()

    def add_random_fact(self, fact: str) -> None:
        """Добавить рандомный факт о себе."""
        self._validate_random_fact(fact)
        if len(self.random_facts) >= MAX_RANDOM_FACTS_COUNT:
            raise InvalidRandomFactError(f"Max facts count is {MAX_RANDOM_FACTS_COUNT}")
        if fact not in self.random_facts:
            self.random_facts.append(fact)
            self._recalculate_completeness()

    def remove_random_fact(self, fact: str) -> None:
        """Удалить рандомный факт."""
        if fact in self.random_facts:
            self.random_facts.remove(fact)
            self._recalculate_completeness()

    def set_ai_generated_bio(self, bio: str) -> None:
        """Установить AI-сгенерированную самопрезентацию."""
        self._validate_bio(bio)
        self.ai_generated_bio = bio

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

    def add_contact(
        self,
        contact_type: ContactType,
        value: str,
        is_primary: bool = False,
        is_visible: bool = True,
    ) -> None:
        """Добавить контакт. Если он primary, сбрасываем флаг у других."""
        self._validate_contact(contact_type, value)

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

    def get_visible_contacts(self) -> list[Contact]:
        """Получить контакты для публичного отображения."""
        return [c for c in self.contacts if c.is_visible]

    def has_visible_contact(self) -> bool:
        """Проверить есть ли хотя бы один публичный контакт."""
        return any(c.is_visible for c in self.contacts)

    def remove_contact(self, contact_type: ContactType, value: str) -> None:
        """Удалить контакт."""
        self.contacts = [
            c
            for c in self.contacts
            if not (c.type == contact_type and c.value == value)
        ]
        self._recalculate_completeness()

    def update_avatar(self, avatar_url: str | None) -> None:
        """Обновить аватар."""
        if avatar_url:
            self._validate_avatar_url(avatar_url)
        self.avatar_url = avatar_url
        self._recalculate_completeness()

    def change_email(self, new_email: str) -> None:
        """Изменить email пользователя."""
        self._validate_email(new_email)
        self.email = new_email

    def update_location(self, location: str | None) -> None:
        """Обновить локацию."""
        if location:
            self._validate_location(location)
        self.location = location
        self._recalculate_completeness()

    def set_embedding(self, embedding: list[float]) -> None:
        """Установить embedding вектор для поиска."""
        self._validate_embedding(embedding)
        self.embedding = embedding

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

    def _recalculate_completeness(self) -> None:
        """Пересчитать полноту профиля."""
        fields = [
            self.first_name,
            self.last_name,
            self.email,
            self.avatar_url,
            self.location,
            self.contacts,
            self.tags,
            self.bio or self.ai_generated_bio,
            self.search_tags,
            self.random_facts,
        ]
        filled = sum(1 for f in fields if f)
        self.profile_completeness = int((filled / len(fields)) * 100)

    def get_searchable_text(self) -> str:
        """Получить текст для индексации и поиска."""
        parts = [
            self.full_name,
            self.bio or "",
            self.ai_generated_bio or "",
            self.location or "",
            " ".join(self.search_tags),
            " ".join(self.random_facts),
            " ".join(tag.name for tag in self.tags),
        ]
        return " ".join(filter(None, parts))
