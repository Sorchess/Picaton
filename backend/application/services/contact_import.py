from dataclasses import dataclass
from uuid import UUID

from domain.entities.saved_contact import SavedContact
from domain.repositories.saved_contact import SavedContactRepositoryInterface


@dataclass
class ImportedContact:
    """Контакт для импорта из телефонной книги."""

    name: str
    phone: str | None = None
    email: str | None = None


@dataclass
class ImportResult:
    """Результат импорта контактов."""

    imported_count: int
    skipped_count: int
    errors: list[str]


class ContactImportService:
    """Сервис импорта контактов из телефонной книги."""

    def __init__(self, contact_repository: SavedContactRepositoryInterface):
        self._contact_repository = contact_repository

    async def import_contacts(
        self,
        owner_id: UUID,
        contacts: list[ImportedContact],
    ) -> ImportResult:
        """
        Импортировать контакты из телефонной книги.
        """
        imported = []
        skipped = 0
        errors = []

        for contact_data in contacts:
            try:
                # Проверяем, есть ли уже такой контакт
                if not contact_data.name:
                    skipped += 1
                    continue

                saved_contact = SavedContact(
                    owner_id=owner_id,
                    name=contact_data.name,
                    phone=contact_data.phone,
                    email=contact_data.email,
                    source="import",
                )

                imported.append(saved_contact)

            except Exception as e:
                errors.append(f"Error importing {contact_data.name}: {str(e)}")
                skipped += 1

        # Массовое сохранение
        if imported:
            await self._contact_repository.bulk_create(imported)

        return ImportResult(
            imported_count=len(imported),
            skipped_count=skipped,
            errors=errors,
        )

    async def import_vcard(self, owner_id: UUID, vcard_data: str) -> ImportResult:
        """
        Импортировать контакт из vCard данных.
        """
        try:
            contact = self._parse_vcard(vcard_data)
            if not contact.name:
                return ImportResult(
                    imported_count=0, skipped_count=1, errors=["Empty name"]
                )

            saved_contact = SavedContact(
                owner_id=owner_id,
                name=contact.name,
                phone=contact.phone,
                email=contact.email,
                source="import",
            )

            await self._contact_repository.create(saved_contact)

            return ImportResult(imported_count=1, skipped_count=0, errors=[])

        except Exception as e:
            return ImportResult(imported_count=0, skipped_count=1, errors=[str(e)])

    def _parse_vcard(self, vcard_data: str) -> ImportedContact:
        """Парсинг vCard данных."""
        name = ""
        phone = None
        email = None

        for line in vcard_data.split("\n"):
            line = line.strip()
            if line.startswith("FN:"):
                name = line[3:]
            elif line.startswith("TEL"):
                # Извлекаем номер телефона
                if ":" in line:
                    phone = line.split(":", 1)[1]
            elif line.startswith("EMAIL"):
                if ":" in line:
                    email = line.split(":", 1)[1]

        return ImportedContact(name=name, phone=phone, email=email)
