from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from domain.entities.base import Entity
from domain.values.contact import Contact


@dataclass
class SavedContact(Entity):
    """
    Сущность сохраненного контакта.
    Представляет связь между пользователями - когда один пользователь
    сохраняет другого в свои контакты.
    """

    # Кто сохранил контакт
    owner_id: UUID = field(default=None)

    # Чей контакт сохранен (может быть None если контакт добавлен вручную)
    saved_user_id: UUID | None = field(default=None)

    # Какая именно карточка сохранена (для отображения конкретной визитки)
    saved_card_id: UUID | None = field(default=None)

    # Данные контакта (для ручного ввода или импорта)
    name: str = field(default="")  # Полное имя (legacy, для обратной совместимости)
    first_name: str = field(default="")  # Имя
    last_name: str = field(default="")  # Фамилия
    phone: str | None = field(default=None)
    email: str | None = field(default=None)
    avatar_url: str | None = field(default=None)  # URL аватарки
    notes: str | None = field(default=None)

    # Контакты для связи (telegram, whatsapp и т.д.)
    contacts: list[Contact] = field(default_factory=list)

    # Мессенджер для связи (legacy, теперь используется contacts)
    messenger_type: str | None = field(default=None)  # telegram, whatsapp, vk
    messenger_value: str | None = field(default=None)  # @username или номер

    # Теги для ассоциативного поиска
    search_tags: list[str] = field(default_factory=list)

    # Источник контакта
    source: str = field(default="manual")  # manual, import, qr_code, app

    # Метаданные
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def full_name(self) -> str:
        """Получить полное имя контакта."""
        if self.first_name or self.last_name:
            return f"{self.first_name} {self.last_name}".strip()
        return self.name

    def add_search_tag(self, tag: str) -> None:
        """Добавить тег для поиска."""
        normalized_tag = tag.strip().lower()
        if normalized_tag and normalized_tag not in self.search_tags:
            self.search_tags.append(normalized_tag)
            self.updated_at = datetime.utcnow()

    def remove_search_tag(self, tag: str) -> None:
        """Удалить тег для поиска."""
        normalized_tag = tag.strip().lower()
        if normalized_tag in self.search_tags:
            self.search_tags.remove(normalized_tag)
            self.updated_at = datetime.utcnow()

    def set_search_tags(self, tags: list[str]) -> None:
        """Установить теги для поиска."""
        self.search_tags = [t.strip().lower() for t in tags if t.strip()]
        self.updated_at = datetime.utcnow()

    def update_notes(self, notes: str | None) -> None:
        """Обновить заметки о контакте."""
        self.notes = notes
        self.updated_at = datetime.utcnow()

    def update(
        self,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        messenger_type: str | None = None,
        messenger_value: str | None = None,
        notes: str | None = None,
        search_tags: list[str] | None = None,
    ) -> None:
        """Обновить данные контакта."""
        if first_name is not None:
            self.first_name = first_name
            # Обновляем legacy name для совместимости
            self.name = f"{first_name} {self.last_name}".strip()

        if last_name is not None:
            self.last_name = last_name
            self.name = f"{self.first_name} {last_name}".strip()

        if email is not None:
            self.email = email

        if phone is not None:
            self.phone = phone

        if messenger_type is not None:
            self.messenger_type = messenger_type

        if messenger_value is not None:
            self.messenger_value = messenger_value

        if notes is not None:
            self.notes = notes

        if search_tags is not None:
            self.set_search_tags(search_tags)

        self.updated_at = datetime.utcnow()

    def get_searchable_text(self) -> str:
        """Получить текст для поиска."""
        parts = [
            self.full_name,
            self.email or "",
            self.notes or "",
            " ".join(self.search_tags),
        ]
        return " ".join(filter(None, parts))
