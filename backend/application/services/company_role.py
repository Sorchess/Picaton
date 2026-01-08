"""Сервис управления ролями в компании."""

import logging
from uuid import UUID

from domain.entities.company_role import (
    CompanyRole,
    InvalidRoleNameError,
    InvalidRoleColorError,
    SystemRoleModificationError,
    RoleHierarchyError,
    ADMIN_PRIORITY,
)
from domain.enums.permission import Permission, MEMBER_PERMISSIONS
from domain.repositories.company_role import CompanyRoleRepositoryInterface
from domain.repositories.company import (
    CompanyRepositoryInterface,
    CompanyMemberRepositoryInterface,
)
from application.services.permission_checker import (
    PermissionChecker,
    PermissionDeniedError,
    MemberNotFoundError,
)


logger = logging.getLogger(__name__)


# Исключения
class RoleError(Exception):
    """Базовая ошибка роли."""
    pass


class RoleNotFoundError(RoleError):
    """Роль не найдена."""
    pass


class RoleAlreadyExistsError(RoleError):
    """Роль с таким именем уже существует."""
    pass


class SystemRoleError(RoleError):
    """Ошибка при работе с системной ролью."""
    pass


class RoleInUseError(RoleError):
    """Роль используется и не может быть удалена."""
    pass


class RoleHierarchyViolationError(RoleError):
    """Нарушение иерархии ролей."""
    pass


# Лимиты
MAX_CUSTOM_ROLES_PER_COMPANY = 25  # Максимум кастомных ролей


