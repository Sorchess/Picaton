"""Интерфейс репозитория компаний."""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.company import Company, CompanyMember, CompanyInvitation
from domain.enums.company import InvitationStatus


class CompanyRepositoryInterface(ABC):
    """Интерфейс репозитория компаний."""

    @abstractmethod
    async def create(self, company: Company) -> Company:
        """Создать компанию."""
        pass

    @abstractmethod
    async def get_by_id(self, company_id: UUID) -> Company | None:
        """Получить компанию по ID."""
        pass

    @abstractmethod
    async def get_by_domain(self, domain: str) -> Company | None:
        """Получить компанию по домену email."""
        pass

    @abstractmethod
    async def get_by_company_id(self, company_id: str) -> Company | None:
        """Получить компанию по уникальному идентификатору."""
        pass

    @abstractmethod
    async def get_by_owner(self, owner_id: UUID) -> list[Company]:
        """Получить все компании владельца."""
        pass

    @abstractmethod
    async def update(self, company: Company) -> Company:
        """Обновить компанию."""
        pass

    @abstractmethod
    async def delete(self, company_id: UUID) -> bool:
        """Удалить компанию."""
        pass


class CompanyMemberRepositoryInterface(ABC):
    """Интерфейс репозитория членов компании."""

    @abstractmethod
    async def create(self, member: CompanyMember) -> CompanyMember:
        """Создать членство."""
        pass

    @abstractmethod
    async def get_by_id(self, member_id: UUID) -> CompanyMember | None:
        """Получить членство по ID."""
        pass

    @abstractmethod
    async def get_by_company_and_user(
        self, company_id: UUID, user_id: UUID
    ) -> CompanyMember | None:
        """Получить членство пользователя в компании."""
        pass

    @abstractmethod
    async def get_by_company(
        self, company_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[CompanyMember]:
        """Получить всех членов компании."""
        pass

    @abstractmethod
    async def get_by_user(self, user_id: UUID) -> list[CompanyMember]:
        """Получить все компании пользователя."""
        pass

    @abstractmethod
    async def count_by_company(self, company_id: UUID) -> int:
        """Получить количество членов компании."""
        pass

    @abstractmethod
    async def update(self, member: CompanyMember) -> CompanyMember:
        """Обновить членство."""
        pass

    @abstractmethod
    async def delete(self, member_id: UUID) -> bool:
        """Удалить членство."""
        pass

    @abstractmethod
    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить всех членов компании."""
        pass


class CompanyInvitationRepositoryInterface(ABC):
    """Интерфейс репозитория приглашений в компанию."""

    @abstractmethod
    async def create(self, invitation: CompanyInvitation) -> CompanyInvitation:
        """Создать приглашение."""
        pass

    @abstractmethod
    async def get_by_id(self, invitation_id: UUID) -> CompanyInvitation | None:
        """Получить приглашение по ID."""
        pass

    @abstractmethod
    async def get_by_token(self, token: str) -> CompanyInvitation | None:
        """Получить приглашение по токену."""
        pass

    @abstractmethod
    async def get_by_email(
        self, email: str, status: InvitationStatus | None = None
    ) -> list[CompanyInvitation]:
        """Получить приглашения по email."""
        pass

    @abstractmethod
    async def get_by_company(
        self,
        company_id: UUID,
        status: InvitationStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CompanyInvitation]:
        """Получить приглашения компании."""
        pass

    @abstractmethod
    async def get_pending_by_email_and_company(
        self, email: str, company_id: UUID
    ) -> CompanyInvitation | None:
        """Получить активное приглашение для email в компанию."""
        pass

    @abstractmethod
    async def update(self, invitation: CompanyInvitation) -> CompanyInvitation:
        """Обновить приглашение."""
        pass

    @abstractmethod
    async def delete(self, invitation_id: UUID) -> bool:
        """Удалить приглашение."""
        pass

    @abstractmethod
    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить все приглашения компании."""
        pass

    @abstractmethod
    async def expire_old_invitations(self) -> int:
        """Пометить истёкшие приглашения."""
        pass
