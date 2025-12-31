from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.user import User


class UserRepositoryInterface(ABC):
    """Интерфейс репозитория пользователей."""

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None:
        """Получить пользователя по ID."""
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None:
        """Получить пользователя по email."""
        pass

    @abstractmethod
    async def create(self, user: User) -> User:
        """Создать пользователя."""
        pass

    @abstractmethod
    async def update(self, user: User) -> User:
        """Обновить пользователя."""
        pass

    @abstractmethod
    async def delete(self, user_id: UUID) -> bool:
        """Удалить пользователя."""
        pass

    @abstractmethod
    async def search_by_tags(self, tags: list[str], limit: int = 20) -> list[User]:
        """Поиск пользователей по тегам."""
        pass

    @abstractmethod
    async def search_by_text(self, query: str, limit: int = 20) -> list[User]:
        """Полнотекстовый поиск пользователей."""
        pass

    @abstractmethod
    async def search_by_embedding(
        self, embedding: list[float], limit: int = 20
    ) -> list[User]:
        """Семантический поиск по embedding."""
        pass

    @abstractmethod
    async def search_by_bio_keywords(
        self, keywords: list[str], limit: int = 20
    ) -> list[User]:
        """Поиск пользователей по ключевым словам в bio."""
        pass

    @abstractmethod
    async def get_all(self, skip: int = 0, limit: int = 100) -> list[User]:
        """Получить всех пользователей с пагинацией."""
        pass

    @abstractmethod
    async def find_by_phone_hashes(self, hashes: list[str]) -> list[User]:
        """Найти пользователей по хешам телефонов."""
        pass
