from dataclasses import dataclass

from domain.enums.contact import ContactType


@dataclass(frozen=True)
class Contact:
    """
    Контакт сотрудника (Value Object).
    Позволяет иметь сколько угодно контактов разных типов.
    """

    type: ContactType
    value: str
    is_primary: bool = False
    is_visible: bool = True  # Показывать в публичном профиле