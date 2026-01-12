"""API handlers для проектов."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from application.services.project import (
    ProjectService,
    ProjectNotFoundError,
    ProjectAccessDeniedError,
    AlreadyMemberError,
    CreateProjectData,
)
from application.services.chat import ChatService
from infrastructure.dependencies import (
    get_project_service,
    get_chat_service,
    get_user_service,
    get_current_user_id,
)
from presentation.api.projects.schemas import (
    CreateProjectRequest,
    UpdateProjectRequest,
    InviteMemberRequest,
    JoinRequestRequest,
    ProjectResponse,
    ProjectListResponse,
    ProjectDetailResponse,
    ProjectMemberResponse,
    InvitationResponse,
)


router = APIRouter(prefix="/projects", tags=["projects"])


def _project_to_response(
    project,
    is_member: bool = False,
    my_role: str | None = None,
    unread_count: int = 0,
) -> ProjectResponse:
    """Преобразовать сущность проекта в response."""
    return ProjectResponse(
        id=project.id,
        idea_id=project.idea_id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        status=project.status.value,
        company_id=project.company_id,
        avatar_url=project.avatar_url,
        is_public=project.is_public,
        allow_join_requests=project.allow_join_requests,
        members_count=project.members_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
        is_member=is_member,
        my_role=my_role,
        unread_count=unread_count,
    )


def _member_to_response(member, user=None) -> ProjectMemberResponse:
    """Преобразовать сущность участника в response."""
    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role.value,
        position=member.position,
        skills=member.skills,
        joined_at=member.joined_at,
        user_name=f"{user.first_name} {user.last_name}".strip() if user else None,
        user_avatar_url=user.avatar_url if user else None,
    )


# ============ Projects CRUD ============


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: CreateProjectRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Создать новый проект."""
    project = await project_service.create_project(
        owner_id=current_user_id,
        data=CreateProjectData(
            name=data.name,
            description=data.description,
            idea_id=data.idea_id,
            company_id=data.company_id,
            is_public=data.is_public,
            allow_join_requests=data.allow_join_requests,
        ),
    )

    return _project_to_response(project, is_member=True, my_role="owner")


