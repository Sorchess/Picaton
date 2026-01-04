import base64
import io
from dataclasses import dataclass
from uuid import UUID

import qrcode
from qrcode.image.pil import PilImage

from domain.entities.user import User
from domain.entities.business_card import BusinessCard


@dataclass
class QRCodeData:
    """Данные QR-кода."""

    image_base64: str
    image_format: str = "png"


class QRCodeService:
    """Сервис генерации QR-кодов для обмена контактами."""

    def __init__(self, base_url: str = ""):
        self._base_url = base_url

    def _generate_qr_image(self, data: str) -> str:
        """Генерирует QR-код изображение из данных."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(
            image_factory=PilImage, fill_color="black", back_color="white"
        )

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return "data:image/png;base64," + base64.b64encode(buffer.read()).decode(
            "utf-8"
        )

    def generate_contact_qr(self, user: User) -> QRCodeData:
        """
        Генерирует QR-код для пользователя.
        QR-код содержит ссылку на профиль или vCard данные.
        """
        profile_url = f"{self._base_url}/users/{user.id}"
        image_base64 = self._generate_qr_image(profile_url)
        return QRCodeData(image_base64=image_base64)

    def generate_card_qr(self, card_id: UUID) -> QRCodeData:
        """
        Генерирует QR-код для визитной карточки.
        QR-код содержит ссылку на конкретную карточку.
        """
        card_url = f"{self._base_url}/cards/{card_id}"
        image_base64 = self._generate_qr_image(card_url)
        return QRCodeData(image_base64=image_base64)

    def generate_vcard_qr(self, user: User) -> QRCodeData:
        """
        Генерирует QR-код с данными vCard.
        """
        # Формируем vCard
        vcard_lines = [
            "BEGIN:VCARD",
            "VERSION:3.0",
            f"FN:{user.full_name}",
            f"N:{user.last_name};{user.first_name};;;",
        ]

        if user.email:
            vcard_lines.append(f"EMAIL:{user.email}")

        # Добавляем контакты
        for contact in user.contacts:
            if contact.type.value == "PHONE":
                vcard_lines.append(f"TEL:{contact.value}")
            elif contact.type.value == "EMAIL":
                vcard_lines.append(f"EMAIL:{contact.value}")

        if user.bio:
            vcard_lines.append(f"NOTE:{user.bio}")

        vcard_lines.append("END:VCARD")
        vcard_data = "\n".join(vcard_lines)

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(vcard_data)
        qr.make(fit=True)

        img = qr.make_image(
            image_factory=PilImage, fill_color="black", back_color="white"
        )

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image_base64 = "data:image/png;base64," + base64.b64encode(
            buffer.read()
        ).decode("utf-8")

        return QRCodeData(image_base64=image_base64)
