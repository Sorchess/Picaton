"""
Интерфейс репозитория для подтверждений навыков.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from domain.entities.skill_endorsement import SkillEndorsement


class SkillEndorsementRepositoryInterface(ABC):
    """Интерфейс репозитория подтверждений навыков."""

    @abstractmethod
    async def create(self, endorsement: SkillEndorsement) -> SkillEndorsement:
        """Создать подтверждение навыка."""
        pass

    @abstractmethod
    async def delete(self, endorser_id: UUID, card_id: UUID, tag_id: UUID) -> bool:
        """Удалить подтверждение (снять лайк)."""
        pass

    @abstractmethod
    async def get_by_endorser_and_tag(
        self, endorser_id: UUID, card_id: UUID, tag_id: UUID
    ) -> SkillEndorsement | None:
        """Получить конкретное подтверждение."""
        pass

    @abstractmethod
    async def get_endorsements_for_card(self, card_id: UUID) -> list[SkillEndorsement]:
        """Получить все подтверждения для карточки."""
        pass

    @abstractmethod
    async def get_endorsements_for_tag(
        self, card_id: UUID, tag_id: UUID
    ) -> list[SkillEndorsement]:
        """Получить подтверждения для конкретного навыка карточки."""
        pass

    @abstractmethod
    async def get_endorsements_by_user(
        self, endorser_id: UUID
    ) -> list[SkillEndorsement]:
        """Получить все подтверждения, сделанные пользователем."""
        pass

    @abstractmethod
    async def get_endorsement_count_for_tag(self, card_id: UUID, tag_id: UUID) -> int:
        """Получить количество подтверждений для навыка."""
        pass

    @abstractmethod
    async def get_endorsement_counts_for_card(self, card_id: UUID) -> dict[str, int]:
        """Получить количество подтверждений для всех навыков карточки."""
        pass

    @abstractmethod
    async def get_endorsers_from_contacts(
        self, card_id: UUID, tag_id: UUID, contact_user_ids: list[UUID]
    ) -> list[SkillEndorsement]:
        """
        Получить подтверждения от конкретных пользователей (контактов).
        Используется для показа "X из ваших контактов подтвердили этот навык".
        """
        pass

    @abstractmethod
    async def has_user_endorsed(
        self, endorser_id: UUID, card_id: UUID, tag_id: UUID
    ) -> bool:
        """Проверить, подтвердил ли пользователь навык."""
        pass
