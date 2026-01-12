"""Domain enums module."""

from domain.enums.status import UserStatus
from domain.enums.contact import ContactType
from domain.enums.company import InvitationStatus
from domain.enums.permission import (
    Permission,
    PermissionGroup,
    PERMISSION_GROUPS,
    OWNER_PERMISSIONS,
    ADMIN_PERMISSIONS,
    MEMBER_PERMISSIONS,
)
from domain.enums.idea import IdeaStatus, IdeaVisibility, SwipeDirection
from domain.enums.project import ProjectStatus, ProjectMemberRole, MessageType

__all__ = [
    "UserStatus",
    "ContactType",
    "InvitationStatus",
    "Permission",
    "PermissionGroup",
    "PERMISSION_GROUPS",
    "OWNER_PERMISSIONS",
    "ADMIN_PERMISSIONS",
    "MEMBER_PERMISSIONS",
    # Ideas
    "IdeaStatus",
    "IdeaVisibility",
    "SwipeDirection",
    # Projects
    "ProjectStatus",
    "ProjectMemberRole",
    "MessageType",
]
