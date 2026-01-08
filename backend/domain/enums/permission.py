"""Перечисление прав доступа для системы ролей компании."""

from enum import Enum


class Permission(str, Enum):
    """
    Гранулярные права доступа для ролей в компании.
    
    Права группированы по функциональным областям:
    - Управление компанией
    - Управление ролями
    - Управление сотрудниками
    - Работа с карточками
    - Работа с тегами
    """

    # ==================== Управление компанией ====================
    MANAGE_COMPANY = "manage_company"       # Редактировать настройки компании
    DELETE_COMPANY = "delete_company"       # Удалить компанию
    VIEW_COMPANY_SETTINGS = "view_company_settings"  # Просматривать настройки

    # ==================== Управление ролями ====================
    MANAGE_ROLES = "manage_roles"           # Создавать/редактировать/удалять роли
    ASSIGN_ROLES = "assign_roles"           # Назначать роли сотрудникам
    VIEW_ROLES = "view_roles"               # Просматривать роли

    # ==================== Управление сотрудниками ====================
    INVITE_MEMBERS = "invite_members"       # Приглашать сотрудников
    REMOVE_MEMBERS = "remove_members"       # Удалять сотрудников
    VIEW_MEMBERS = "view_members"           # Просматривать список сотрудников
    MANAGE_INVITATIONS = "manage_invitations"  # Управлять приглашениями

    # ==================== Карточки ====================
    EDIT_OWN_CARD = "edit_own_card"         # Редактировать свою карточку
    EDIT_ANY_CARD = "edit_any_card"         # Редактировать чужие карточки
    VIEW_CARDS = "view_cards"               # Просматривать карточки сотрудников
    DELETE_ANY_CARD = "delete_any_card"     # Удалять чужие карточки

    # ==================== Теги ====================
    MANAGE_COMPANY_TAGS = "manage_company_tags"  # Управлять тегами компании (создание шаблонов)
    EDIT_OWN_TAGS = "edit_own_tags"         # Редактировать свои теги
    EDIT_ANY_TAGS = "edit_any_tags"         # Редактировать чужие теги
    
    # ==================== Должности и отделы ====================
    ASSIGN_POSITION = "assign_position"     # Назначать должности сотрудникам
    ASSIGN_DEPARTMENT = "assign_department"  # Назначать отделы сотрудникам
    MANAGE_DEPARTMENTS = "manage_departments"  # Управлять списком отделов
    MANAGE_POSITIONS = "manage_positions"   # Управлять списком должностей


class PermissionGroup(str, Enum):
    """Группы прав для удобного отображения в UI."""
    
    COMPANY = "company"
    ROLES = "roles"
    MEMBERS = "members"
    CARDS = "cards"
    TAGS = "tags"
    ORGANIZATION = "organization"


# Маппинг прав к группам
PERMISSION_GROUPS: dict[Permission, PermissionGroup] = {
    # Компания
    Permission.MANAGE_COMPANY: PermissionGroup.COMPANY,
    Permission.DELETE_COMPANY: PermissionGroup.COMPANY,
    Permission.VIEW_COMPANY_SETTINGS: PermissionGroup.COMPANY,
    
    # Роли
    Permission.MANAGE_ROLES: PermissionGroup.ROLES,
    Permission.ASSIGN_ROLES: PermissionGroup.ROLES,
    Permission.VIEW_ROLES: PermissionGroup.ROLES,
    
    # Сотрудники
    Permission.INVITE_MEMBERS: PermissionGroup.MEMBERS,
    Permission.REMOVE_MEMBERS: PermissionGroup.MEMBERS,
    Permission.VIEW_MEMBERS: PermissionGroup.MEMBERS,
    Permission.MANAGE_INVITATIONS: PermissionGroup.MEMBERS,
    
    # Карточки
    Permission.EDIT_OWN_CARD: PermissionGroup.CARDS,
    Permission.EDIT_ANY_CARD: PermissionGroup.CARDS,
    Permission.VIEW_CARDS: PermissionGroup.CARDS,
    Permission.DELETE_ANY_CARD: PermissionGroup.CARDS,
    
    # Теги
    Permission.MANAGE_COMPANY_TAGS: PermissionGroup.TAGS,
    Permission.EDIT_OWN_TAGS: PermissionGroup.TAGS,
    Permission.EDIT_ANY_TAGS: PermissionGroup.TAGS,
    
    # Организационная структура
    Permission.ASSIGN_POSITION: PermissionGroup.ORGANIZATION,
    Permission.ASSIGN_DEPARTMENT: PermissionGroup.ORGANIZATION,
    Permission.MANAGE_DEPARTMENTS: PermissionGroup.ORGANIZATION,
    Permission.MANAGE_POSITIONS: PermissionGroup.ORGANIZATION,
}


