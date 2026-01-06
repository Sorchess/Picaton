"""Интерфейс репозитория визитных карточек."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.business_card import BusinessCard


class BusinessCardRepositoryInterface(ABC):
    """Интерфейс репозитория визитных карточек."""

    @abstractmethod
    async def get_by_id(self, card_id: UUID) -> BusinessCard | None:
        """Получить карточку по ID."""
        pass

    @abstractmethod
    async def get_by_owner(self, owner_id: UUID) -> list[BusinessCard]:
        """Получить все карточки пользователя."""
        pass

    @abstractmethod
    async def get_primary_by_owner(self, owner_id: UUID) -> BusinessCard | None:
        """Получить основную карточку пользователя."""
        pass

    @abstractmethod
    async def create(self, card: BusinessCard) -> BusinessCard:
        """Создать карточку."""
        pass

    @abstractmethod
    async def update(self, card: BusinessCard) -> BusinessCard:
        """Обновить карточку."""
        pass

    @abstractmethod
    async def delete(self, card_id: UUID) -> bool:
        """Удалить карточку."""
        pass

    @abstractmethod
    async def set_primary(self, owner_id: UUID, card_id: UUID) -> bool:
        """Установить карточку как основную (сбросив флаг у остальных)."""
        pass

    @abstractmethod
    async def search_by_tags(
        self, tags: list[str], limit: int = 20, public_only: bool = True
    ) -> list[BusinessCard]:
        """Поиск карточек по тегам."""
        pass

    @abstractmethod
    async def search_by_text(
        self, query: str, limit: int = 20, public_only: bool = True
    ) -> list[BusinessCard]:
        """Полнотекстовый поиск карточек."""
        pass

    @abstractmethod
    async def search_by_bio_keywords(
        self, keywords: list[str], limit: int = 20, public_only: bool = True
    ) -> list[BusinessCard]:
        """Поиск карточек по ключевым словам в bio."""
        pass

    @abstractmethod
    async def update_visibility_by_owner(self, owner_id: UUID, is_public: bool) -> int:
        """Обновить видимость всех карточек пользователя. Возвращает количество обновлённых."""
        pass

    @abstractmethod
    async def count_by_owner(self, owner_id: UUID) -> int:
        """Количество карточек у пользователя."""
        pass
