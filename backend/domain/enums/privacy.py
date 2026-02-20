from enum import Enum


class PrivacyLevel(str, Enum):
    """Уровень приватности для настроек профиля."""

    ALL = "all"
    CONTACTS = "contacts"
    CONTACTS_OF_CONTACTS = "contacts_of_contacts"
    NOBODY = "nobody"