# Права по умолчанию для системных ролей
OWNER_PERMISSIONS: set[Permission] = set(Permission)  # Все права

ADMIN_PERMISSIONS: set[Permission] = {
    Permission.MANAGE_COMPANY,
    Permission.VIEW_COMPANY_SETTINGS,
    Permission.MANAGE_ROLES,
    Permission.ASSIGN_ROLES,
    Permission.VIEW_ROLES,
    Permission.INVITE_MEMBERS,
    Permission.REMOVE_MEMBERS,
    Permission.VIEW_MEMBERS,
    Permission.MANAGE_INVITATIONS,
    Permission.EDIT_OWN_CARD,
    Permission.EDIT_ANY_CARD,
    Permission.VIEW_CARDS,
    Permission.DELETE_ANY_CARD,
    Permission.MANAGE_COMPANY_TAGS,
    Permission.EDIT_OWN_TAGS,
    Permission.EDIT_ANY_TAGS,
    Permission.ASSIGN_POSITION,
    Permission.ASSIGN_DEPARTMENT,
    Permission.MANAGE_DEPARTMENTS,
    Permission.MANAGE_POSITIONS,
}

MEMBER_PERMISSIONS: set[Permission] = {
    Permission.VIEW_COMPANY_SETTINGS,
    Permission.VIEW_ROLES,
    Permission.VIEW_MEMBERS,
    Permission.EDIT_OWN_CARD,
    Permission.VIEW_CARDS,
    Permission.EDIT_OWN_TAGS,
}


def get_permission_description(permission: Permission) -> str:
    """Получить человекочитаемое описание права."""
    descriptions = {
        Permission.MANAGE_COMPANY: "Редактирование настроек компании",
        Permission.DELETE_COMPANY: "Удаление компании",
        Permission.VIEW_COMPANY_SETTINGS: "Просмотр настроек компании",
        Permission.MANAGE_ROLES: "Управление ролями",
        Permission.ASSIGN_ROLES: "Назначение ролей сотрудникам",
        Permission.VIEW_ROLES: "Просмотр ролей",
        Permission.INVITE_MEMBERS: "Приглашение сотрудников",
        Permission.REMOVE_MEMBERS: "Удаление сотрудников",
        Permission.VIEW_MEMBERS: "Просмотр списка сотрудников",
        Permission.MANAGE_INVITATIONS: "Управление приглашениями",
        Permission.EDIT_OWN_CARD: "Редактирование своей карточки",
        Permission.EDIT_ANY_CARD: "Редактирование чужих карточек",
        Permission.VIEW_CARDS: "Просмотр карточек сотрудников",
        Permission.DELETE_ANY_CARD: "Удаление чужих карточек",
        Permission.MANAGE_COMPANY_TAGS: "Управление тегами компании",
        Permission.EDIT_OWN_TAGS: "Редактирование своих тегов",
        Permission.EDIT_ANY_TAGS: "Редактирование чужих тегов",
        Permission.ASSIGN_POSITION: "Назначение должностей",
        Permission.ASSIGN_DEPARTMENT: "Назначение отделов",
        Permission.MANAGE_DEPARTMENTS: "Управление списком отделов",
        Permission.MANAGE_POSITIONS: "Управление списком должностей",
    }
    return descriptions.get(permission, permission.value)
