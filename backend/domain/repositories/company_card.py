"""
Репозиторий для работы с корпоративными карточками.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.company_card import CompanyCard


class ICompanyCardRepository(ABC):
    """Интерфейс репозитория корпоративных карточек."""

    @abstractmethod
    async def create(self, entity: CompanyCard) -> CompanyCard:
        """Создать карточку."""
        pass

    @abstractmethod
    async def get_by_id(self, entity_id: UUID) -> CompanyCard | None:
        """Получить карточку по ID."""
        pass

    @abstractmethod
    async def update(self, entity: CompanyCard) -> CompanyCard:
        """Обновить карточку."""
        pass

    @abstractmethod
    async def delete(self, entity_id: UUID) -> bool:
        """Удалить карточку."""
        pass

    @abstractmethod
    async def get_by_company_and_user(
        self, company_id: UUID, user_id: UUID
    ) -> CompanyCard | None:
        """
        Получить карточку сотрудника в компании.
        
        В каждой компании у пользователя может быть только одна карточка.
        """
        pass

    @abstractmethod
    async def get_by_company_and_member(
        self, company_id: UUID, member_id: UUID
    ) -> CompanyCard | None:
        """Получить карточку по ID членства."""
        pass

    @abstractmethod
    async def get_by_company(
        self, company_id: UUID, 
        include_inactive: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> list[CompanyCard]:
        """Получить все карточки компании."""
        pass

    @abstractmethod
    async def count_by_company(
        self, company_id: UUID,
        include_inactive: bool = False
    ) -> int:
        """Подсчитать количество карточек в компании."""
        pass

    @abstractmethod
    async def search_by_tags(
        self, company_id: UUID,
        tags: list[str],
        limit: int = 50
    ) -> list[CompanyCard]:
        """Найти карточки по тегам."""
        pass

    @abstractmethod
    async def search_by_text(
        self, company_id: UUID,
        query: str,
        limit: int = 50
    ) -> list[CompanyCard]:
        """Текстовый поиск по карточкам."""
        pass

    @abstractmethod
    async def search_by_embedding(
        self, company_id: UUID,
        embedding: list[float],
        limit: int = 10
    ) -> list[CompanyCard]:
        """Семантический поиск по embedding."""
        pass

    @abstractmethod
    async def get_by_position(
        self, company_id: UUID,
        position: str
    ) -> list[CompanyCard]:
        """Получить карточки по должности."""
        pass

    @abstractmethod
    async def get_by_department(
        self, company_id: UUID,
        department: str
    ) -> list[CompanyCard]:
        """Получить карточки по отделу."""
        pass

    @abstractmethod
    async def get_public_cards(
        self, company_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> list[CompanyCard]:
        """Получить публичные карточки компании."""
        pass

    @abstractmethod
    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить все карточки компании. Возвращает количество удаленных."""
        pass

    @abstractmethod
    async def delete_by_user(self, user_id: UUID) -> int:
        """Удалить все карточки пользователя. Возвращает количество удаленных."""
        pass
