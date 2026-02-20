"""API handlers для управления компаниями."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from presentation.api.companies.schemas import (
    CreateCompanyRequest,
    UpdateCompanyRequest,
    CompanyResponse,
    CompanyWithRoleResponse,
    CompanyRoleInfo,
    CompanyMemberResponse,
    MemberUserInfo,
    UpdateMemberRoleRequest,
    CreateInvitationRequest,
    InvitationResponse,
    InvitationWithCompanyResponse,
    AcceptInvitationRequest,
    DeclineInvitationRequest,
    MessageResponse,
    SetSelectedCardRequest,
    CompanyCardAssignment,
)
from infrastructure.dependencies import (
    get_auth_service,
    get_company_service,
    get_company_role_repository,
    get_privacy_checker,
    get_user_service,
)
from domain.repositories.company_role import CompanyRoleRepositoryInterface
from application.services import (
    AuthService,
    InvalidTokenError,
    CompanyService,
    CompanyNotFoundError,
    CompanyAlreadyExistsError,
    MemberNotFoundError,
    AlreadyMemberError,
    InvitationNotFoundError,
    InvitationExpiredError,
    InvitationAlreadyExistsError,
    PermissionDeniedError,
    CannotRemoveOwnerError,
    CannotChangeOwnRoleError,
)
from application.services.privacy_checker import PrivacyChecker
from domain.exceptions.user import UserNotFoundError
from application.tasks import send_company_invitation_email
from domain.enums.company import InvitationStatus
from domain.entities.company import InvalidDomainError, InvalidCompanyNameError
from settings.config import settings


router = APIRouter()
security = HTTPBearer()


# ==================== Helpers ====================


async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials,
    auth_service: AuthService,
):
    """Получить текущего пользователя из токена."""
    try:
        return await auth_service.get_current_user(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ==================== Company CRUD ====================


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    data: CreateCompanyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """
    Создать новую компанию.

    Текущий пользователь становится владельцем компании.
    """
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        company = await company_service.create_company(
            owner=user,
            name=data.name,
            email_domain=data.email_domain,
            logo_url=data.logo_url,
            description=data.description,
        )
    except CompanyAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except InvalidDomainError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except InvalidCompanyNameError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    return CompanyResponse(
        id=company.id,
        name=company.name,
        email_domain=company.email_domain,
        logo_url=company.logo_url,
        description=company.description,
        owner_id=company.owner_id,
        is_active=company.is_active,
        created_at=company.created_at,
        updated_at=company.updated_at,
    )


@router.get("/my", response_model=list[CompanyWithRoleResponse])
async def get_my_companies(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Получить все компании текущего пользователя."""
    user = await get_current_user_from_token(credentials, auth_service)

    companies_data = await company_service.get_user_companies(user.id)

    return [
        CompanyWithRoleResponse(
            company=CompanyResponse(
                id=item["company"].id,
                name=item["company"].name,
                email_domain=item["company"].email_domain,
                logo_url=item["company"].logo_url,
                description=item["company"].description,
                owner_id=item["company"].owner_id,
                is_active=item["company"].is_active,
                created_at=item["company"].created_at,
                updated_at=item["company"].updated_at,
            ),
            role=(
                CompanyRoleInfo(
                    id=item["role"].id,
                    name=item["role"].name,
                    color=item["role"].color,
                    priority=item["role"].priority,
                    is_system=item["role"].is_system,
                )
                if item["role"]
                else None
            ),
            joined_at=item["joined_at"],
        )
        for item in companies_data
    ]


# ==================== User Invitations ====================
# NOTE: These routes MUST be defined BEFORE /{company_id} routes
# to avoid path parameter conflicts


