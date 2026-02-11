from domain.repositories.user import UserRepositoryInterface
from domain.repositories.saved_contact import SavedContactRepositoryInterface
from domain.repositories.business_card import BusinessCardRepositoryInterface
from domain.repositories.company import (
    CompanyRepositoryInterface,
    CompanyMemberRepositoryInterface,
    CompanyInvitationRepositoryInterface,
)
from domain.repositories.company_role import CompanyRoleRepositoryInterface
from domain.repositories.company_card import ICompanyCardRepository
from domain.repositories.company_tag_settings import ICompanyTagSettingsRepository
from domain.repositories.email_verification import EmailVerificationRepositoryInterface
from domain.repositories.skill_endorsement import SkillEndorsementRepositoryInterface
from domain.repositories.idea import IdeaRepositoryInterface
from domain.repositories.idea_swipe import IdeaSwipeRepositoryInterface
from domain.repositories.project import ProjectRepositoryInterface
from domain.repositories.project_member import ProjectMemberRepositoryInterface
from domain.repositories.chat_message import ChatMessageRepositoryInterface
from domain.repositories.conversation import ConversationRepositoryInterface
from domain.repositories.direct_message import DirectMessageRepositoryInterface

__all__ = [
    "UserRepositoryInterface",
    "SavedContactRepositoryInterface",
    "BusinessCardRepositoryInterface",
    "CompanyRepositoryInterface",
    "CompanyMemberRepositoryInterface",
    "CompanyInvitationRepositoryInterface",
    "CompanyRoleRepositoryInterface",
    "ICompanyCardRepository",
    "ICompanyTagSettingsRepository",
    "EmailVerificationRepositoryInterface",
    "SkillEndorsementRepositoryInterface",
    # Ideas & Projects
    "IdeaRepositoryInterface",
    "IdeaSwipeRepositoryInterface",
    "ProjectRepositoryInterface",
    "ProjectMemberRepositoryInterface",
    "ChatMessageRepositoryInterface",
    "ConversationRepositoryInterface",
    "DirectMessageRepositoryInterface",
]
