from application.services.user import UserService
from application.services.saved_contact import SavedContactService
from application.services.search import AssociativeSearchService
from application.services.qrcode import QRCodeService
from application.services.ai_bio import AIBioGeneratorService
from application.services.llm_bio import AIBioGenerator
from application.services.ai_tags import AITagsGeneratorService, MockAITagsGenerator
from application.services.contact_import import ContactImportService
from application.services.contact_sync import ContactSyncService
from application.services.auth import (
    AuthService,
    AuthenticationError,
    InvalidCredentialsError,
    InvalidTokenError,
)
from application.services.magic_link import (
    MagicLinkService,
    MagicLinkError,
    MagicLinkExpiredError,
    MagicLinkInvalidError,
)
from application.services.telegram_auth import (
    TelegramAuthService,
    TelegramAuthError,
    TelegramDataExpiredError,
    TelegramInvalidHashError,
    TelegramBotNotConfiguredError,
)
from application.services.business_card import BusinessCardService
from application.services.company import (
    CompanyService,
    CompanyError,
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
from application.services.skill_endorsement import (
    SkillEndorsementService,
    EndorsementError,
    CannotEndorseOwnSkillError,
    AlreadyEndorsedError,
    CardNotFoundError,
    TagNotFoundError,
    EndorsementNotFoundError,
)
from application.services.company_role import (
    CompanyRoleService,
    RoleError,
    RoleNotFoundError,
    RoleAlreadyExistsError,
    SystemRoleError,
    RoleInUseError,
    RoleHierarchyViolationError,
)
from application.services.permission_checker import (
    PermissionChecker,
    PermissionDeniedError as RolePermissionDeniedError,
    MemberNotFoundError as RoleMemberNotFoundError,
)
from application.services.company_card import (
    CompanyCardService,
    CompanyCardNotFoundError,
    CardAlreadyExistsError,
    InvalidTagValueError,
    CompanyTagSettingsService,
)

__all__ = [
    "UserService",
    "SavedContactService",
    "AssociativeSearchService",
    "QRCodeService",
    "AIBioGeneratorService",
    "AIBioGenerator",
    "AITagsGeneratorService",
    "MockAITagsGenerator",
    "ContactImportService",
    "ContactSyncService",
    "AuthService",
    "AuthenticationError",
    "InvalidCredentialsError",
    "InvalidTokenError",
    "MagicLinkService",
    "MagicLinkError",
    "MagicLinkExpiredError",
    "MagicLinkInvalidError",
    "TelegramAuthService",
    "TelegramAuthError",
    "TelegramDataExpiredError",
    "TelegramInvalidHashError",
    "TelegramBotNotConfiguredError",
    "BusinessCardService",
    "CompanyService",
    "CompanyError",
    "CompanyNotFoundError",
    "CompanyAlreadyExistsError",
    "MemberNotFoundError",
    "AlreadyMemberError",
    "InvitationNotFoundError",
    "InvitationExpiredError",
    "InvitationAlreadyExistsError",
    "PermissionDeniedError",
    "CannotRemoveOwnerError",
    "CannotChangeOwnRoleError",
    "SkillEndorsementService",
    "EndorsementError",
    "CannotEndorseOwnSkillError",
    "AlreadyEndorsedError",
    "CardNotFoundError",
    "TagNotFoundError",
    "EndorsementNotFoundError",
    # Role services
    "CompanyRoleService",
    "RoleError",
    "RoleNotFoundError",
    "RoleAlreadyExistsError",
    "SystemRoleError",
    "RoleInUseError",
    "RoleHierarchyViolationError",
    "PermissionChecker",
    "RolePermissionDeniedError",
    "RoleMemberNotFoundError",
    # Company Card services
    "CompanyCardService",
    "CompanyCardNotFoundError",
    "CardAlreadyExistsError",
    "InvalidTagValueError",
    "CompanyTagSettingsService",
]
