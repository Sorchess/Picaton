"""Интерфейс репозитория ролей компании."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.company_role import CompanyRole


class CompanyRoleRepositoryInterface(ABC):
    """Интерфейс репозитория ролей компании."""

    @abstractmethod
    async def create(self, role: CompanyRole) -> CompanyRole:
        """Создать роль."""
        pass

    @abstractmethod
    async def get_by_id(self, role_id: UUID) -> CompanyRole | None:
        """Получить роль по ID."""
        pass

    @abstractmethod
    async def get_by_company(self, company_id: UUID) -> list[CompanyRole]:
        """Получить все роли компании (отсортированные по приоритету)."""
        pass

    @abstractmethod
    async def get_by_company_and_name(
        self, company_id: UUID, name: str
    ) -> CompanyRole | None:
        """Получить роль по названию в компании."""
        pass

    @abstractmethod
    async def get_default_role(self, company_id: UUID) -> CompanyRole | None:
        """Получить роль по умолчанию для компании."""
        pass

    @abstractmethod
    async def get_owner_role(self, company_id: UUID) -> CompanyRole | None:
        """Получить роль владельца компании."""
        pass

    @abstractmethod
    async def get_system_roles(self, company_id: UUID) -> list[CompanyRole]:
        """Получить системные роли компании."""
        pass

    @abstractmethod
    async def get_custom_roles(self, company_id: UUID) -> list[CompanyRole]:
        """Получить кастомные (не системные) роли компании."""
        pass

    @abstractmethod
    async def count_by_company(self, company_id: UUID) -> int:
        """Получить количество ролей в компании."""
        pass

    @abstractmethod
    async def update(self, role: CompanyRole) -> CompanyRole:
        """Обновить роль."""
        pass

    @abstractmethod
    async def delete(self, role_id: UUID) -> bool:
        """Удалить роль."""
        pass

    @abstractmethod
    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить все роли компании."""
        pass

    @abstractmethod
    async def create_system_roles(self, company_id: UUID) -> list[CompanyRole]:
        """
        Создать системные роли для новой компании.
        Возвращает список созданных ролей: [owner, admin, member].
        """
        pass

    @abstractmethod
    async def get_next_priority(self, company_id: UUID) -> int:
        """Получить следующий доступный приоритет для новой роли."""
        pass

    @abstractmethod
    async def reorder_roles(
        self, company_id: UUID, role_priorities: dict[UUID, int]
    ) -> list[CompanyRole]:
        """
        Переупорядочить роли по приоритету.
        
        Args:
            company_id: ID компании
            role_priorities: Словарь {role_id: new_priority}
            
        Returns:
            Обновлённый список ролей
        """
        pass
