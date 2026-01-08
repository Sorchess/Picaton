"""Доменная сущность роли в компании."""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.enums.permission import (
    Permission,
    OWNER_PERMISSIONS,
    ADMIN_PERMISSIONS,
    MEMBER_PERMISSIONS,
)


# Валидация
ROLE_NAME_REGEX = re.compile(r"^[\w\s\-']{1,50}$", re.UNICODE)
HEX_COLOR_REGEX = re.compile(r"^#[0-9A-Fa-f]{6}$")

MAX_ROLE_NAME_LENGTH = 50
DEFAULT_ROLE_COLOR = "#808080"  # Серый по умолчанию

# Системные приоритеты (чем меньше, тем выше роль)
OWNER_PRIORITY = 0
ADMIN_PRIORITY = 1
MEMBER_PRIORITY = 100  # Обычные роли между 2-99


class InvalidRoleNameError(ValueError):
    """Невалидное название роли."""
    pass


class InvalidRoleColorError(ValueError):
    """Невалидный цвет роли."""
    pass


class SystemRoleModificationError(ValueError):
    """Попытка изменить системную роль недопустимым образом."""
    pass


class RoleHierarchyError(ValueError):
    """Ошибка иерархии ролей."""
    pass


@dataclass
class CompanyRole(Entity):
    """
    Доменная сущность роли в компании.
    
    Реализует систему ролей как в Discord/Telegram:
    - Владелец (системная роль, приоритет 0)
    - Кастомные роли с настраиваемыми правами
    - Иерархия по приоритету (меньше = выше)
    """

    # Связь с компанией
    company_id: UUID = field(default=None)

    # Основные данные
    name: str = field(default="")
    color: str = field(default=DEFAULT_ROLE_COLOR)  # HEX цвет для UI
    
    # Иерархия (0 = владелец, чем больше число - тем ниже роль)
    priority: int = field(default=MEMBER_PRIORITY)
    
    # Права доступа
    permissions: set[Permission] = field(default_factory=set)
    
    # Системные роли нельзя удалить/переименовать
    is_system: bool = field(default=False)
    
    # Флаг для роли "по умолчанию" для новых сотрудников
    is_default: bool = field(default=False)

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        """Валидация данных при создании сущности."""
        if self.name:
            self._validate_name(self.name)
        if self.color:
            self._validate_color(self.color)
        # Конвертируем список в set если нужно
        if isinstance(self.permissions, list):
            self.permissions = set(self.permissions)

    @staticmethod
    def _validate_name(name: str) -> None:
        """Валидация названия роли."""
        if len(name) > MAX_ROLE_NAME_LENGTH:
            raise InvalidRoleNameError(
                f"Название роли не должно превышать {MAX_ROLE_NAME_LENGTH} символов"
            )
        if not ROLE_NAME_REGEX.match(name):
            raise InvalidRoleNameError(
                "Название роли содержит недопустимые символы"
            )

    @staticmethod
    def _validate_color(color: str) -> None:
        """Валидация HEX цвета."""
        if not HEX_COLOR_REGEX.match(color):
            raise InvalidRoleColorError(
                "Цвет должен быть в формате HEX (#RRGGBB)"
            )

    def has_permission(self, permission: Permission) -> bool:
        """Проверить, есть ли у роли указанное право."""
        return permission in self.permissions

    def has_any_permission(self, permissions: set[Permission]) -> bool:
        """Проверить, есть ли хотя бы одно из указанных прав."""
        return bool(self.permissions & permissions)

    def has_all_permissions(self, permissions: set[Permission]) -> bool:
        """Проверить, есть ли все указанные права."""
        return permissions <= self.permissions

    def add_permission(self, permission: Permission) -> None:
        """Добавить право роли."""
        if self.is_system and self.priority == OWNER_PRIORITY:
            return  # Владелец уже имеет все права
        self.permissions.add(permission)
        self.updated_at = datetime.now(timezone.utc)

    def remove_permission(self, permission: Permission) -> None:
        """Удалить право у роли."""
        if self.is_system and self.priority == OWNER_PRIORITY:
            raise SystemRoleModificationError(
                "Нельзя удалить права у роли владельца"
            )
        self.permissions.discard(permission)
        self.updated_at = datetime.now(timezone.utc)

    def set_permissions(self, permissions: set[Permission]) -> None:
        """Установить набор прав для роли."""
        if self.is_system and self.priority == OWNER_PRIORITY:
            raise SystemRoleModificationError(
                "Нельзя изменить права роли владельца"
            )
        self.permissions = permissions
        self.updated_at = datetime.now(timezone.utc)

    def update_name(self, name: str) -> None:
        """Обновить название роли."""
        if self.is_system:
            raise SystemRoleModificationError(
                "Нельзя переименовать системную роль"
            )
        self._validate_name(name)
        self.name = name
        self.updated_at = datetime.now(timezone.utc)

    def update_color(self, color: str) -> None:
        """Обновить цвет роли."""
        self._validate_color(color)
        self.color = color
        self.updated_at = datetime.now(timezone.utc)

    def update_priority(self, priority: int) -> None:
        """Обновить приоритет роли."""
        if self.is_system:
            raise SystemRoleModificationError(
                "Нельзя изменить приоритет системной роли"
            )
        if priority <= ADMIN_PRIORITY:
            raise RoleHierarchyError(
                "Приоритет кастомной роли должен быть больше 1"
            )
        self.priority = priority
        self.updated_at = datetime.now(timezone.utc)

    def is_higher_than(self, other: "CompanyRole") -> bool:
        """Проверить, выше ли эта роль в иерархии."""
        return self.priority < other.priority

    def is_owner_role(self) -> bool:
        """Проверить, является ли это ролью владельца."""
        return self.is_system and self.priority == OWNER_PRIORITY

    def is_admin_role(self) -> bool:
        """Проверить, является ли это ролью администратора."""
        return self.is_system and self.priority == ADMIN_PRIORITY

    @classmethod
    def create_owner_role(cls, company_id: UUID) -> "CompanyRole":
        """Создать системную роль владельца."""
        return cls(
            company_id=company_id,
            name="Владелец",
            color="#FFD700",  # Золотой
            priority=OWNER_PRIORITY,
            permissions=OWNER_PERMISSIONS.copy(),
            is_system=True,
            is_default=False,
        )

    @classmethod
    def create_admin_role(cls, company_id: UUID) -> "CompanyRole":
        """Создать системную роль администратора."""
        return cls(
            company_id=company_id,
            name="Администратор",
            color="#FF4500",  # Оранжево-красный
            priority=ADMIN_PRIORITY,
            permissions=ADMIN_PERMISSIONS.copy(),
            is_system=True,
            is_default=False,
        )

    @classmethod
    def create_member_role(cls, company_id: UUID) -> "CompanyRole":
        """Создать системную роль участника (по умолчанию)."""
        return cls(
            company_id=company_id,
            name="Сотрудник",
            color="#808080",  # Серый
            priority=MEMBER_PRIORITY,
            permissions=MEMBER_PERMISSIONS.copy(),
            is_system=True,
            is_default=True,  # Роль по умолчанию для новых членов
        )

    @classmethod
    def create_custom_role(
        cls,
        company_id: UUID,
        name: str,
        color: str = DEFAULT_ROLE_COLOR,
        priority: int = 50,
        permissions: set[Permission] | None = None,
    ) -> "CompanyRole":
        """Создать кастомную роль."""
        if priority <= ADMIN_PRIORITY:
            raise RoleHierarchyError(
                "Приоритет кастомной роли должен быть больше 1"
            )
        return cls(
            company_id=company_id,
            name=name,
            color=color,
            priority=priority,
            permissions=permissions or MEMBER_PERMISSIONS.copy(),
            is_system=False,
            is_default=False,
        )
