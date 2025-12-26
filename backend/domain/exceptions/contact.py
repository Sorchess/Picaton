from domain.exceptions.base import DomainException


class ContactException(DomainException):
    """Базовое исключение для сущности Contact."""

    detail = "Contact error"
    status_code = 400


class ContactNotFoundError(ContactException):
    """Контакт не найден."""

    detail = "Contact not found"
    status_code = 404

    def __init__(self, contact_id: str = ""):
        if contact_id:
            self.detail = f"Contact not found: {contact_id}"
        super().__init__()


class ContactAlreadyExistsError(ContactException):
    """Контакт уже существует."""

    detail = "Contact already saved"
    status_code = 409

    def __init__(self, user_id: str = ""):
        if user_id:
            self.detail = f"Contact for user {user_id} already saved"
        super().__init__()