@router.get("/invitations/my", response_model=list[InvitationWithCompanyResponse])
async def get_my_invitations(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
    role_repo: CompanyRoleRepositoryInterface = Depends(get_company_role_repository),
):
    """Получить ожидающие приглашения для текущего пользователя."""
    user = await get_current_user_from_token(credentials, auth_service)

    invitations_data = await company_service.get_pending_invitations_for_user(
        user.email
    )

    result = []
    for item in invitations_data:
        inv = item["invitation"]
        company = item["company"]
        inviter = item.get("invited_by")

        # Загружаем роль по role_id
        role = None
        if inv.role_id:
            role = await role_repo.get_by_id(inv.role_id)

        result.append(
            InvitationWithCompanyResponse(
                id=inv.id,
                company=CompanyResponse(
                    id=company.id,
                    name=company.name,
                    email_domain=company.email_domain,
                    logo_url=company.logo_url,
                    description=company.description,
                    owner_id=company.owner_id,
                    is_active=company.is_active,
                    created_at=company.created_at,
                    updated_at=company.updated_at,
                ),
                role=(
                    CompanyRoleInfo(
                        id=role.id,
                        name=role.name,
                        color=role.color,
                        priority=role.priority,
                        is_system=role.is_system,
                    )
                    if role
                    else None
                ),
                invited_by=(
                    MemberUserInfo(
                        id=inviter.id,
                        first_name=inviter.first_name,
                        last_name=inviter.last_name,
                        email=inviter.email,
                        avatar_url=inviter.avatar_url,
                    )
                    if inviter
                    else None
                ),
                status=inv.status,
                token=inv.token,
                created_at=inv.created_at,
                expires_at=inv.expires_at,
            )
        )

    return result


@router.post("/invitations/accept", response_model=MessageResponse)
async def accept_invitation(
    data: AcceptInvitationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Принять приглашение в компанию."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        await company_service.accept_invitation(data.token, user)
    except InvitationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except InvitationExpiredError as e:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=str(e),
        )
    except AlreadyMemberError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return MessageResponse(message="Вы успешно присоединились к компании")


@router.post("/invitations/decline", response_model=MessageResponse)
async def decline_invitation(
    data: DeclineInvitationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Отклонить приглашение в компанию."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        await company_service.decline_invitation(data.token, user)
    except InvitationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return MessageResponse(message="Приглашение отклонено")


# ==================== Card Selection ====================
# NOTE: These routes MUST be defined BEFORE /{company_id} routes
# to avoid path parameter conflicts


@router.get("/card-assignments/my", response_model=list[CompanyCardAssignment])
async def get_my_card_assignments(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Получить информацию о выбранных визитках для всех компаний текущего пользователя."""
    user = await get_current_user_from_token(credentials, auth_service)

    assignments = await company_service.get_user_card_assignments(user.id)

    return [
        CompanyCardAssignment(
            company_id=a["company_id"],
            company_name=a["company_name"],
            selected_card_id=a["selected_card_id"],
        )
        for a in assignments
    ]


# ==================== Company by ID ====================


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Получить данные компании."""
    await get_current_user_from_token(credentials, auth_service)

    try:
        company = await company_service.get_company(company_id)
    except CompanyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена",
        )

    return CompanyResponse(
        id=company.id,
        name=company.name,
        email_domain=company.email_domain,
        logo_url=company.logo_url,
        description=company.description,
        owner_id=company.owner_id,
        is_active=company.is_active,
        created_at=company.created_at,
        updated_at=company.updated_at,
    )


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: UUID,
    data: UpdateCompanyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Обновить данные компании (только для владельца/админа)."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        company = await company_service.update_company(
            company_id=company_id,
            user_id=user.id,
            name=data.name,
            logo_url=data.logo_url,
            description=data.description,
        )
    except CompanyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена",
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return CompanyResponse(
        id=company.id,
        name=company.name,
        email_domain=company.email_domain,
        logo_url=company.logo_url,
        description=company.description,
        owner_id=company.owner_id,
        is_active=company.is_active,
        created_at=company.created_at,
        updated_at=company.updated_at,
    )


