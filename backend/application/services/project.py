"""Сервис управления проектами."""

import logging
from dataclasses import dataclass, field
from datetime import date
from uuid import UUID, uuid4

from domain.entities.project import Project
from domain.entities.project_member import ProjectMember
from domain.entities.chat_message import ChatMessage
from domain.enums.project import ProjectStatus, ProjectMemberRole
from domain.repositories.project import ProjectRepositoryInterface
from domain.repositories.project_member import ProjectMemberRepositoryInterface
from domain.repositories.idea import IdeaRepositoryInterface
from domain.repositories.chat_message import ChatMessageRepositoryInterface


logger = logging.getLogger(__name__)


class ProjectNotFoundError(Exception):
    """Проект не найден."""

    def __init__(self, project_id: str):
        self.project_id = project_id
        super().__init__(f"Project not found: {project_id}")


class ProjectAccessDeniedError(Exception):
    """Доступ к проекту запрещён."""

    def __init__(self, project_id: str, user_id: str):
        self.project_id = project_id
        self.user_id = user_id
        super().__init__(f"Access denied to project {project_id} for user {user_id}")


class AlreadyMemberError(Exception):
    """Пользователь уже является участником."""

    def __init__(self, project_id: str, user_id: str):
        self.project_id = project_id
        self.user_id = user_id
        super().__init__(f"User {user_id} is already a member of project {project_id}")


@dataclass
class CreateProjectData:
    """Данные для создания проекта."""

    name: str
    description: str = ""
    idea_id: UUID | None = None
    company_id: UUID | None = None
    is_public: bool = True
    allow_join_requests: bool = True
    tags: list[str] = field(default_factory=list)
    required_skills: list[str] = field(default_factory=list)
    deadline: date | None = None
    problem: str = ""
    solution: str = ""


