"""Domain entities module."""

from domain.entities.base import Entity
from domain.entities.user import User
from domain.entities.saved_contact import SavedContact
from domain.entities.tag import Tag
from domain.entities.business_card import BusinessCard

__all__ = [
    "Entity",
    "User",
    "SavedContact",
    "Tag",
    "BusinessCard",
]
