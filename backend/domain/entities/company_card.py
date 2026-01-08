"""
Доменная сущность корпоративной визитной карточки.

Каждый сотрудник компании имеет ОДНУ корпоративную карточку,
которая содержит обязательные теги компании и дополнительную информацию.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.values.contact import Contact


URL_REGEX = re.compile(r"^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$")

MAX_BIO_LENGTH = 2000
MAX_AVATAR_URL_LENGTH = 500
MAX_DISPLAY_NAME_LENGTH = 100
MAX_POSITION_LENGTH = 100
MAX_DEPARTMENT_LENGTH = 100


class InvalidCompanyCardError(Exception):
    """Ошибка валидации корпоративной карточки."""

    def __init__(self, field: str, reason: str):
        self.field = field
        self.reason = reason
        super().__init__(f"Invalid company card field '{field}': {reason}")


class MissingRequiredTagError(Exception):
    """Не заполнен обязательный тег."""

    def __init__(self, tag_name: str):
        self.tag_name = tag_name
        super().__init__(f"Обязательный тег '{tag_name}' не заполнен")


@dataclass
class CompanyCard(Entity):
    """
    Доменная сущность корпоративной визитной карточки.
    
    В каждой компании у сотрудника может быть только ОДНА карточка.
    Карточка содержит:
    - Обязательные корпоративные теги (компания, должность, отдел)
    - Контактную информацию
    - Bio и дополнительные теги
    """

    # === Связи ===
    company_id: UUID = field(default=None)  # К какой компании относится
    member_id: UUID = field(default=None)  # ID членства (CompanyMember)
    user_id: UUID = field(default=None)  # Владелец карточки

    # === Корпоративные теги (обязательность настраивается в CompanyTagSettings) ===
    
    # Название компании (автоматически из company.name или кастомное)
    company_name: str = field(default="")
    
    # Должность сотрудника
    position: str | None = field(default=None)
    
    # Отдел/подразделение
    department: str | None = field(default=None)

    # === Профильная информация ===
    
    # Отображаемое имя (может отличаться от имени пользователя)
    display_name: str = field(default="")
    
    # Аватар (может быть свой для карточки)
    avatar_url: str | None = field(default=None)
    
    # Краткое bio/самопрезентация
    bio: str | None = field(default=None)
    
    # AI-сгенерированное bio
    ai_generated_bio: str | None = field(default=None)

    # === Контакты ===
    contacts: list[Contact] = field(default_factory=list)

    # === Теги ===
    
    # Дополнительные теги (навыки, сферы деятельности)
    tags: list[Tag] = field(default_factory=list)
    
    # Теги для поиска (генерируются из всех полей)
    search_tags: list[str] = field(default_factory=list)
    
    # Кастомные теги компании (заполняются согласно CompanyTagSettings.custom_tags)
    custom_tag_values: dict[str, str] = field(default_factory=dict)

    # === Поисковый индекс ===
    embedding: list[float] = field(default_factory=list)

    # === Статус ===
    is_active: bool = field(default=True)
    is_public: bool = field(default=True)  # Видна ли карточка вне компании
    
    # Полнота заполнения (0-100%)
    completeness: int = field(default=0)

    # === Timestamps ===
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        """Валидация данных при создании сущности."""
        if self.display_name and len(self.display_name) > MAX_DISPLAY_NAME_LENGTH:
            raise InvalidCompanyCardError(
                "display_name",
                f"Имя не должно превышать {MAX_DISPLAY_NAME_LENGTH} символов"
            )
        if self.position and len(self.position) > MAX_POSITION_LENGTH:
            raise InvalidCompanyCardError(
                "position",
                f"Должность не должна превышать {MAX_POSITION_LENGTH} символов"
            )
        if self.department and len(self.department) > MAX_DEPARTMENT_LENGTH:
            raise InvalidCompanyCardError(
                "department",
                f"Отдел не должен превышать {MAX_DEPARTMENT_LENGTH} символов"
            )
        if self.bio and len(self.bio) > MAX_BIO_LENGTH:
            raise InvalidCompanyCardError(
                "bio",
                f"Bio не должно превышать {MAX_BIO_LENGTH} символов"
            )
        if self.avatar_url and not URL_REGEX.match(self.avatar_url):
            raise InvalidCompanyCardError("avatar_url", "Невалидный URL аватара")

    def update_position(self, position: str | None) -> None:
        """Обновить должность."""
        if position and len(position) > MAX_POSITION_LENGTH:
            raise InvalidCompanyCardError(
                "position",
                f"Должность не должна превышать {MAX_POSITION_LENGTH} символов"
            )
        self.position = position
        self._update_search_tags()
        self.updated_at = datetime.now(timezone.utc)

    def update_department(self, department: str | None) -> None:
        """Обновить отдел."""
        if department and len(department) > MAX_DEPARTMENT_LENGTH:
            raise InvalidCompanyCardError(
                "department",
                f"Отдел не должен превышать {MAX_DEPARTMENT_LENGTH} символов"
            )
        self.department = department
        self._update_search_tags()
        self.updated_at = datetime.now(timezone.utc)

    def update_display_name(self, display_name: str) -> None:
        """Обновить отображаемое имя."""
        if len(display_name) > MAX_DISPLAY_NAME_LENGTH:
            raise InvalidCompanyCardError(
                "display_name",
                f"Имя не должно превышать {MAX_DISPLAY_NAME_LENGTH} символов"
            )
        self.display_name = display_name
        self.updated_at = datetime.now(timezone.utc)

    def update_bio(self, bio: str | None) -> None:
        """Обновить bio."""
        if bio and len(bio) > MAX_BIO_LENGTH:
            raise InvalidCompanyCardError(
                "bio",
                f"Bio не должно превышать {MAX_BIO_LENGTH} символов"
            )
        self.bio = bio
        self.updated_at = datetime.now(timezone.utc)

    def update_avatar(self, avatar_url: str | None) -> None:
        """Обновить аватар."""
        if avatar_url and not URL_REGEX.match(avatar_url):
            raise InvalidCompanyCardError("avatar_url", "Невалидный URL аватара")
        self.avatar_url = avatar_url
        self.updated_at = datetime.now(timezone.utc)

    def set_custom_tag(self, tag_id: str, value: str) -> None:
        """Установить значение кастомного тега."""
        self.custom_tag_values[tag_id] = value
        self._update_search_tags()
        self.updated_at = datetime.now(timezone.utc)

    def remove_custom_tag(self, tag_id: str) -> bool:
        """Удалить кастомный тег."""
        if tag_id in self.custom_tag_values:
            del self.custom_tag_values[tag_id]
            self._update_search_tags()
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def add_tag(self, tag: Tag) -> None:
        """Добавить тег навыка."""
        # Проверяем дубликаты
        existing_names = {t.name.lower() for t in self.tags}
        if tag.name.lower() not in existing_names:
            self.tags.append(tag)
            self._update_search_tags()
            self.updated_at = datetime.now(timezone.utc)

    def remove_tag(self, tag_name: str) -> bool:
        """Удалить тег навыка."""
        original_len = len(self.tags)
        self.tags = [t for t in self.tags if t.name.lower() != tag_name.lower()]
        if len(self.tags) < original_len:
            self._update_search_tags()
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def add_contact(self, contact: Contact) -> None:
        """Добавить контакт."""
        self.contacts.append(contact)
        self.updated_at = datetime.now(timezone.utc)

    def remove_contact(self, contact_type: ContactType, value: str) -> bool:
        """Удалить контакт."""
        original_len = len(self.contacts)
        self.contacts = [
            c for c in self.contacts 
            if not (c.type == contact_type and c.value == value)
        ]
        if len(self.contacts) < original_len:
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def _update_search_tags(self) -> None:
        """Обновить теги для поиска."""
        tags = set()
        
        # Корпоративные теги
        if self.company_name:
            tags.add(self.company_name.lower())
        if self.position:
            tags.add(self.position.lower())
        if self.department:
            tags.add(self.department.lower())
        
        # Обычные теги
        for tag in self.tags:
            tags.add(tag.name.lower())
        
        # Кастомные теги
        for value in self.custom_tag_values.values():
            if value:
                tags.add(value.lower())
        
        # Имя
        if self.display_name:
            tags.update(self.display_name.lower().split())
        
        self.search_tags = list(tags)

    def calculate_completeness(self) -> int:
        """Рассчитать полноту заполнения карточки (0-100%)."""
        total_fields = 8
        filled = 0
        
        if self.display_name:
            filled += 1
        if self.avatar_url:
            filled += 1
        if self.position:
            filled += 1
        if self.department:
            filled += 1
        if self.bio:
            filled += 1
        if self.contacts:
            filled += 1
        if self.tags:
            filled += 1
        if self.company_name:
            filled += 1
        
        self.completeness = int((filled / total_fields) * 100)
        return self.completeness

    def set_embedding(self, embedding: list[float]) -> None:
        """Установить embedding для семантического поиска."""
        self.embedding = embedding
        self.updated_at = datetime.now(timezone.utc)

    def deactivate(self) -> None:
        """Деактивировать карточку."""
        self.is_active = False
        self.updated_at = datetime.now(timezone.utc)

    def activate(self) -> None:
        """Активировать карточку."""
        self.is_active = True
        self.updated_at = datetime.now(timezone.utc)

    def set_public(self, is_public: bool) -> None:
        """Установить видимость вне компании."""
        self.is_public = is_public
        self.updated_at = datetime.now(timezone.utc)

    def get_corporate_tags(self) -> list[Tag]:
        """Получить корпоративные теги как объекты Tag."""
        tags = []
        
        if self.company_name:
            tags.append(Tag(name=self.company_name, category="COMPANY"))
        if self.position:
            tags.append(Tag(name=self.position, category="POSITION"))
        if self.department:
            tags.append(Tag(name=self.department, category="DEPARTMENT"))
        
        return tags

    def get_all_tags(self) -> list[Tag]:
        """Получить все теги (корпоративные + навыки)."""
        return self.get_corporate_tags() + self.tags
