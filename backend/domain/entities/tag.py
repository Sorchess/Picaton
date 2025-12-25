from dataclasses import dataclass, field
from typing import Literal

from domain.entities.base import Entity


@dataclass
class Tag(Entity):
    """
    Доменная сущность тега.
    """

    name: str
    category: Literal[
        "DEPARTMENT",
        "POSITION",
        "DOMAIN",
        "HARD_SKILL",
        "SOFT_SKILL",
    ]
    proficiency: int = field(default=1)
