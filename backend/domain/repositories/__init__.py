from domain.repositories.user import UserRepositoryInterface
from domain.repositories.saved_contact import SavedContactRepositoryInterface
from domain.repositories.business_card import BusinessCardRepositoryInterface
from domain.repositories.company import (
    CompanyRepositoryInterface,
    CompanyMemberRepositoryInterface,
    CompanyInvitationRepositoryInterface,
)
from domain.repositories.email_verification import EmailVerificationRepositoryInterface
from domain.repositories.skill_endorsement import SkillEndorsementRepositoryInterface

__all__ = [
    "UserRepositoryInterface",
    "SavedContactRepositoryInterface",
    "BusinessCardRepositoryInterface",
    "CompanyRepositoryInterface",
    "CompanyMemberRepositoryInterface",
    "CompanyInvitationRepositoryInterface",
    "EmailVerificationRepositoryInterface",
    "SkillEndorsementRepositoryInterface",
]
