from dataclasses import dataclass

from domain.entities.base import Entity


@dataclass
class Department(Entity):
    """
    Доменная сущность отдела.
    """

    name: str