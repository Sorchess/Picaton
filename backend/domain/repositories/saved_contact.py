from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.saved_contact import SavedContact


class SavedContactRepositoryInterface(ABC):
    """Интерфейс репозитория сохраненных контактов."""

    @abstractmethod
    async def get_by_id(self, contact_id: UUID) -> SavedContact | None:
        """Получить контакт по ID."""
        pass

    @abstractmethod
    async def get_by_owner(
        self, owner_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[SavedContact]:
        """Получить все контакты пользователя."""
        pass

    @abstractmethod
    async def create(self, contact: SavedContact) -> SavedContact:
        """Создать контакт."""
        pass

    @abstractmethod
    async def update(self, contact: SavedContact) -> SavedContact:
        """Обновить контакт."""
        pass

    @abstractmethod
    async def delete(self, contact_id: UUID) -> bool:
        """Удалить контакт."""
        pass

    @abstractmethod
    async def search_by_tags(
        self, owner_id: UUID, tags: list[str], limit: int = 20
    ) -> list[SavedContact]:
        """Поиск контактов по тегам."""
        pass

    @abstractmethod
    async def search_by_text(
        self, owner_id: UUID, query: str, limit: int = 20
    ) -> list[SavedContact]:
        """Полнотекстовый поиск контактов."""
        pass

    @abstractmethod
    async def bulk_create(self, contacts: list[SavedContact]) -> list[SavedContact]:
        """Массовое создание контактов (для импорта)."""
        pass

    @abstractmethod
    async def exists(self, owner_id: UUID, saved_user_id: UUID) -> bool:
        """Проверить, существует ли контакт."""
        pass
