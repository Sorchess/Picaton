from domain.exceptions.base import DomainException


class EmployeeException(DomainException):
    """Базовое исключение для сущности Employee."""

    detail = "Employee error"
    status_code = 400


class InvalidEmailError(EmployeeException):
    """Некорректный формат email."""

    detail = "Invalid email format"

    def __init__(self, email: str):
        self.email = email
        self.detail = f"Invalid email format: {email}"
        super().__init__()


class InvalidNameError(EmployeeException):
    """Некорректное имя или фамилия."""

    detail = "Invalid name"

    def __init__(self, field: str, value: str, reason: str = ""):
        self.field = field
        self.value = value
        self.detail = f"Invalid {field}: '{value}'. {reason}".strip()
        super().__init__()


class InvalidContactValueError(EmployeeException):
    """Некорректное значение контакта."""

    detail = "Invalid contact value"

    def __init__(self, contact_type: str, value: str, reason: str = ""):
        self.contact_type = contact_type
        self.value = value
        self.detail = f"Invalid {contact_type} contact: '{value}'. {reason}".strip()
        super().__init__()


class InvalidLocationError(EmployeeException):
    """Некорректная локация."""

    detail = "Invalid location"

    def __init__(self, location: str, reason: str = ""):
        self.location = location
        self.detail = f"Invalid location: '{location}'. {reason}".strip()
        super().__init__()


class InvalidBioError(EmployeeException):
    """Некорректная биография."""

    detail = "Invalid bio"

    def __init__(self, reason: str = ""):
        self.detail = f"Invalid bio. {reason}".strip()
        super().__init__()


class InvalidAvatarUrlError(EmployeeException):
    """Некорректный URL аватара."""

    detail = "Invalid avatar URL"

    def __init__(self, url: str, reason: str = ""):
        self.url = url
        self.detail = f"Invalid avatar URL: '{url}'. {reason}".strip()
        super().__init__()


class InvalidPasswordError(EmployeeException):
    """Некорректный пароль."""

    detail = "Invalid password"

    def __init__(self, reason: str = ""):
        self.detail = f"Invalid password. {reason}".strip()
        super().__init__()


class InvalidEmbeddingError(EmployeeException):
    """Некорректный embedding вектор."""

    detail = "Invalid embedding vector"

    def __init__(self, reason: str = ""):
        self.detail = f"Invalid embedding vector. {reason}".strip()
        super().__init__()
