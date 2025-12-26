"""Domain exceptions module."""

from domain.exceptions.base import DomainException, ConfigurationError
from domain.exceptions.user import (
    UserException,
    InvalidEmailError,
    InvalidNameError,
    InvalidContactValueError,
    InvalidLocationError,
    InvalidBioError,
    InvalidAvatarUrlError,
    InvalidPasswordError,
    InvalidEmbeddingError,
    InvalidRandomFactError,
    UserNotFoundError,
    UserAlreadyExistsError,
)
from domain.exceptions.contact import (
    ContactException,
    ContactNotFoundError,
    ContactAlreadyExistsError,
)


__all__ = [
    "DomainException",
    "ConfigurationError",
    "UserException",
    "InvalidEmailError",
    "InvalidNameError",
    "InvalidContactValueError",
    "InvalidLocationError",
    "InvalidBioError",
    "InvalidAvatarUrlError",
    "InvalidPasswordError",
    "InvalidEmbeddingError",
    "InvalidRandomFactError",
    "UserNotFoundError",
    "UserAlreadyExistsError",
    "ContactException",
    "ContactNotFoundError",
    "ContactAlreadyExistsError",
]
