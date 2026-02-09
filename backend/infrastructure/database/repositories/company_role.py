"""MongoDB реализация репозитория ролей компании."""

import re
from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.company_role import (
    CompanyRole,
    OWNER_PRIORITY,
    ADMIN_PRIORITY,
    MEMBER_PRIORITY,
)
from domain.enums.permission import Permission
from domain.repositories.company_role import CompanyRoleRepositoryInterface


class MongoCompanyRoleRepository(CompanyRoleRepositoryInterface):
    """MongoDB реализация репозитория ролей компании."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, role: CompanyRole) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(role.id),
            "company_id": str(role.company_id),
            "name": role.name,
            "color": role.color,
            "priority": role.priority,
            "permissions": [p.value for p in role.permissions],
            "is_system": role.is_system,
            "is_default": role.is_default,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
        }

    def _from_document(self, doc: dict) -> CompanyRole:
        """Преобразовать документ MongoDB в сущность."""
        permissions_raw = doc.get("permissions", [])
        permissions = set()
        for p in permissions_raw:
            try:
                permissions.add(Permission(p))
            except ValueError:
                # Пропускаем неизвестные права (для совместимости)
                pass

        return CompanyRole(
            id=UUID(doc["_id"]),
            company_id=UUID(doc["company_id"]),
            name=doc.get("name", ""),
            color=doc.get("color", "#808080"),
            priority=doc.get("priority", MEMBER_PRIORITY),
            permissions=permissions,
            is_system=doc.get("is_system", False),
            is_default=doc.get("is_default", False),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    async def create(self, role: CompanyRole) -> CompanyRole:
        """Создать роль."""
        doc = self._to_document(role)
        await self._collection.insert_one(doc)
        return role

    async def get_by_id(self, role_id: UUID) -> CompanyRole | None:
        """Получить роль по ID."""
        doc = await self._collection.find_one({"_id": str(role_id)})
        return self._from_document(doc) if doc else None

    async def get_by_company(self, company_id: UUID) -> list[CompanyRole]:
        """Получить все роли компании (отсортированные по приоритету)."""
        cursor = self._collection.find({"company_id": str(company_id)}).sort(
            "priority", 1
        )  # По возрастанию приоритета (выше = важнее)

        roles = []
        async for doc in cursor:
            roles.append(self._from_document(doc))
        return roles

    async def get_by_company_and_name(
        self, company_id: UUID, name: str
    ) -> CompanyRole | None:
        """Получить роль по названию в компании."""
        doc = await self._collection.find_one(
            {
                "company_id": str(company_id),
                "name": {
                    "$regex": f"^{re.escape(name)}$",
                    "$options": "i",
                },  # Case-insensitive
            }
        )
        return self._from_document(doc) if doc else None

    async def get_default_role(self, company_id: UUID) -> CompanyRole | None:
        """Получить роль по умолчанию для компании."""
        doc = await self._collection.find_one(
            {"company_id": str(company_id), "is_default": True}
        )
        return self._from_document(doc) if doc else None

    async def get_owner_role(self, company_id: UUID) -> CompanyRole | None:
        """Получить роль владельца компании."""
        doc = await self._collection.find_one(
            {
                "company_id": str(company_id),
                "is_system": True,
                "priority": OWNER_PRIORITY,
            }
        )
        return self._from_document(doc) if doc else None

    async def get_system_roles(self, company_id: UUID) -> list[CompanyRole]:
        """Получить системные роли компании."""
        cursor = self._collection.find(
            {"company_id": str(company_id), "is_system": True}
        ).sort("priority", 1)

        roles = []
        async for doc in cursor:
            roles.append(self._from_document(doc))
        return roles

    async def get_custom_roles(self, company_id: UUID) -> list[CompanyRole]:
        """Получить кастомные (не системные) роли компании."""
        cursor = self._collection.find(
            {"company_id": str(company_id), "is_system": False}
        ).sort("priority", 1)

        roles = []
        async for doc in cursor:
            roles.append(self._from_document(doc))
        return roles

    async def count_by_company(self, company_id: UUID) -> int:
        """Получить количество ролей в компании."""
        return await self._collection.count_documents({"company_id": str(company_id)})

    async def update(self, role: CompanyRole) -> CompanyRole:
        """Обновить роль."""
        role.updated_at = datetime.now(timezone.utc)
        doc = self._to_document(role)
        await self._collection.replace_one({"_id": str(role.id)}, doc)
        return role

    async def delete(self, role_id: UUID) -> bool:
        """Удалить роль."""
        result = await self._collection.delete_one({"_id": str(role_id)})
        return result.deleted_count > 0

    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить все роли компании."""
        result = await self._collection.delete_many({"company_id": str(company_id)})
        return result.deleted_count

    async def create_system_roles(self, company_id: UUID) -> list[CompanyRole]:
        """
        Создать системные роли для новой компании.
        Возвращает список созданных ролей: [owner, admin, member].
        """
        owner_role = CompanyRole.create_owner_role(company_id)
        admin_role = CompanyRole.create_admin_role(company_id)
        member_role = CompanyRole.create_member_role(company_id)

        # Bulk insert для эффективности
        docs = [
            self._to_document(owner_role),
            self._to_document(admin_role),
            self._to_document(member_role),
        ]
        await self._collection.insert_many(docs)

        return [owner_role, admin_role, member_role]

    async def get_next_priority(self, company_id: UUID) -> int:
        """Получить следующий доступный приоритет для новой роли."""
        # Находим максимальный приоритет среди кастомных ролей
        pipeline = [
            {"$match": {"company_id": str(company_id), "is_system": False}},
            {"$group": {"_id": None, "max_priority": {"$max": "$priority"}}},
        ]

        cursor = self._collection.aggregate(pipeline)
        result = await cursor.to_list(length=1)

        if result and result[0].get("max_priority") is not None:
            # Следующий приоритет после максимального кастомного
            return result[0]["max_priority"] + 1

        # Если кастомных ролей нет, начинаем с 2 (после admin)
        return ADMIN_PRIORITY + 1

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
        # Обновляем приоритеты для каждой роли
        for role_id, priority in role_priorities.items():
            await self._collection.update_one(
                {
                    "_id": str(role_id),
                    "company_id": str(company_id),
                    "is_system": False,  # Нельзя менять приоритет системных ролей
                },
                {
                    "$set": {
                        "priority": priority,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )

        return await self.get_by_company(company_id)
