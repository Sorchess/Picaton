from abc import ABC
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass(kw_only=True)
class Entity(ABC):
    """Базовый класс для всех доменных сущностей."""

    id: UUID = field(default_factory=uuid4)

    def __hash__(self) -> int:
        return hash(self.id)

    def __eq__(self, __value: "Entity") -> bool:
        return self.id == __value.id
