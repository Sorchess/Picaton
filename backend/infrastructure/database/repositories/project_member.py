"""MongoDB реализация репозитория участников проекта."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.project_member import ProjectMember
from domain.enums.project import ProjectMemberRole
from domain.repositories.project_member import ProjectMemberRepositoryInterface


class MongoProjectMemberRepository(ProjectMemberRepositoryInterface):
    """MongoDB реализация репозитория участников проекта."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, member: ProjectMember) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(member.id),
            "project_id": str(member.project_id),
            "user_id": str(member.user_id),
            "role": member.role.value,
            "skills": member.skills,
            "position": member.position,
            "joined_at": member.joined_at,
            "updated_at": member.updated_at,
            "invited_by": str(member.invited_by) if member.invited_by else None,
            "invitation_message": member.invitation_message,
        }

    def _from_document(self, doc: dict) -> ProjectMember:
        """Преобразовать документ MongoDB в сущность."""
        return ProjectMember(
            id=UUID(doc["_id"]),
            project_id=UUID(doc["project_id"]),
            user_id=UUID(doc["user_id"]),
            role=ProjectMemberRole(doc.get("role", "member")),
            skills=doc.get("skills", []),
            position=doc.get("position"),
            joined_at=doc.get("joined_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
            invited_by=UUID(doc["invited_by"]) if doc.get("invited_by") else None,
            invitation_message=doc.get("invitation_message"),
        )

    async def create(self, member: ProjectMember) -> ProjectMember:
        """Создать участника."""
        doc = self._to_document(member)
        await self._collection.insert_one(doc)
        return member

    async def get_by_id(self, member_id: UUID) -> ProjectMember | None:
        """Получить участника по ID."""
        doc = await self._collection.find_one({"_id": str(member_id)})
        return self._from_document(doc) if doc else None

    async def get_by_project_and_user(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> ProjectMember | None:
        """Получить участника проекта по user_id."""
        doc = await self._collection.find_one(
            {
                "project_id": str(project_id),
                "user_id": str(user_id),
            }
        )
        return self._from_document(doc) if doc else None

    async def update(self, member: ProjectMember) -> ProjectMember:
        """Обновить участника."""
        doc = self._to_document(member)
        await self._collection.replace_one({"_id": str(member.id)}, doc)
        return member

    async def delete(self, member_id: UUID) -> bool:
        """Удалить участника."""
        result = await self._collection.delete_one({"_id": str(member_id)})
        return result.deleted_count > 0

    async def delete_by_project_and_user(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Удалить участника по project_id и user_id."""
        result = await self._collection.delete_one(
            {
                "project_id": str(project_id),
                "user_id": str(user_id),
            }
        )
        return result.deleted_count > 0

    async def get_by_project(
        self,
        project_id: UUID,
        role: ProjectMemberRole | None = None,
        only_active: bool = True,
    ) -> list[ProjectMember]:
        """Получить участников проекта."""
        query = {"project_id": str(project_id)}

        if role:
            query["role"] = role.value
        elif only_active:
            query["role"] = {
                "$in": [
                    ProjectMemberRole.OWNER.value,
                    ProjectMemberRole.ADMIN.value,
                    ProjectMemberRole.MEMBER.value,
                ]
            }

        cursor = self._collection.find(query).sort("joined_at", 1)
        return [self._from_document(doc) async for doc in cursor]

    async def get_user_memberships(
        self,
        user_id: UUID,
        only_active: bool = True,
    ) -> list[ProjectMember]:
        """Получить все членства пользователя в проектах."""
        query = {"user_id": str(user_id)}

        if only_active:
            query["role"] = {
                "$in": [
                    ProjectMemberRole.OWNER.value,
                    ProjectMemberRole.ADMIN.value,
                    ProjectMemberRole.MEMBER.value,
                ]
            }

        cursor = self._collection.find(query).sort("joined_at", -1)
        return [self._from_document(doc) async for doc in cursor]

    async def count_by_project(
        self,
        project_id: UUID,
        only_active: bool = True,
    ) -> int:
        """Подсчитать участников проекта."""
        query = {"project_id": str(project_id)}

        if only_active:
            query["role"] = {
                "$in": [
                    ProjectMemberRole.OWNER.value,
                    ProjectMemberRole.ADMIN.value,
                    ProjectMemberRole.MEMBER.value,
                ]
            }

        return await self._collection.count_documents(query)

    async def get_pending_requests(
        self,
        project_id: UUID,
    ) -> list[ProjectMember]:
        """Получить ожидающие заявки на вступление."""
        cursor = self._collection.find(
            {
                "project_id": str(project_id),
                "role": ProjectMemberRole.PENDING.value,
            }
        ).sort("joined_at", 1)

        return [self._from_document(doc) async for doc in cursor]

    async def get_pending_invitations(
        self,
        user_id: UUID,
    ) -> list[ProjectMember]:
        """Получить ожидающие приглашения для пользователя."""
        cursor = self._collection.find(
            {
                "user_id": str(user_id),
                "role": ProjectMemberRole.INVITED.value,
            }
        ).sort("joined_at", -1)

        return [self._from_document(doc) async for doc in cursor]

    async def is_member(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Проверить, является ли пользователь участником проекта."""
        count = await self._collection.count_documents(
            {
                "project_id": str(project_id),
                "user_id": str(user_id),
                "role": {
                    "$in": [
                        ProjectMemberRole.OWNER.value,
                        ProjectMemberRole.ADMIN.value,
                        ProjectMemberRole.MEMBER.value,
                    ]
                },
            }
        )
        return count > 0

    async def get_project_ids_for_user(
        self,
        user_id: UUID,
        only_active: bool = True,
    ) -> list[UUID]:
        """Получить ID проектов пользователя."""
        query = {"user_id": str(user_id)}

        if only_active:
            query["role"] = {
                "$in": [
                    ProjectMemberRole.OWNER.value,
                    ProjectMemberRole.ADMIN.value,
                    ProjectMemberRole.MEMBER.value,
                ]
            }

        cursor = self._collection.find(query, {"project_id": 1})
        return [UUID(doc["project_id"]) async for doc in cursor]