class CompanyRoleService:
    """Сервис управления ролями в компании."""

    def __init__(
        self,
        role_repo: CompanyRoleRepositoryInterface,
        company_repo: CompanyRepositoryInterface,
        member_repo: CompanyMemberRepositoryInterface,
        permission_checker: PermissionChecker,
    ):
        self._role_repo = role_repo
        self._company_repo = company_repo
        self._member_repo = member_repo
        self._permission_checker = permission_checker

    async def initialize_company_roles(self, company_id: UUID) -> list[CompanyRole]:
        """
        Инициализировать системные роли для новой компании.
        Вызывается при создании компании.
        
        Args:
            company_id: ID компании
            
        Returns:
            Список созданных системных ролей [owner, admin, member]
        """
        # Проверяем, что роли ещё не созданы
        existing = await self._role_repo.get_by_company(company_id)
        if existing:
            logger.warning(f"Roles already exist for company {company_id}")
            return existing
        
        roles = await self._role_repo.create_system_roles(company_id)
        logger.info(f"Created system roles for company {company_id}")
        return roles

    async def get_roles(
        self, company_id: UUID, user_id: UUID
    ) -> list[CompanyRole]:
        """
        Получить все роли компании.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя (для проверки прав)
            
        Returns:
            Список ролей, отсортированный по приоритету
        """
        # Проверяем право на просмотр ролей
        await self._permission_checker.require_permission(
            company_id, user_id, Permission.VIEW_ROLES
        )
        
        return await self._role_repo.get_by_company(company_id)

    async def get_role(
        self, company_id: UUID, role_id: UUID, user_id: UUID
    ) -> CompanyRole:
        """
        Получить роль по ID.
        
        Args:
            company_id: ID компании
            role_id: ID роли
            user_id: ID пользователя
            
        Returns:
            Роль
            
        Raises:
            RoleNotFoundError: Роль не найдена
        """
        await self._permission_checker.require_permission(
            company_id, user_id, Permission.VIEW_ROLES
        )
        
        role = await self._role_repo.get_by_id(role_id)
        if not role or role.company_id != company_id:
            raise RoleNotFoundError(f"Роль {role_id} не найдена")
        
        return role

    async def create_role(
        self,
        company_id: UUID,
        user_id: UUID,
        name: str,
        color: str = "#808080",
        permissions: set[Permission] | None = None,
        priority: int | None = None,
    ) -> CompanyRole:
        """
        Создать кастомную роль.
        
        Args:
            company_id: ID компании
            user_id: ID пользователя (создателя)
            name: Название роли
            color: HEX цвет роли
            permissions: Набор прав (по умолчанию - права участника)
            priority: Приоритет (если не указан - автоматически)
            
        Returns:
            Созданная роль
            
        Raises:
            PermissionDeniedError: Нет права на создание ролей
            RoleAlreadyExistsError: Роль с таким именем уже существует
            InvalidRoleNameError: Невалидное название
            InvalidRoleColorError: Невалидный цвет
        """
        # Проверяем права
        await self._permission_checker.require_permission(
            company_id, user_id, Permission.MANAGE_ROLES
        )
        
        # Проверяем лимит на количество кастомных ролей
        custom_roles = await self._role_repo.get_custom_roles(company_id)
        if len(custom_roles) >= MAX_CUSTOM_ROLES_PER_COMPANY:
            raise RoleError(
                f"Достигнут лимит кастомных ролей ({MAX_CUSTOM_ROLES_PER_COMPANY})"
            )
        
        # Проверяем уникальность имени
        existing = await self._role_repo.get_by_company_and_name(company_id, name)
        if existing:
            raise RoleAlreadyExistsError(f"Роль '{name}' уже существует")
        
        # Определяем приоритет
        if priority is None:
            priority = await self._role_repo.get_next_priority(company_id)
        elif priority <= ADMIN_PRIORITY:
            raise RoleHierarchyViolationError(
                "Приоритет кастомной роли должен быть больше 1"
            )
        
        # Проверяем, что создатель может назначать выбранные права
        # (нельзя создать роль с правами, которых нет у создателя)
        creator_role = await self._permission_checker.get_user_role(company_id, user_id)
        if permissions:
            # Владелец может давать любые права
            if not creator_role.is_owner_role():
                invalid_perms = permissions - creator_role.permissions
                if invalid_perms:
                    raise PermissionDeniedError(
                        message=f"Вы не можете назначить права, которых нет у вас: "
                                f"{', '.join(p.value for p in invalid_perms)}"
                    )
        
        role = CompanyRole.create_custom_role(
            company_id=company_id,
            name=name,
            color=color,
            priority=priority,
            permissions=permissions or MEMBER_PERMISSIONS.copy(),
        )
        
        await self._role_repo.create(role)
        logger.info(f"Created role '{name}' in company {company_id} by user {user_id}")
        
        return role

    async def update_role(
        self,
        company_id: UUID,
        role_id: UUID,
        user_id: UUID,
        name: str | None = None,
        color: str | None = None,
        permissions: set[Permission] | None = None,
    ) -> CompanyRole:
        """
        Обновить роль.
        
        Args:
            company_id: ID компании
            role_id: ID роли
            user_id: ID пользователя
            name: Новое название
            color: Новый цвет
            permissions: Новый набор прав
            
        Returns:
            Обновлённая роль
            
        Raises:
            RoleNotFoundError: Роль не найдена
            PermissionDeniedError: Нет прав
            SystemRoleError: Попытка изменить системную роль
        """
        # Проверяем права
        await self._permission_checker.require_permission(
            company_id, user_id, Permission.MANAGE_ROLES
        )
        
        # Получаем роль
        role = await self._role_repo.get_by_id(role_id)
        if not role or role.company_id != company_id:
            raise RoleNotFoundError(f"Роль {role_id} не найдена")
        
        # Проверяем иерархию
        if not await self._permission_checker.can_manage_role(
            company_id, user_id, role_id
        ):
            raise PermissionDeniedError(
                message="Вы не можете редактировать роль выше или равную вашей"
            )
        
        # Обновляем поля
        try:
            if name is not None:
                # Проверяем уникальность нового имени
                existing = await self._role_repo.get_by_company_and_name(
                    company_id, name
                )
                if existing and existing.id != role_id:
                    raise RoleAlreadyExistsError(f"Роль '{name}' уже существует")
                role.update_name(name)
            
            if color is not None:
                role.update_color(color)
            
            if permissions is not None:
                # Проверяем, что редактор может назначать эти права
                editor_role = await self._permission_checker.get_user_role(
                    company_id, user_id
                )
                if not editor_role.is_owner_role():
                    invalid_perms = permissions - editor_role.permissions
                    if invalid_perms:
                        raise PermissionDeniedError(
                            message=f"Вы не можете назначить права: "
                                    f"{', '.join(p.value for p in invalid_perms)}"
                        )
                role.set_permissions(permissions)
                
        except SystemRoleModificationError as e:
            raise SystemRoleError(str(e))
        
        await self._role_repo.update(role)
        logger.info(f"Updated role {role_id} in company {company_id} by user {user_id}")
        
        return role

    async def delete_role(
        self,
        company_id: UUID,
        role_id: UUID,
        user_id: UUID,
        replacement_role_id: UUID | None = None,
    ) -> bool:
        """
        Удалить роль.
        
        Args:
            company_id: ID компании
            role_id: ID удаляемой роли
            user_id: ID пользователя
            replacement_role_id: ID роли для переназначения членов
            
        Returns:
            True если удалено
            
        Raises:
            RoleNotFoundError: Роль не найдена
            SystemRoleError: Попытка удалить системную роль
            RoleInUseError: Роль используется и нет замены
        """
        # Проверяем права
        await self._permission_checker.require_permission(
            company_id, user_id, Permission.MANAGE_ROLES
        )
        
        # Получаем роль
        role = await self._role_repo.get_by_id(role_id)
        if not role or role.company_id != company_id:
            raise RoleNotFoundError(f"Роль {role_id} не найдена")
        
        # Нельзя удалить системную роль
        if role.is_system:
            raise SystemRoleError("Нельзя удалить системную роль")
        
        # Проверяем иерархию
        if not await self._permission_checker.can_manage_role(
            company_id, user_id, role_id
        ):
            raise PermissionDeniedError(
                message="Вы не можете удалить роль выше или равную вашей"
            )
        
        # Проверяем, используется ли роль
        members = await self._member_repo.get_by_company(company_id)
        members_with_role = [m for m in members if m.role_id == role_id]
        
        if members_with_role:
            if not replacement_role_id:
                # Используем роль по умолчанию
                default_role = await self._role_repo.get_default_role(company_id)
                if not default_role:
                    raise RoleInUseError(
                        f"Роль используется у {len(members_with_role)} членов. "
                        "Укажите роль для переназначения."
                    )
                replacement_role_id = default_role.id
            
            # Переназначаем членов
            replacement_role = await self._role_repo.get_by_id(replacement_role_id)
            if not replacement_role or replacement_role.company_id != company_id:
                raise RoleNotFoundError("Роль для замены не найдена")
            
            for member in members_with_role:
                member.role_id = replacement_role_id
                await self._member_repo.update(member)
            
            logger.info(
                f"Reassigned {len(members_with_role)} members from role {role_id} "
                f"to {replacement_role_id}"
            )
        
        result = await self._role_repo.delete(role_id)
        logger.info(f"Deleted role {role_id} from company {company_id} by user {user_id}")
        
        return result

    async def reorder_roles(
        self,
        company_id: UUID,
        user_id: UUID,
        role_priorities: dict[UUID, int],
    ) -> list[CompanyRole]:
        """
        Изменить порядок ролей (приоритеты).
        
        Args:
            company_id: ID компании
            user_id: ID пользователя
            role_priorities: Словарь {role_id: new_priority}
            
        Returns:
            Обновлённый список ролей
            
        Raises:
            PermissionDeniedError: Нет прав
            RoleHierarchyViolationError: Неверные приоритеты
        """
        # Проверяем права
        await self._permission_checker.require_permission(
            company_id, user_id, Permission.MANAGE_ROLES
        )
        
        # Валидируем приоритеты (все должны быть > ADMIN_PRIORITY)
        for role_id, priority in role_priorities.items():
            if priority <= ADMIN_PRIORITY:
                raise RoleHierarchyViolationError(
                    f"Приоритет роли должен быть больше {ADMIN_PRIORITY}"
                )
            
            # Проверяем, что пользователь может управлять ролью
            if not await self._permission_checker.can_manage_role(
                company_id, user_id, role_id
            ):
                raise PermissionDeniedError(
                    message="Вы не можете изменять приоритет ролей выше вашей"
                )
        
        return await self._role_repo.reorder_roles(company_id, role_priorities)

    async def assign_role_to_member(
        self,
        company_id: UUID,
        target_user_id: UUID,
        role_id: UUID,
        assigner_user_id: UUID,
    ) -> None:
        """
        Назначить роль члену компании.
        
        Args:
            company_id: ID компании
            target_user_id: ID пользователя, которому назначается роль
            role_id: ID роли
            assigner_user_id: ID пользователя, назначающего роль
            
        Raises:
            MemberNotFoundError: Член не найден
            RoleNotFoundError: Роль не найдена
            PermissionDeniedError: Нет прав
        """
        # Проверяем право назначения ролей
        await self._permission_checker.require_permission(
            company_id, assigner_user_id, Permission.ASSIGN_ROLES
        )
        
        # Проверяем, что роль существует
        role = await self._role_repo.get_by_id(role_id)
        if not role or role.company_id != company_id:
            raise RoleNotFoundError(f"Роль {role_id} не найдена")
        
        # Получаем членство
        member = await self._member_repo.get_by_company_and_user(
            company_id, target_user_id
        )
        if not member:
            raise MemberNotFoundError(
                f"Пользователь {target_user_id} не является членом компании"
            )
        
        # Проверяем, может ли назначить эту роль
        if not await self._permission_checker.can_assign_role(
            company_id, assigner_user_id, role_id
        ):
            raise PermissionDeniedError(
                message="Вы не можете назначить роль выше вашей"
            )
        
        # Проверяем, может ли управлять этим членом
        # (нельзя менять роль тому, кто выше в иерархии)
        if target_user_id != assigner_user_id:
            current_role = await self._permission_checker.get_user_role(
                company_id, target_user_id
            )
            assigner_role = await self._permission_checker.get_user_role(
                company_id, assigner_user_id
            )
            
            if current_role and not assigner_role.is_higher_than(current_role):
                if not assigner_role.is_owner_role():
                    raise PermissionDeniedError(
                        message="Вы не можете изменить роль пользователя "
                                "с ролью выше или равной вашей"
                    )
        
        # Назначаем роль
        member.role_id = role_id
        await self._member_repo.update(member)
        
        logger.info(
            f"Assigned role {role_id} to user {target_user_id} "
            f"in company {company_id} by {assigner_user_id}"
        )

    async def get_owner_role(self, company_id: UUID) -> CompanyRole | None:
        """Получить роль владельца компании."""
        return await self._role_repo.get_owner_role(company_id)

    async def get_default_role(self, company_id: UUID) -> CompanyRole | None:
        """Получить роль по умолчанию для новых членов."""
        return await self._role_repo.get_default_role(company_id)