class ProjectService:
    """Сервис управления проектами."""

    def __init__(
        self,
        project_repository: ProjectRepositoryInterface,
        member_repository: ProjectMemberRepositoryInterface,
        idea_repository: IdeaRepositoryInterface,
        chat_repository: ChatMessageRepositoryInterface,
    ):
        self._project_repo = project_repository
        self._member_repo = member_repository
        self._idea_repo = idea_repository
        self._chat_repo = chat_repository

    async def create_project(
        self,
        owner_id: UUID,
        data: CreateProjectData,
    ) -> Project:
        """Создать новый проект."""
        project = Project(
            id=uuid4(),
            idea_id=data.idea_id,
            name=data.name,
            description=data.description,
            owner_id=owner_id,
            company_id=data.company_id,
            is_public=data.is_public,
            allow_join_requests=data.allow_join_requests,
            tags=data.tags[:20] if data.tags else [],
            required_skills=data.required_skills[:30] if data.required_skills else [],
            deadline=data.deadline,
            problem=data.problem,
            solution=data.solution,
            status=ProjectStatus.FORMING,
            members_count=1,
        )

        project = await self._project_repo.create(project)

        # Добавляем владельца как участника
        owner_member = ProjectMember(
            id=uuid4(),
            project_id=project.id,
            user_id=owner_id,
            role=ProjectMemberRole.OWNER,
        )
        await self._member_repo.create(owner_member)

        # Если проект создан из идеи, обновляем статус идеи
        if data.idea_id:
            idea = await self._idea_repo.get_by_id(data.idea_id)
            if idea:
                idea.start_team_forming()
                await self._idea_repo.update(idea)

        return project

    async def create_from_idea(
        self,
        idea_id: UUID,
        owner_id: UUID,
    ) -> Project:
        """Создать проект из идеи."""
        idea = await self._idea_repo.get_by_id(idea_id)
        if not idea:
            raise ValueError(f"Idea not found: {idea_id}")

        if idea.author_id != owner_id:
            raise ProjectAccessDeniedError(str(idea_id), str(owner_id))

        # Проверяем, нет ли уже проекта для этой идеи
        existing = await self._project_repo.get_by_idea(idea_id)
        if existing:
            return existing

        return await self.create_project(
            owner_id=owner_id,
            data=CreateProjectData(
                name=idea.title,
                description=idea.description,
                idea_id=idea_id,
                company_id=idea.company_id,
            ),
        )

    async def get_project(self, project_id: UUID) -> Project:
        """Получить проект по ID."""
        project = await self._project_repo.get_by_id(project_id)
        if not project:
            raise ProjectNotFoundError(str(project_id))
        return project

    async def update_project(
        self,
        project_id: UUID,
        user_id: UUID,
        name: str | None = None,
        description: str | None = None,
        is_public: bool | None = None,
        allow_join_requests: bool | None = None,
        tags: list[str] | None = None,
        required_skills: list[str] | None = None,
        deadline: date | None = None,
        problem: str | None = None,
        solution: str | None = None,
    ) -> Project:
        """Обновить проект."""
        project = await self.get_project(project_id)

        # Проверяем права
        member = await self._member_repo.get_by_project_and_user(project_id, user_id)
        if not member or not member.is_admin_or_owner:
            raise ProjectAccessDeniedError(str(project_id), str(user_id))

        if name is not None:
            project.set_name(name)
        if description is not None:
            project.set_description(description)
        if is_public is not None:
            project.is_public = is_public
        if allow_join_requests is not None:
            project.allow_join_requests = allow_join_requests
        if tags is not None:
            project.set_tags(tags)
        if required_skills is not None:
            project.set_required_skills(required_skills)
        if deadline is not None:
            project.set_deadline(deadline)
        if problem is not None:
            project.set_problem(problem)
        if solution is not None:
            project.set_solution(solution)

        return await self._project_repo.update(project)

    async def delete_project(self, project_id: UUID, user_id: UUID) -> bool:
        """Удалить проект."""
        project = await self.get_project(project_id)

        if project.owner_id != user_id:
            raise ProjectAccessDeniedError(str(project_id), str(user_id))

        return await self._project_repo.delete(project_id)

    async def get_my_projects(
        self,
        user_id: UUID,
        include_pending: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]:
        """Получить проекты пользователя."""
        return await self._project_repo.get_user_projects(
            user_id=user_id,
            include_pending=include_pending,
            limit=limit,
            offset=offset,
        )

    async def get_public_projects(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]:
        """Получить публичные проекты для витрины."""
        return await self._project_repo.get_public_projects(
            limit=limit,
            offset=offset,
        )

    async def invite_member(
        self,
        project_id: UUID,
        user_id: UUID,
        inviter_id: UUID,
        message: str | None = None,
    ) -> ProjectMember:
        """Пригласить пользователя в проект."""
        project = await self.get_project(project_id)

        # Проверяем права приглашающего
        inviter = await self._member_repo.get_by_project_and_user(
            project_id, inviter_id
        )
        if not inviter or not inviter.is_admin_or_owner:
            raise ProjectAccessDeniedError(str(project_id), str(inviter_id))

        # Проверяем, что пользователь ещё не участник
        existing = await self._member_repo.get_by_project_and_user(project_id, user_id)
        if existing:
            raise AlreadyMemberError(str(project_id), str(user_id))

        if not project.can_accept_members:
            raise ValueError("Project cannot accept new members")

        member = ProjectMember(
            id=uuid4(),
            project_id=project_id,
            user_id=user_id,
            role=ProjectMemberRole.INVITED,
            invited_by=inviter_id,
            invitation_message=message,
        )

        return await self._member_repo.create(member)

    async def request_to_join(
        self,
        project_id: UUID,
        user_id: UUID,
        message: str | None = None,
    ) -> ProjectMember:
        """Подать заявку на вступление в проект."""
        project = await self.get_project(project_id)

        if not project.allow_join_requests:
            raise ValueError("Project does not accept join requests")

        if not project.can_accept_members:
            raise ValueError("Project cannot accept new members")

        # Проверяем, что пользователь ещё не участник
        existing = await self._member_repo.get_by_project_and_user(project_id, user_id)
        if existing:
            raise AlreadyMemberError(str(project_id), str(user_id))

        member = ProjectMember(
            id=uuid4(),
            project_id=project_id,
            user_id=user_id,
            role=ProjectMemberRole.PENDING,
            invitation_message=message,
        )

        return await self._member_repo.create(member)

    async def accept_invitation(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> ProjectMember:
        """Принять приглашение в проект."""
        member = await self._member_repo.get_by_project_and_user(project_id, user_id)
        if not member:
            raise ValueError("Invitation not found")

        if member.role != ProjectMemberRole.INVITED:
            raise ValueError("No pending invitation")

        member.accept_invitation()
        member = await self._member_repo.update(member)

        # Обновляем счётчик участников
        count = await self._member_repo.count_by_project(project_id)
        await self._project_repo.update_members_count(project_id, count)

        return member

    async def accept_join_request(
        self,
        project_id: UUID,
        user_id: UUID,
        admin_id: UUID,
    ) -> ProjectMember:
        """Принять заявку на вступление."""
        # Проверяем права админа
        admin = await self._member_repo.get_by_project_and_user(project_id, admin_id)
        if not admin or not admin.is_admin_or_owner:
            raise ProjectAccessDeniedError(str(project_id), str(admin_id))

        member = await self._member_repo.get_by_project_and_user(project_id, user_id)
        if not member:
            raise ValueError("Request not found")

        if member.role != ProjectMemberRole.PENDING:
            raise ValueError("No pending request")

        member.accept_request()
        member = await self._member_repo.update(member)

        # Обновляем счётчик участников
        count = await self._member_repo.count_by_project(project_id)
        await self._project_repo.update_members_count(project_id, count)

        return member

    async def reject_join_request(
        self,
        project_id: UUID,
        user_id: UUID,
        admin_id: UUID,
    ) -> bool:
        """Отклонить заявку на вступление."""
        # Проверяем права админа
        admin = await self._member_repo.get_by_project_and_user(project_id, admin_id)
        if not admin or not admin.is_admin_or_owner:
            raise ProjectAccessDeniedError(str(project_id), str(admin_id))

        return await self._member_repo.delete_by_project_and_user(project_id, user_id)

    async def leave_project(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Покинуть проект."""
        project = await self.get_project(project_id)

        if project.owner_id == user_id:
            raise ValueError("Owner cannot leave the project")

        result = await self._member_repo.delete_by_project_and_user(project_id, user_id)

        if result:
            # Обновляем счётчик участников
            count = await self._member_repo.count_by_project(project_id)
            await self._project_repo.update_members_count(project_id, count)

        return result

    async def remove_member(
        self,
        project_id: UUID,
        user_id: UUID,
        admin_id: UUID,
    ) -> bool:
        """Удалить участника из проекта (kick)."""
        project = await self.get_project(project_id)

        # Нельзя удалить владельца
        if project.owner_id == user_id:
            raise ValueError("Cannot remove the project owner")

        # Проверяем права админа
        admin = await self._member_repo.get_by_project_and_user(project_id, admin_id)
        if not admin or not admin.is_admin_or_owner:
            raise ProjectAccessDeniedError(str(project_id), str(admin_id))

        result = await self._member_repo.delete_by_project_and_user(project_id, user_id)

        if result:
            # Обновляем счётчик участников
            count = await self._member_repo.count_by_project(project_id)
            await self._project_repo.update_members_count(project_id, count)

        return result

    async def get_members(
        self,
        project_id: UUID,
        only_active: bool = True,
    ) -> list[ProjectMember]:
        """Получить участников проекта."""
        return await self._member_repo.get_by_project(
            project_id=project_id,
            only_active=only_active,
        )

    async def get_pending_requests(
        self,
        project_id: UUID,
        admin_id: UUID,
    ) -> list[ProjectMember]:
        """Получить ожидающие заявки на вступление."""
        # Проверяем права
        admin = await self._member_repo.get_by_project_and_user(project_id, admin_id)
        if not admin or not admin.is_admin_or_owner:
            raise ProjectAccessDeniedError(str(project_id), str(admin_id))

        return await self._member_repo.get_pending_requests(project_id)

    async def get_my_invitations(self, user_id: UUID) -> list[ProjectMember]:
        """Получить ожидающие приглашения."""
        return await self._member_repo.get_pending_invitations(user_id)

    async def is_member(self, project_id: UUID, user_id: UUID) -> bool:
        """Проверить, является ли пользователь участником проекта."""
        return await self._member_repo.is_member(project_id, user_id)

    async def activate_project(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> Project:
        """Активировать проект (начать работу)."""
        project = await self.get_project(project_id)

        member = await self._member_repo.get_by_project_and_user(project_id, user_id)
        if not member or not member.is_admin_or_owner:
            raise ProjectAccessDeniedError(str(project_id), str(user_id))

        project.activate()
        return await self._project_repo.update(project)

    async def complete_project(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> Project:
        """Завершить проект."""
        project = await self.get_project(project_id)

        if project.owner_id != user_id:
            raise ProjectAccessDeniedError(str(project_id), str(user_id))

        project.complete()

        # Обновляем статус связанной идеи
        if project.idea_id:
            idea = await self._idea_repo.get_by_id(project.idea_id)
            if idea:
                idea.mark_team_formed()
                await self._idea_repo.update(idea)

        return await self._project_repo.update(project)
