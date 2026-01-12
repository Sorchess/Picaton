"""Domain entities module."""

from domain.entities.base import Entity
from domain.entities.user import User
from domain.entities.saved_contact import SavedContact
from domain.entities.tag import Tag
from domain.entities.business_card import BusinessCard
from domain.entities.company import Company, CompanyMember, CompanyInvitation
from domain.entities.company_role import CompanyRole
from domain.entities.company_card import CompanyCard
from domain.entities.company_settings import CompanyTagSettings, TagFieldSettings
from domain.entities.skill_endorsement import SkillEndorsement
from domain.entities.idea import Idea
from domain.entities.idea_swipe import IdeaSwipe
from domain.entities.project import Project
from domain.entities.project_member import ProjectMember
from domain.entities.chat_message import ChatMessage

__all__ = [
    "Entity",
    "User",
    "SavedContact",
    "Tag",
    "BusinessCard",
    "Company",
    "CompanyMember",
    "CompanyInvitation",
    "CompanyRole",
    "CompanyCard",
    "CompanyTagSettings",
    "TagFieldSettings",
    "SkillEndorsement",
    # Ideas & Projects
    "Idea",
    "IdeaSwipe",
    "Project",
    "ProjectMember",
    "ChatMessage",
]
