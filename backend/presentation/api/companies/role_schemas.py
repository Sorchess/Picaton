"""Pydantic схемы для API ролей компании."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from domain.enums.permission import Permission, PermissionGroup


# ==================== Permission ====================


class PermissionInfo(BaseModel):
    """Информация о праве доступа."""
    
    value: str = Field(..., description="Идентификатор права")
    name: str = Field(..., description="Название права")
    description: str = Field(..., description="Описание права")
    group: PermissionGroup = Field(..., description="Группа прав")


class PermissionGroupInfo(BaseModel):
    """Группа прав с описанием."""
    
    value: str = Field(..., description="Идентификатор группы")
    name: str = Field(..., description="Название группы")
    permissions: list[PermissionInfo] = Field(
        default_factory=list, description="Права в группе"
    )


# ==================== Role ====================


class CreateRoleRequest(BaseModel):
    """Запрос на создание роли."""
    
    name: str = Field(
        ..., 
        min_length=1, 
        max_length=50, 
        description="Название роли"
    )
    color: str = Field(
        default="#808080",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="HEX цвет роли"
    )
    permissions: list[Permission] = Field(
        default_factory=list,
        description="Список прав роли"
    )
    priority: int | None = Field(
        default=None,
        ge=2,
        le=999,
        description="Приоритет роли (2-999, меньше = выше)"
    )


class UpdateRoleRequest(BaseModel):
    """Запрос на обновление роли."""
    
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        description="Новое название роли"
    )
    color: str | None = Field(
        default=None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Новый HEX цвет роли"
    )
    permissions: list[Permission] | None = Field(
        default=None,
        description="Новый список прав роли"
    )


class RoleResponse(BaseModel):
    """Ответ с данными роли."""
    
    id: UUID
    company_id: UUID
    name: str
    color: str
    priority: int
    permissions: list[Permission]
    is_system: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoleListResponse(BaseModel):
    """Список ролей."""
    
    roles: list[RoleResponse]
    total: int


class DeleteRoleRequest(BaseModel):
    """Запрос на удаление роли."""
    
    replacement_role_id: UUID | None = Field(
        default=None,
        description="ID роли для переназначения членов"
    )


class ReorderRolesRequest(BaseModel):
    """Запрос на изменение порядка ролей."""
    
    role_priorities: dict[UUID, int] = Field(
        ...,
        description="Словарь {role_id: new_priority}"
    )


class AssignRoleRequest(BaseModel):
    """Запрос на назначение роли члену."""
    
    role_id: UUID = Field(..., description="ID роли для назначения")


# ==================== API Responses ====================


class MessageResponse(BaseModel):
    """Простой ответ с сообщением."""
    
    message: str


class PermissionsListResponse(BaseModel):
    """Список всех доступных прав."""
    
    groups: list[PermissionGroupInfo]
    all_permissions: list[PermissionInfo]


# ==================== Helpers ====================


def permission_to_info(permission: Permission) -> PermissionInfo:
    """Преобразовать Permission в PermissionInfo."""
    from domain.enums.permission import (
        PERMISSION_GROUPS,
        get_permission_description,
    )
    
    group_names = {
        PermissionGroup.COMPANY: "Компания",
        PermissionGroup.ROLES: "Роли",
        PermissionGroup.MEMBERS: "Сотрудники",
        PermissionGroup.CARDS: "Карточки",
        PermissionGroup.TAGS: "Теги",
        PermissionGroup.ORGANIZATION: "Организация",
    }
    
    return PermissionInfo(
        value=permission.value,
        name=permission.name.replace("_", " ").title(),
        description=get_permission_description(permission),
        group=PERMISSION_GROUPS.get(permission, PermissionGroup.COMPANY),
    )


def role_to_response(role) -> RoleResponse:
    """Преобразовать CompanyRole в RoleResponse."""
    return RoleResponse(
        id=role.id,
        company_id=role.company_id,
        name=role.name,
        color=role.color,
        priority=role.priority,
        permissions=list(role.permissions),
        is_system=role.is_system,
        is_default=role.is_default,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


def get_all_permissions_grouped() -> PermissionsListResponse:
    """Получить все права, сгруппированные по категориям."""
    from domain.enums.permission import PERMISSION_GROUPS
    
    group_names = {
        PermissionGroup.COMPANY: "Компания",
        PermissionGroup.ROLES: "Роли",
        PermissionGroup.MEMBERS: "Сотрудники",
        PermissionGroup.CARDS: "Карточки",
        PermissionGroup.TAGS: "Теги",
        PermissionGroup.ORGANIZATION: "Организация",
    }
    
    # Группируем права
    groups_dict: dict[PermissionGroup, list[PermissionInfo]] = {}
    all_permissions: list[PermissionInfo] = []
    
    for permission in Permission:
        info = permission_to_info(permission)
        all_permissions.append(info)
        
        group = PERMISSION_GROUPS.get(permission, PermissionGroup.COMPANY)
        if group not in groups_dict:
            groups_dict[group] = []
        groups_dict[group].append(info)
    
    # Формируем ответ
    groups = [
        PermissionGroupInfo(
            value=group.value,
            name=group_names.get(group, group.value),
            permissions=perms,
        )
        for group, perms in groups_dict.items()
    ]
    
    return PermissionsListResponse(
        groups=groups,
        all_permissions=all_permissions,
    )
