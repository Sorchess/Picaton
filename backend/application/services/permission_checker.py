"""Сервис проверки прав доступа в компании."""

import logging
from uuid import UUID

from domain.entities.company_role import CompanyRole
from domain.enums.permission import Permission
from domain.repositories.company_role import CompanyRoleRepositoryInterface
from domain.repositories.company import CompanyMemberRepositoryInterface


logger = logging.getLogger(__name__)


class PermissionDeniedError(Exception):
    """Недостаточно прав для выполнения действия."""
    
    def __init__(self, permission: Permission | None = None, message: str | None = None):
        self.permission = permission
        if message:
            super().__init__(message)
        elif permission:
            super().__init__(f"Недостаточно прав: требуется {permission.value}")
        else:
            super().__init__("Недостаточно прав для выполнения действия")


class MemberNotFoundError(Exception):
    """Пользователь не является членом компании."""
    pass


class RoleNotFoundError(Exception):
    """Роль не найдена."""
    pass


class PermissionChecker:
    """
    Сервис проверки прав доступа.
    
    Реализует централизованную проверку прав пользователя в компании
    на основе его роли и иерархии ролей.
    """

    def __init__(
        self,
        role_repo: CompanyRoleRepositoryInterface,
        member_repo: CompanyMemberRepositoryInterface,
    ):
        self._role_repo = role_repo
        self._member_repo = member_repo

    async def get_user_role(
        self, company_id: UUID, user_id: UUID
    ) -> CompanyRole | None:
        """
        Получить роль пользователя в компании.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            
        Returns:
            Роль пользователя или None если не член компании
        """
        member = await self._member_repo.get_by_company_and_user(company_id, user_id)
        if not member or not member.role_id:
            return None
        
        return await self._role_repo.get_by_id(member.role_id)

    async def check_permission(
        self, company_id: UUID, user_id: UUID, permission: Permission
    ) -> bool:
        """
        Проверить наличие права у пользователя.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            permission: Требуемое право
            
        Returns:
            True если право есть, False если нет
        """
        role = await self.get_user_role(company_id, user_id)
        if not role:
            return False
        
        return role.has_permission(permission)

    async def check_any_permission(
        self, company_id: UUID, user_id: UUID, permissions: set[Permission]
    ) -> bool:
        """
        Проверить наличие хотя бы одного из прав.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            permissions: Набор прав (достаточно одного)
            
        Returns:
            True если есть хотя бы одно право
        """
        role = await self.get_user_role(company_id, user_id)
        if not role:
            return False
        
        return role.has_any_permission(permissions)

    async def check_all_permissions(
        self, company_id: UUID, user_id: UUID, permissions: set[Permission]
    ) -> bool:
        """
        Проверить наличие всех указанных прав.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            permissions: Набор прав (нужны все)
            
        Returns:
            True если есть все права
        """
        role = await self.get_user_role(company_id, user_id)
        if not role:
            return False
        
        return role.has_all_permissions(permissions)

    async def require_permission(
        self, company_id: UUID, user_id: UUID, permission: Permission
    ) -> CompanyRole:
        """
        Требовать наличие права. Выбрасывает исключение если права нет.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            permission: Требуемое право
            
        Returns:
            Роль пользователя
            
        Raises:
            MemberNotFoundError: Пользователь не член компании
            PermissionDeniedError: Нет требуемого права
        """
        role = await self.get_user_role(company_id, user_id)
        if not role:
            raise MemberNotFoundError(
                f"Пользователь {user_id} не является членом компании {company_id}"
            )
        
        if not role.has_permission(permission):
            logger.warning(
                f"Permission denied: user={user_id}, company={company_id}, "
                f"permission={permission.value}, role={role.name}"
            )
            raise PermissionDeniedError(permission)
        
        return role

    async def require_any_permission(
        self, company_id: UUID, user_id: UUID, permissions: set[Permission]
    ) -> CompanyRole:
        """
        Требовать наличие хотя бы одного из прав.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            permissions: Набор прав (достаточно одного)
            
        Returns:
            Роль пользователя
            
        Raises:
            MemberNotFoundError: Пользователь не член компании
            PermissionDeniedError: Нет ни одного из требуемых прав
        """
        role = await self.get_user_role(company_id, user_id)
        if not role:
            raise MemberNotFoundError(
                f"Пользователь {user_id} не является членом компании {company_id}"
            )
        
        if not role.has_any_permission(permissions):
            permissions_str = ", ".join(p.value for p in permissions)
            raise PermissionDeniedError(
                message=f"Требуется одно из прав: {permissions_str}"
            )
        
        return role

    async def require_membership(
        self, company_id: UUID, user_id: UUID
    ) -> CompanyRole:
        """
        Требовать членство в компании (без проверки конкретного права).
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            
        Returns:
            Роль пользователя
            
        Raises:
            MemberNotFoundError: Пользователь не член компании
        """
        role = await self.get_user_role(company_id, user_id)
        if not role:
            raise MemberNotFoundError(
                f"Пользователь {user_id} не является членом компании {company_id}"
            )
        return role

    async def can_manage_role(
        self, company_id: UUID, manager_id: UUID, target_role_id: UUID
    ) -> bool:
        """
        Проверить, может ли пользователь управлять указанной ролью.
        
        Пользователь может управлять ролью только если:
        1. У него есть право MANAGE_ROLES
        2. Его роль выше в иерархии (меньший priority)
        
        Args:
            company_id: ID компании
            manager_id: ID пользователя-менеджера
            target_role_id: ID целевой роли
            
        Returns:
            True если может управлять
        """
        manager_role = await self.get_user_role(company_id, manager_id)
        if not manager_role:
            return False
        
        # Проверяем право управления ролями
        if not manager_role.has_permission(Permission.MANAGE_ROLES):
            return False
        
        # Получаем целевую роль
        target_role = await self._role_repo.get_by_id(target_role_id)
        if not target_role:
            return False
        
        # Проверяем иерархию: менеджер должен быть выше
        return manager_role.is_higher_than(target_role)

    async def can_assign_role(
        self, company_id: UUID, assigner_id: UUID, role_id: UUID
    ) -> bool:
        """
        Проверить, может ли пользователь назначить указанную роль.
        
        Пользователь может назначить роль только если:
        1. У него есть право ASSIGN_ROLES
        2. Его роль выше или равна в иерархии назначаемой роли
        
        Args:
            company_id: ID компании
            assigner_id: ID пользователя, назначающего роль
            role_id: ID назначаемой роли
            
        Returns:
            True если может назначить
        """
        assigner_role = await self.get_user_role(company_id, assigner_id)
        if not assigner_role:
            return False
        
        # Проверяем право назначения ролей
        if not assigner_role.has_permission(Permission.ASSIGN_ROLES):
            return False
        
        # Получаем назначаемую роль
        target_role = await self._role_repo.get_by_id(role_id)
        if not target_role:
            return False
        
        # Нельзя назначить роль выше своей
        return assigner_role.priority <= target_role.priority

    async def can_manage_member(
        self, company_id: UUID, manager_id: UUID, target_user_id: UUID
    ) -> bool:
        """
        Проверить, может ли пользователь управлять другим членом.
        
        Менеджер может управлять членом если:
        1. У него есть право (REMOVE_MEMBERS или ASSIGN_ROLES)
        2. Его роль выше в иерархии
        
        Args:
            company_id: ID компании
            manager_id: ID менеджера
            target_user_id: ID целевого пользователя
            
        Returns:
            True если может управлять
        """
        if manager_id == target_user_id:
            return False  # Нельзя управлять собой (кроме редактирования своей карточки)
        
        manager_role = await self.get_user_role(company_id, manager_id)
        target_role = await self.get_user_role(company_id, target_user_id)
        
        if not manager_role or not target_role:
            return False
        
        # Проверяем иерархию
        return manager_role.is_higher_than(target_role)

    async def is_owner(self, company_id: UUID, user_id: UUID) -> bool:
        """Проверить, является ли пользователь владельцем компании."""
        role = await self.get_user_role(company_id, user_id)
        return role is not None and role.is_owner_role()

    async def is_admin_or_higher(self, company_id: UUID, user_id: UUID) -> bool:
        """Проверить, является ли пользователь админом или владельцем."""
        role = await self.get_user_role(company_id, user_id)
        if not role:
            return False
        return role.is_owner_role() or role.is_admin_role()
