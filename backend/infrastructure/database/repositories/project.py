"""MongoDB реализация репозитория проектов."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.project import Project
from domain.enums.project import ProjectStatus
from domain.repositories.project import ProjectRepositoryInterface


class MongoProjectRepository(ProjectRepositoryInterface):
    """MongoDB реализация репозитория проектов."""

    def __init__(
        self,
        collection: AsyncIOMotorCollection,
        members_collection: AsyncIOMotorCollection,
    ):
        self._collection = collection
        self._members_collection = members_collection

    def _to_document(self, project: Project) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(project.id),
            "idea_id": str(project.idea_id) if project.idea_id else None,
            "name": project.name,
            "description": project.description,
            "owner_id": str(project.owner_id),
            "status": project.status.value,
            "company_id": str(project.company_id) if project.company_id else None,
            "avatar_url": project.avatar_url,
            "is_public": project.is_public,
            "allow_join_requests": project.allow_join_requests,
            "tags": project.tags,
            "required_skills": project.required_skills,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "problem": project.problem,
            "solution": project.solution,
            "members_count": project.members_count,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        }

    def _from_document(self, doc: dict) -> Project:
        """Преобразовать документ MongoDB в сущность."""
        from datetime import date as date_type

        deadline = None
        if doc.get("deadline"):
            try:
                if isinstance(doc["deadline"], str):
                    deadline = date_type.fromisoformat(doc["deadline"])
                elif isinstance(doc["deadline"], datetime):
                    deadline = doc["deadline"].date()
            except (ValueError, TypeError):
                deadline = None

        return Project(
            id=UUID(doc["_id"]),
            idea_id=UUID(doc["idea_id"]) if doc.get("idea_id") else None,
            name=doc.get("name", ""),
            description=doc.get("description", ""),
            owner_id=UUID(doc["owner_id"]),
            status=ProjectStatus(doc.get("status", "forming")),
            company_id=UUID(doc["company_id"]) if doc.get("company_id") else None,
            avatar_url=doc.get("avatar_url"),
            is_public=doc.get("is_public", True),
            allow_join_requests=doc.get("allow_join_requests", True),
            tags=doc.get("tags", []),
            required_skills=doc.get("required_skills", []),
            deadline=deadline,
            problem=doc.get("problem", ""),
            solution=doc.get("solution", ""),
            members_count=doc.get("members_count", 1),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    async def create(self, project: Project) -> Project:
        """Создать проект."""
        doc = self._to_document(project)
        await self._collection.insert_one(doc)
        return project

    async def get_by_id(self, project_id: UUID) -> Project | None:
        """Получить проект по ID."""
        doc = await self._collection.find_one({"_id": str(project_id)})
        return self._from_document(doc) if doc else None

    async def update(self, project: Project) -> Project:
        """Обновить проект."""
        doc = self._to_document(project)
        await self._collection.replace_one({"_id": str(project.id)}, doc)
        return project

    async def delete(self, project_id: UUID) -> bool:
        """Удалить проект."""
        result = await self._collection.delete_one({"_id": str(project_id)})
        return result.deleted_count > 0

    async def get_by_idea(self, idea_id: UUID) -> Project | None:
        """Получить проект по ID идеи."""
        doc = await self._collection.find_one({"idea_id": str(idea_id)})
        return self._from_document(doc) if doc else None

    async def get_by_owner(
        self,
        owner_id: UUID,
        status: ProjectStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]:
        """Получить проекты владельца."""
        query = {"owner_id": str(owner_id)}
        if status:
            query["status"] = status.value

        cursor = (
            self._collection.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def get_user_projects(
        self,
        user_id: UUID,
        include_pending: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]:
        """Получить проекты, в которых участвует пользователь."""
        # Сначала получаем project_ids из members collection
        member_query = {"user_id": str(user_id)}
        if not include_pending:
            member_query["role"] = {"$in": ["owner", "admin", "member"]}

        member_cursor = self._members_collection.find(
            member_query,
            {"project_id": 1},
        )
        project_ids = [doc["project_id"] async for doc in member_cursor]

        if not project_ids:
            return []

        # Затем получаем сами проекты
        cursor = (
            self._collection.find({"_id": {"$in": project_ids}})
            .sort("updated_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def get_public_projects(
        self,
        company_id: UUID | None = None,
        status: ProjectStatus | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Project]:
        """Получить публичные проекты."""
        query = {"is_public": True}
        if company_id:
            query["company_id"] = str(company_id)
        if status:
            query["status"] = status.value
        else:
            query["status"] = {
                "$in": [ProjectStatus.FORMING.value, ProjectStatus.ACTIVE.value]
            }

        cursor = (
            self._collection.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def search_by_text(
        self,
        query: str,
        limit: int = 20,
    ) -> list[Project]:
        """Полнотекстовый поиск проектов."""
        search_query = {
            "is_public": True,
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}},
            ],
        }

        cursor = self._collection.find(search_query).limit(limit)
        return [self._from_document(doc) async for doc in cursor]

    async def update_members_count(
        self,
        project_id: UUID,
        count: int,
    ) -> None:
        """Обновить счётчик участников."""
        await self._collection.update_one(
            {"_id": str(project_id)},
            {
                "$set": {
                    "members_count": count,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
