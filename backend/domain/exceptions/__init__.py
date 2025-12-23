"""Domain exceptions module."""

from domain.exceptions.base import DomainException
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


__all__ = [
    "DomainException",
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
]
