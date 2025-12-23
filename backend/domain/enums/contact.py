from enum import Enum


class ContactType(str, Enum):
    TELEGRAM = "TELEGRAM"
    SLACK = "SLACK"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    GITHUB = "GITHUB"
    LINKEDIN = "LINKEDIN"