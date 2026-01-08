"""
Репозиторий для работы с настройками тегов компании.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.company_settings import CompanyTagSettings


class ICompanyTagSettingsRepository(ABC):
    """Интерфейс репозитория настроек тегов компании."""

    @abstractmethod
    async def create(self, entity: CompanyTagSettings) -> CompanyTagSettings:
        """Создать настройки."""
        pass

    @abstractmethod
    async def get_by_id(self, entity_id: UUID) -> CompanyTagSettings | None:
        """Получить настройки по ID."""
        pass

    @abstractmethod
    async def update(self, entity: CompanyTagSettings) -> CompanyTagSettings:
        """Обновить настройки."""
        pass

    @abstractmethod
    async def delete(self, entity_id: UUID) -> bool:
        """Удалить настройки."""
        pass

    @abstractmethod
    async def get_by_company(self, company_id: UUID) -> CompanyTagSettings | None:
        """Получить настройки тегов компании."""
        pass

    @abstractmethod
    async def delete_by_company(self, company_id: UUID) -> bool:
        """Удалить настройки тегов компании."""
        pass
