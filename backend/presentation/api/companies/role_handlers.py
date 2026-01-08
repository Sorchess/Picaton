"""API handlers для управления ролями в компании."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from presentation.api.companies.role_schemas import (
    CreateRoleRequest,
    UpdateRoleRequest,
    DeleteRoleRequest,
    ReorderRolesRequest,
    AssignRoleRequest,
    RoleResponse,
    RoleListResponse,
    MessageResponse,
    PermissionsListResponse,
    role_to_response,
    get_all_permissions_grouped,
)
from infrastructure.dependencies import (
    get_auth_service,
    get_company_role_service,
)
from application.services import AuthService, InvalidTokenError
from application.services.company_role import (
    CompanyRoleService,
    RoleNotFoundError,
    RoleAlreadyExistsError,
    SystemRoleError,
    RoleInUseError,
    RoleHierarchyViolationError,
)
from application.services.permission_checker import (
    PermissionDeniedError,
    MemberNotFoundError,
)
from domain.entities.company_role import (
    InvalidRoleNameError,
    InvalidRoleColorError,
)


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


# ==================== Permissions ====================


@router.get("/permissions", response_model=PermissionsListResponse)
async def get_permissions(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Получить список всех доступных прав.
    
    Возвращает все права, сгруппированные по категориям.
    Используется для UI редактирования ролей.
    """
    await get_current_user_from_token(credentials, auth_service)
    return get_all_permissions_grouped()


# ==================== Roles CRUD ====================


@router.get(
    "/{company_id}/roles",
    response_model=RoleListResponse,
)
async def get_company_roles(
    company_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    role_service: CompanyRoleService = Depends(get_company_role_service),
):
    """
    Получить все роли компании.
    
    Возвращает список ролей, отсортированный по приоритету (иерархии).
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        roles = await role_service.get_roles(company_id, user.id)
        return RoleListResponse(
            roles=[role_to_response(r) for r in roles],
            total=len(roles),
        )
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь членом этой компании",
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.get(
    "/{company_id}/roles/{role_id}",
    response_model=RoleResponse,
)
async def get_role(
    company_id: UUID,
    role_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    role_service: CompanyRoleService = Depends(get_company_role_service),
):
    """Получить роль по ID."""
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        role = await role_service.get_role(company_id, role_id, user.id)
        return role_to_response(role)
    except RoleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена",
        )
    except (MemberNotFoundError, PermissionDeniedError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.post(
    "/{company_id}/roles",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_role(
    company_id: UUID,
    data: CreateRoleRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    role_service: CompanyRoleService = Depends(get_company_role_service),
):
    """
    Создать новую кастомную роль.
    
    Требуется право MANAGE_ROLES.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        role = await role_service.create_role(
            company_id=company_id,
            user_id=user.id,
            name=data.name,
            color=data.color,
            permissions=set(data.permissions) if data.permissions else None,
            priority=data.priority,
        )
        return role_to_response(role)
    except RoleAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except (InvalidRoleNameError, InvalidRoleColorError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except RoleHierarchyViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except (MemberNotFoundError, PermissionDeniedError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.put(
    "/{company_id}/roles/{role_id}",
    response_model=RoleResponse,
)
async def update_role(
    company_id: UUID,
    role_id: UUID,
    data: UpdateRoleRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    role_service: CompanyRoleService = Depends(get_company_role_service),
):
    """
    Обновить роль.
    
    Требуется право MANAGE_ROLES и роль выше редактируемой в иерархии.
    Системные роли нельзя переименовывать.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        role = await role_service.update_role(
            company_id=company_id,
            role_id=role_id,
            user_id=user.id,
            name=data.name,
            color=data.color,
            permissions=set(data.permissions) if data.permissions else None,
        )
        return role_to_response(role)
    except RoleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена",
        )
    except RoleAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except SystemRoleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except (InvalidRoleNameError, InvalidRoleColorError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except (MemberNotFoundError, PermissionDeniedError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.delete(
    "/{company_id}/roles/{role_id}",
    response_model=MessageResponse,
)
async def delete_role(
    company_id: UUID,
    role_id: UUID,
    data: DeleteRoleRequest | None = None,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    role_service: CompanyRoleService = Depends(get_company_role_service),
):
    """
    Удалить роль.
    
    Требуется право MANAGE_ROLES.
    Системные роли удалить нельзя.
    При удалении роли члены переназначаются на указанную роль
    или на роль по умолчанию.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    replacement_role_id = data.replacement_role_id if data else None
    
    try:
        await role_service.delete_role(
            company_id=company_id,
            role_id=role_id,
            user_id=user.id,
            replacement_role_id=replacement_role_id,
        )
        return MessageResponse(message="Роль успешно удалена")
    except RoleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена",
        )
    except SystemRoleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RoleInUseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except (MemberNotFoundError, PermissionDeniedError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.put(
    "/{company_id}/roles/reorder",
    response_model=RoleListResponse,
)
async def reorder_roles(
    company_id: UUID,
    data: ReorderRolesRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    role_service: CompanyRoleService = Depends(get_company_role_service),
):
    """
    Изменить порядок ролей (приоритеты).
    
    Требуется право MANAGE_ROLES.
    Системные роли (Owner, Admin) нельзя перемещать.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        roles = await role_service.reorder_roles(
            company_id=company_id,
            user_id=user.id,
            role_priorities=data.role_priorities,
        )
        return RoleListResponse(
            roles=[role_to_response(r) for r in roles],
            total=len(roles),
        )
    except RoleHierarchyViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except (MemberNotFoundError, PermissionDeniedError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# ==================== Member Role Assignment ====================


@router.put(
    "/{company_id}/members/{member_user_id}/role",
    response_model=MessageResponse,
)
async def assign_role_to_member(
    company_id: UUID,
    member_user_id: UUID,
    data: AssignRoleRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    role_service: CompanyRoleService = Depends(get_company_role_service),
):
    """
    Назначить роль члену компании.
    
    Требуется право ASSIGN_ROLES.
    Нельзя назначить роль выше своей.
    Нельзя изменить роль пользователя с ролью выше своей.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        await role_service.assign_role_to_member(
            company_id=company_id,
            target_user_id=member_user_id,
            role_id=data.role_id,
            assigner_user_id=user.id,
        )
        return MessageResponse(message="Роль успешно назначена")
    except RoleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена",
        )
    except MemberNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
