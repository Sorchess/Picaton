"""MongoDB реализация репозиториев для компаний."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.company import Company, CompanyMember, CompanyInvitation
from domain.enums.company import InvitationStatus
from domain.repositories.company import (
    CompanyRepositoryInterface,
    CompanyMemberRepositoryInterface,
    CompanyInvitationRepositoryInterface,
)


class MongoCompanyRepository(CompanyRepositoryInterface):
    """MongoDB реализация репозитория компаний."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, company: Company) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(company.id),
            "name": company.name,
            "company_id": company.company_id,
            "email_domain": company.email_domain,
            "logo_url": company.logo_url,
            "description": company.description,
            "owner_id": str(company.owner_id) if company.owner_id else None,
            "is_active": company.is_active,
            "created_at": company.created_at,
            "updated_at": company.updated_at,
        }

    def _from_document(self, doc: dict) -> Company:
        """Преобразовать документ MongoDB в сущность."""
        return Company(
            id=UUID(doc["_id"]),
            name=doc.get("name", ""),
            company_id=doc.get("company_id", ""),
            email_domain=doc.get("email_domain", ""),
            logo_url=doc.get("logo_url"),
            description=doc.get("description"),
            owner_id=UUID(doc["owner_id"]) if doc.get("owner_id") else None,
            is_active=doc.get("is_active", True),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    async def create(self, company: Company) -> Company:
        """Создать компанию."""
        doc = self._to_document(company)
        await self._collection.insert_one(doc)
        return company

    async def get_by_id(self, company_id: UUID) -> Company | None:
        """Получить компанию по ID."""
        doc = await self._collection.find_one({"_id": str(company_id)})
        return self._from_document(doc) if doc else None

    async def get_by_domain(self, domain: str) -> Company | None:
        """Получить компанию по домену email."""
        doc = await self._collection.find_one({"email_domain": domain.lower()})
        return self._from_document(doc) if doc else None

    async def get_by_company_id(self, company_id: str) -> Company | None:
        """Получить компанию по уникальному идентификатору."""
        doc = await self._collection.find_one({"company_id": company_id})
        return self._from_document(doc) if doc else None

    async def get_by_owner(self, owner_id: UUID) -> list[Company]:
        """Получить все компании владельца."""
        cursor = self._collection.find({"owner_id": str(owner_id)})
        companies = []
        async for doc in cursor:
            companies.append(self._from_document(doc))
        return companies

    async def update(self, company: Company) -> Company:
        """Обновить компанию."""
        doc = self._to_document(company)
        await self._collection.replace_one({"_id": str(company.id)}, doc)
        return company

    async def delete(self, company_id: UUID) -> bool:
        """Удалить компанию."""
        result = await self._collection.delete_one({"_id": str(company_id)})
        return result.deleted_count > 0


class MongoCompanyMemberRepository(CompanyMemberRepositoryInterface):
    """MongoDB реализация репозитория членов компании."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, member: CompanyMember) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(member.id),
            "company_id": str(member.company_id),
            "user_id": str(member.user_id),
            "role_id": str(member.role_id) if member.role_id else None,
            "position": member.position,
            "department": member.department,
            "selected_card_id": (
                str(member.selected_card_id) if member.selected_card_id else None
            ),
            "joined_at": member.joined_at,
            "updated_at": member.updated_at,
        }

    def _from_document(self, doc: dict) -> CompanyMember:
        """Преобразовать документ MongoDB в сущность."""
        selected_card_id = doc.get("selected_card_id")
        role_id = doc.get("role_id")

        return CompanyMember(
            id=UUID(doc["_id"]),
            company_id=UUID(doc["company_id"]),
            user_id=UUID(doc["user_id"]),
            role_id=UUID(role_id) if role_id else None,
            position=doc.get("position"),
            department=doc.get("department"),
            selected_card_id=UUID(selected_card_id) if selected_card_id else None,
            joined_at=doc.get("joined_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    async def create(self, member: CompanyMember) -> CompanyMember:
        """Создать членство."""
        doc = self._to_document(member)
        await self._collection.insert_one(doc)
        return member

    async def get_by_id(self, member_id: UUID) -> CompanyMember | None:
        """Получить членство по ID."""
        doc = await self._collection.find_one({"_id": str(member_id)})
        return self._from_document(doc) if doc else None

    async def get_by_company_and_user(
        self, company_id: UUID, user_id: UUID
    ) -> CompanyMember | None:
        """Получить членство пользователя в компании."""
        doc = await self._collection.find_one(
            {
                "company_id": str(company_id),
                "user_id": str(user_id),
            }
        )
        return self._from_document(doc) if doc else None

    async def get_by_company(
        self, company_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[CompanyMember]:
        """Получить всех членов компании."""
        cursor = (
            self._collection.find({"company_id": str(company_id)})
            .skip(skip)
            .limit(limit)
        )
        members = []
        async for doc in cursor:
            members.append(self._from_document(doc))
        return members

    async def get_by_user(self, user_id: UUID) -> list[CompanyMember]:
        """Получить все компании пользователя."""
        cursor = self._collection.find({"user_id": str(user_id)})
        members = []
        async for doc in cursor:
            members.append(self._from_document(doc))
        return members

    async def count_by_company(self, company_id: UUID) -> int:
        """Получить количество членов компании."""
        return await self._collection.count_documents({"company_id": str(company_id)})

    async def update(self, member: CompanyMember) -> CompanyMember:
        """Обновить членство."""
        doc = self._to_document(member)
        await self._collection.replace_one({"_id": str(member.id)}, doc)
        return member

    async def delete(self, member_id: UUID) -> bool:
        """Удалить членство."""
        result = await self._collection.delete_one({"_id": str(member_id)})
        return result.deleted_count > 0

    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить всех членов компании."""
        result = await self._collection.delete_many({"company_id": str(company_id)})
        return result.deleted_count


class MongoCompanyInvitationRepository(CompanyInvitationRepositoryInterface):
    """MongoDB реализация репозитория приглашений."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, invitation: CompanyInvitation) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(invitation.id),
            "company_id": str(invitation.company_id),
            "email": invitation.email.lower(),
            "role_id": str(invitation.role_id) if invitation.role_id else None,
            "invited_by_id": (
                str(invitation.invited_by_id) if invitation.invited_by_id else None
            ),
            "status": invitation.status.value,
            "token": invitation.token,
            "created_at": invitation.created_at,
            "expires_at": invitation.expires_at,
            "responded_at": invitation.responded_at,
        }

    def _from_document(self, doc: dict) -> CompanyInvitation:
        """Преобразовать документ MongoDB в сущность."""
        return CompanyInvitation(
            id=UUID(doc["_id"]),
            company_id=UUID(doc["company_id"]),
            email=doc.get("email", ""),
            role_id=UUID(doc["role_id"]) if doc.get("role_id") else None,
            invited_by_id=(
                UUID(doc["invited_by_id"]) if doc.get("invited_by_id") else None
            ),
            status=InvitationStatus(doc.get("status", "pending")),
            token=doc.get("token", ""),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            expires_at=doc.get("expires_at"),
            responded_at=doc.get("responded_at"),
        )

    async def create(self, invitation: CompanyInvitation) -> CompanyInvitation:
        """Создать приглашение."""
        doc = self._to_document(invitation)
        await self._collection.insert_one(doc)
        return invitation

    async def get_by_id(self, invitation_id: UUID) -> CompanyInvitation | None:
        """Получить приглашение по ID."""
        doc = await self._collection.find_one({"_id": str(invitation_id)})
        return self._from_document(doc) if doc else None

    async def get_by_token(self, token: str) -> CompanyInvitation | None:
        """Получить приглашение по токену."""
        doc = await self._collection.find_one({"token": token})
        return self._from_document(doc) if doc else None

    async def get_by_email(
        self, email: str, status: InvitationStatus | None = None
    ) -> list[CompanyInvitation]:
        """Получить приглашения по email."""
        query = {"email": email.lower()}
        if status:
            query["status"] = status.value
        cursor = self._collection.find(query)
        invitations = []
        async for doc in cursor:
            invitations.append(self._from_document(doc))
        return invitations

    async def get_by_company(
        self,
        company_id: UUID,
        status: InvitationStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CompanyInvitation]:
        """Получить приглашения компании."""
        query = {"company_id": str(company_id)}
        if status:
            query["status"] = status.value
        cursor = (
            self._collection.find(query).skip(skip).limit(limit).sort("created_at", -1)
        )
        invitations = []
        async for doc in cursor:
            invitations.append(self._from_document(doc))
        return invitations

    async def get_pending_by_email_and_company(
        self, email: str, company_id: UUID
    ) -> CompanyInvitation | None:
        """Получить активное приглашение для email в компанию."""
        doc = await self._collection.find_one(
            {
                "email": email.lower(),
                "company_id": str(company_id),
                "status": InvitationStatus.PENDING.value,
            }
        )
        return self._from_document(doc) if doc else None

    async def update(self, invitation: CompanyInvitation) -> CompanyInvitation:
        """Обновить приглашение."""
        doc = self._to_document(invitation)
        await self._collection.replace_one({"_id": str(invitation.id)}, doc)
        return invitation

    async def delete(self, invitation_id: UUID) -> bool:
        """Удалить приглашение."""
        result = await self._collection.delete_one({"_id": str(invitation_id)})
        return result.deleted_count > 0

    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить все приглашения компании."""
        result = await self._collection.delete_many({"company_id": str(company_id)})
        return result.deleted_count

    async def expire_old_invitations(self) -> int:
        """Пометить истёкшие приглашения."""
        now = datetime.now(timezone.utc)
        result = await self._collection.update_many(
            {
                "status": InvitationStatus.PENDING.value,
                "expires_at": {"$lt": now},
            },
            {"$set": {"status": InvitationStatus.EXPIRED.value}},
        )
        return result.modified_count
