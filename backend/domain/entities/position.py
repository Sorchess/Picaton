from attr import dataclass

from domain.entities.base import Entity


@dataclass
class Position(Entity):
    """
    Доменная сущность должности.
    """

    name: str