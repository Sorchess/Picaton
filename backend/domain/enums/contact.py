from enum import Enum


class ContactType(str, Enum):
    """Типы контактов для связи со специалистом."""

    # Мессенджеры
    TELEGRAM = "TELEGRAM"
    WHATSAPP = "WHATSAPP"
    VK = "VK"
    MESSENGER = "MESSENGER"  # Facebook Messenger

    # Базовые
    EMAIL = "EMAIL"
    PHONE = "PHONE"

    # Профессиональные
    LINKEDIN = "LINKEDIN"
    GITHUB = "GITHUB"

    # Креативные
    INSTAGRAM = "INSTAGRAM"
    TIKTOK = "TIKTOK"

    # Legacy
    SLACK = "SLACK"