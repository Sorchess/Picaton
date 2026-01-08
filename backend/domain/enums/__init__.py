"""Domain enums module."""

from domain.enums.status import UserStatus
from domain.enums.contact import ContactType
from domain.enums.company import LegacyCompanyRole, InvitationStatus
from domain.enums.permission import (
    Permission,
    PermissionGroup,
    PERMISSION_GROUPS,
    OWNER_PERMISSIONS,
    ADMIN_PERMISSIONS,
    MEMBER_PERMISSIONS,
)

__all__ = [
    "UserStatus",
    "ContactType",
    "LegacyCompanyRole",
    "InvitationStatus",
    "Permission",
    "PermissionGroup",
    "PERMISSION_GROUPS",
    "OWNER_PERMISSIONS",
    "ADMIN_PERMISSIONS",
    "MEMBER_PERMISSIONS",
]