@router.delete("/{company_id}", response_model=MessageResponse)
async def delete_company(
    company_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Удалить компанию (только для владельца)."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        await company_service.delete_company(company_id, user.id)
    except CompanyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена",
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return MessageResponse(message="Компания успешно удалена")


# ==================== Members ====================


@router.get("/{company_id}/members", response_model=list[CompanyMemberResponse])
async def get_company_members(
    company_id: UUID,
    skip: int = 0,
    limit: int = 100,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Получить членов компании."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        members_data = await company_service.get_members(
            company_id=company_id,
            user_id=user.id,
            skip=skip,
            limit=limit,
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return [
        CompanyMemberResponse(
            id=m["id"],
            user=MemberUserInfo(
                id=m["user"].id,
                first_name=m["user"].first_name,
                last_name=m["user"].last_name,
                email=m["user"].email,
                avatar_url=m["user"].avatar_url,
            ),
            role=(
                CompanyRoleInfo(
                    id=m["role"].id,
                    name=m["role"].name,
                    color=m["role"].color,
                    priority=m["role"].priority,
                    is_system=m["role"].is_system,
                )
                if m["role"]
                else None
            ),
            selected_card_id=m["selected_card_id"],
            joined_at=m["joined_at"],
        )
        for m in members_data
    ]


@router.patch("/{company_id}/members/{user_id}/role", response_model=MessageResponse)
async def update_member_role(
    company_id: UUID,
    user_id: UUID,
    data: UpdateMemberRoleRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Изменить роль члена компании (только для владельца)."""
    current_user = await get_current_user_from_token(credentials, auth_service)

    try:
        await company_service.update_member_role(
            company_id=company_id,
            member_user_id=user_id,
            new_role_id=data.role_id,
            admin_user_id=current_user.id,
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except MemberNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except CannotChangeOwnRoleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Роль успешно изменена")


@router.delete("/{company_id}/members/{user_id}", response_model=MessageResponse)
async def remove_member(
    company_id: UUID,
    user_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Удалить члена из компании (для владельца/админа)."""
    current_user = await get_current_user_from_token(credentials, auth_service)

    try:
        await company_service.remove_member(
            company_id=company_id,
            member_user_id=user_id,
            admin_user_id=current_user.id,
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except MemberNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except CannotRemoveOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Член команды удалён")


@router.post("/{company_id}/leave", response_model=MessageResponse)
async def leave_company(
    company_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Покинуть компанию."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        await company_service.leave_company(company_id, user.id)
    except MemberNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except CannotRemoveOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Вы покинули компанию")


# ==================== Invitations ====================


@router.post(
    "/{company_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    company_id: UUID,
    data: CreateInvitationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
    role_repo: CompanyRoleRepositoryInterface = Depends(get_company_role_repository),
    privacy_checker: PrivacyChecker = Depends(get_privacy_checker),
    user_service=Depends(get_user_service),
):
    """Создать приглашение в компанию (для владельца/админа)."""
    user = await get_current_user_from_token(credentials, auth_service)

    # Проверка приватности: если приглашаемый зарегистрирован, проверяем его настройки
    try:
        target_user = await user_service.get_user_by_email(data.email.lower())
        can_invite = await privacy_checker.can_invite_to_company(
            user.id, target_user.id
        )
        if not can_invite:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Настройки приватности пользователя не позволяют отправлять приглашения",
            )
    except UserNotFoundError:
        pass  # Пользователь не зарегистрирован — ограничений приватности нет

    try:
        invitation = await company_service.create_invitation(
            company_id=company_id,
            email=data.email,
            role_id=data.role_id,
            invited_by_id=user.id,
        )

        # Получаем данные компании для email
        company = await company_service.get_company(company_id)

        # Получаем роль по role_id
        role = None
        if invitation.role_id:
            role = await role_repo.get_by_id(invitation.role_id)

        # Отправляем email с приглашением
        invitation_link = company_service.generate_invitation_link(
            token=invitation.token,
            base_url=settings.api.url,
        )

        await send_company_invitation_email.kiq(
            to_email=data.email,
            company_name=company.name,
            inviter_name=user.full_name or user.email,
            role=role.name if role else "Member",
            invitation_link=invitation_link,
        )

    except CompanyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена",
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except AlreadyMemberError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except InvitationAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    return InvitationResponse(
        id=invitation.id,
        company_id=invitation.company_id,
        email=invitation.email,
        role=(
            CompanyRoleInfo(
                id=role.id,
                name=role.name,
                color=role.color,
                priority=role.priority,
                is_system=role.is_system,
            )
            if role
            else None
        ),
        invited_by_id=invitation.invited_by_id,
        status=invitation.status,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
    )


@router.get("/{company_id}/invitations", response_model=list[InvitationResponse])
async def get_company_invitations(
    company_id: UUID,
    status_filter: InvitationStatus | None = None,
    skip: int = 0,
    limit: int = 100,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
    role_repo: CompanyRoleRepositoryInterface = Depends(get_company_role_repository),
):
    """Получить приглашения компании (для владельца/админа)."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        invitations = await company_service.get_company_invitations(
            company_id=company_id,
            user_id=user.id,
            status=status_filter,
            skip=skip,
            limit=limit,
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    # Загружаем роли для всех приглашений
    result = []
    for inv in invitations:
        role = None
        if inv.role_id:
            role = await role_repo.get_by_id(inv.role_id)
        result.append(
            InvitationResponse(
                id=inv.id,
                company_id=inv.company_id,
                email=inv.email,
                role=(
                    CompanyRoleInfo(
                        id=role.id,
                        name=role.name,
                        color=role.color,
                        priority=role.priority,
                        is_system=role.is_system,
                    )
                    if role
                    else None
                ),
                invited_by_id=inv.invited_by_id,
                status=inv.status,
                created_at=inv.created_at,
                expires_at=inv.expires_at,
            )
        )

    return result


@router.delete(
    "/{company_id}/invitations/{invitation_id}", response_model=MessageResponse
)
async def cancel_invitation(
    company_id: UUID,
    invitation_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Отменить приглашение (для владельца/админа)."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        await company_service.cancel_invitation(invitation_id, user.id)
    except InvitationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return MessageResponse(message="Приглашение отменено")


@router.post(
    "/{company_id}/invitations/{invitation_id}/resend",
    response_model=InvitationResponse,
)
async def resend_invitation(
    company_id: UUID,
    invitation_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
    role_repo: CompanyRoleRepositoryInterface = Depends(get_company_role_repository),
):
    """Переотправить приглашение (для владельца/админа)."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        invitation = await company_service.resend_invitation(invitation_id, user.id)

        # Получаем данные компании для email
        company = await company_service.get_company(company_id)

        # Получаем роль по role_id
        role = None
        if invitation.role_id:
            role = await role_repo.get_by_id(invitation.role_id)

        # Отправляем email с новым приглашением
        invitation_link = company_service.generate_invitation_link(
            token=invitation.token,
            base_url=settings.api.url,
        )

        await send_company_invitation_email.kiq(
            to_email=invitation.email,
            company_name=company.name,
            inviter_name=user.full_name or user.email,
            role=role.name if role else "Member",
            invitation_link=invitation_link,
        )

    except InvitationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return InvitationResponse(
        id=invitation.id,
        company_id=invitation.company_id,
        email=invitation.email,
        role=(
            CompanyRoleInfo(
                id=role.id,
                name=role.name,
                color=role.color,
                priority=role.priority,
                is_system=role.is_system,
            )
            if role
            else None
        ),
        invited_by_id=invitation.invited_by_id,
        status=invitation.status,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
    )


@router.patch("/{company_id}/selected-card", response_model=CompanyCardAssignment)
async def set_selected_card(
    company_id: UUID,
    data: SetSelectedCardRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    company_service: CompanyService = Depends(get_company_service),
):
    """Установить выбранную визитку для отображения в компании."""
    user = await get_current_user_from_token(credentials, auth_service)

    try:
        result = await company_service.set_selected_card(
            company_id=company_id,
            user_id=user.id,
            card_id=data.card_id,
        )
    except MemberNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return CompanyCardAssignment(
        company_id=result["company_id"],
        company_name=result["company_name"],
        selected_card_id=result["selected_card_id"],
    )
