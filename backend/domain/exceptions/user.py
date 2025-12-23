from domain.exceptions.base import DomainException


class UserException(DomainException):
    """Базовое исключение для сущности User."""

    detail = "User error"
    status_code = 400


class InvalidEmailError(UserException):
    """Некорректный формат email."""

    detail = "Invalid email format"

    def __init__(self, email: str):
        self.email = email
        self.detail = f"Invalid email format: {email}"
        super().__init__()


class InvalidNameError(UserException):
    """Некорректное имя или фамилия."""

    detail = "Invalid name"

    def __init__(self, field: str, value: str, reason: str = ""):
        self.field = field
        self.value = value
        self.detail = f"Invalid {field}: '{value}'. {reason}".strip()
        super().__init__()


class InvalidContactValueError(UserException):
    """Некорректное значение контакта."""

    detail = "Invalid contact value"

    def __init__(self, contact_type: str, value: str, reason: str = ""):
        self.contact_type = contact_type
        self.value = value
        self.detail = f"Invalid {contact_type} contact: '{value}'. {reason}".strip()
        super().__init__()


class InvalidLocationError(UserException):
    """Некорректная локация."""

    detail = "Invalid location"

    def __init__(self, location: str, reason: str = ""):
        self.location = location
        self.detail = f"Invalid location: '{location}'. {reason}".strip()
        super().__init__()


class InvalidBioError(UserException):
    """Некорректная биография."""

    detail = "Invalid bio"

    def __init__(self, reason: str = ""):
        self.detail = f"Invalid bio. {reason}".strip()
        super().__init__()


class InvalidAvatarUrlError(UserException):
    """Некорректный URL аватара."""

    detail = "Invalid avatar URL"

    def __init__(self, url: str, reason: str = ""):
        self.url = url
        self.detail = f"Invalid avatar URL: '{url}'. {reason}".strip()
        super().__init__()


class InvalidPasswordError(UserException):
    """Некорректный пароль."""

    detail = "Invalid password"

    def __init__(self, reason: str = ""):
        self.detail = f"Invalid password. {reason}".strip()
        super().__init__()


class InvalidEmbeddingError(UserException):
    """Некорректный embedding вектор."""

    detail = "Invalid embedding vector"

    def __init__(self, reason: str = ""):
        self.detail = f"Invalid embedding vector. {reason}".strip()
        super().__init__()


class InvalidRandomFactError(UserException):
    """Некорректный рандомный факт."""

    detail = "Invalid random fact"

    def __init__(self, reason: str = ""):
        self.detail = f"Invalid random fact. {reason}".strip()
        super().__init__()


class UserNotFoundError(UserException):
    """Пользователь не найден."""

    detail = "User not found"
    status_code = 404

    def __init__(self, user_id: str = ""):
        if user_id:
            self.detail = f"User not found: {user_id}"
        super().__init__()


class UserAlreadyExistsError(UserException):
    """Пользователь уже существует."""

    detail = "User already exists"
    status_code = 409

    def __init__(self, email: str = ""):
        if email:
            self.detail = f"User with email {email} already exists"
        super().__init__()
