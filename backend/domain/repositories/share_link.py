"""Интерфейс репозитория ссылок для шаринга."""

from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from domain.entities.share_link import ShareLink


class ShareLinkRepositoryInterface(ABC):
    """Интерфейс репозитория ссылок для шаринга."""

    @abstractmethod
    async def get_by_id(self, link_id: UUID) -> Optional[ShareLink]:
        """Получить ссылку по ID."""
        pass

    @abstractmethod
    async def get_by_token(self, token: str) -> Optional[ShareLink]:
        """Получить ссылку по токену."""
        pass

    @abstractmethod
    async def get_by_card_id(self, card_id: UUID) -> list[ShareLink]:
        """Получить все ссылки для визитки."""
        pass

    @abstractmethod
    async def create(self, link: ShareLink) -> ShareLink:
        """Создать ссылку."""
        pass

    @abstractmethod
    async def update(self, link: ShareLink) -> ShareLink:
        """Обновить ссылку."""
        pass

    @abstractmethod
    async def delete(self, link_id: UUID) -> bool:
        """Удалить ссылку."""
        pass

    @abstractmethod
    async def increment_views(self, link_id: UUID) -> bool:
        """Увеличить счетчик просмотров."""
        pass

    @abstractmethod
    async def deactivate_expired(self) -> int:
        """Деактивировать истекшие ссылки. Возвращает количество деактивированных."""
        pass