@router.post("/from-idea/{idea_id}", response_model=ProjectResponse)
async def create_project_from_idea(
    idea_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Создать проект из идеи."""
    try:
        project = await project_service.create_from_idea(
            idea_id=idea_id,
            owner_id=current_user_id,
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only idea author can create project",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return _project_to_response(project, is_member=True, my_role="owner")


@router.get("/my", response_model=ProjectListResponse)
async def get_my_projects(
    include_pending: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Получить мои проекты."""
    projects = await project_service.get_my_projects(
        user_id=current_user_id,
        include_pending=include_pending,
        limit=limit,
        offset=offset,
    )

    # Получаем непрочитанные сообщения
    unread_counts = await chat_service.get_unread_counts(current_user_id)

    responses = []
    for project in projects:
        member = await project_service._member_repo.get_by_project_and_user(
            project.id, current_user_id
        )
        responses.append(
            _project_to_response(
                project,
                is_member=True,
                my_role=member.role.value if member else None,
                unread_count=unread_counts.get(project.id, 0),
            )
        )

    return ProjectListResponse(
        projects=responses,
        total=len(responses),
    )


@router.get("/invitations", response_model=list[InvitationResponse])
async def get_my_invitations(
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
    user_service=Depends(get_user_service),
):
    """Получить мои приглашения в проекты."""
    invitations = await project_service.get_my_invitations(current_user_id)

    responses = []
    for inv in invitations:
        try:
            project = await project_service.get_project(inv.project_id)
            inviter = None
            if inv.invited_by:
                try:
                    inviter = await user_service.get_user(inv.invited_by)
                except Exception:
                    pass

            responses.append(
                InvitationResponse(
                    id=inv.id,
                    project_id=inv.project_id,
                    project_name=project.name,
                    invited_by=inv.invited_by,
                    inviter_name=(
                        f"{inviter.first_name} {inviter.last_name}".strip()
                        if inviter
                        else None
                    ),
                    message=inv.invitation_message,
                    created_at=inv.joined_at,
                )
            )
        except Exception:
            pass

    return responses


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
    user_service=Depends(get_user_service),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Получить проект по ID."""
    try:
        project = await project_service.get_project(project_id)
    except ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Проверяем членство
    is_member = await project_service.is_member(project_id, current_user_id)
    member = await project_service._member_repo.get_by_project_and_user(
        project_id, current_user_id
    )

    # Получаем участников
    members = await project_service.get_members(project_id)
    member_responses = []
    for m in members:
        try:
            user = await user_service.get_user(m.user_id)
            member_responses.append(_member_to_response(m, user))
        except Exception:
            member_responses.append(_member_to_response(m))

    # Непрочитанные
    unread_count = 0
    if is_member:
        unread_count = await chat_service.get_unread_count(project_id, current_user_id)

    return ProjectDetailResponse(
        id=project.id,
        idea_id=project.idea_id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        status=project.status.value,
        company_id=project.company_id,
        avatar_url=project.avatar_url,
        is_public=project.is_public,
        allow_join_requests=project.allow_join_requests,
        members_count=project.members_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
        is_member=is_member,
        my_role=member.role.value if member else None,
        unread_count=unread_count,
        members=member_responses,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: UpdateProjectRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Обновить проект."""
    try:
        project = await project_service.update_project(
            project_id=project_id,
            user_id=current_user_id,
            name=data.name,
            description=data.description,
            is_public=data.is_public,
            allow_join_requests=data.allow_join_requests,
        )
    except ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return _project_to_response(project, is_member=True, my_role="owner")


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Удалить проект."""
    try:
        await project_service.delete_project(project_id, current_user_id)
    except ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner can delete project",
        )


# ============ Members ============


@router.post("/{project_id}/invite", response_model=ProjectMemberResponse)
async def invite_member(
    project_id: UUID,
    data: InviteMemberRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Пригласить пользователя в проект."""
    try:
        member = await project_service.invite_member(
            project_id=project_id,
            user_id=data.user_id,
            inviter_id=current_user_id,
            message=data.message,
        )
    except ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    except AlreadyMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return _member_to_response(member)


@router.post("/{project_id}/join", response_model=ProjectMemberResponse)
async def request_to_join(
    project_id: UUID,
    data: JoinRequestRequest = None,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Подать заявку на вступление в проект."""
    try:
        member = await project_service.request_to_join(
            project_id=project_id,
            user_id=current_user_id,
            message=data.message if data else None,
        )
    except ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    except AlreadyMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return _member_to_response(member)


@router.post("/{project_id}/accept-invitation", response_model=ProjectMemberResponse)
async def accept_invitation(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
    chat_service: ChatService = Depends(get_chat_service),
    user_service=Depends(get_user_service),
):
    """Принять приглашение в проект."""
    try:
        member = await project_service.accept_invitation(project_id, current_user_id)

        # Отправляем системное сообщение в чат
        user = await user_service.get_user(current_user_id)
        user_name = f"{user.first_name} {user.last_name}".strip()
        await chat_service.send_system_message(
            project_id, f"{user_name} присоединился к проекту"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return _member_to_response(member)


@router.post("/{project_id}/decline-invitation", status_code=status.HTTP_204_NO_CONTENT)
async def decline_invitation(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Отклонить приглашение."""
    await project_service._member_repo.delete_by_project_and_user(
        project_id, current_user_id
    )


@router.post(
    "/{project_id}/requests/{user_id}/accept", response_model=ProjectMemberResponse
)
async def accept_join_request(
    project_id: UUID,
    user_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Принять заявку на вступление."""
    try:
        member = await project_service.accept_join_request(
            project_id=project_id,
            user_id=user_id,
            admin_id=current_user_id,
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return _member_to_response(member)


@router.post(
    "/{project_id}/requests/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT
)
async def reject_join_request(
    project_id: UUID,
    user_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Отклонить заявку на вступление."""
    try:
        await project_service.reject_join_request(
            project_id=project_id,
            user_id=user_id,
            admin_id=current_user_id,
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )


@router.post("/{project_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_project(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
    chat_service: ChatService = Depends(get_chat_service),
    user_service=Depends(get_user_service),
):
    """Покинуть проект."""
    try:
        # Отправляем системное сообщение перед выходом
        user = await user_service.get_user(current_user_id)
        user_name = f"{user.first_name} {user.last_name}".strip()
        await chat_service.send_system_message(
            project_id, f"{user_name} покинул проект"
        )

        await project_service.leave_project(project_id, current_user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    project_id: UUID,
    user_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Удалить участника из проекта."""
    try:
        await project_service.remove_member(
            project_id=project_id,
            user_id=user_id,
            admin_id=current_user_id,
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{project_id}/requests", response_model=list[ProjectMemberResponse])
async def get_pending_requests(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
    user_service=Depends(get_user_service),
):
    """Получить ожидающие заявки на вступление."""
    try:
        requests = await project_service.get_pending_requests(
            project_id, current_user_id
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    responses = []
    for req in requests:
        try:
            user = await user_service.get_user(req.user_id)
            responses.append(_member_to_response(req, user))
        except Exception:
            responses.append(_member_to_response(req))

    return responses


# ============ Status ============


@router.post("/{project_id}/activate", response_model=ProjectResponse)
async def activate_project(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Активировать проект (начать работу)."""
    try:
        project = await project_service.activate_project(project_id, current_user_id)
    except ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return _project_to_response(project, is_member=True)


@router.post("/{project_id}/complete", response_model=ProjectResponse)
async def complete_project(
    project_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
):
    """Завершить проект."""
    try:
        project = await project_service.complete_project(project_id, current_user_id)
    except ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    except ProjectAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner can complete project",
        )

    return _project_to_response(project, is_member=True)
