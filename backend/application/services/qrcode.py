import base64
import io
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import qrcode
from qrcode.image.pil import PilImage

from domain.entities.user import User
from domain.entities.business_card import BusinessCard
from domain.entities.share_link import ShareLink
from domain.repositories.share_link import ShareLinkRepositoryInterface


# Варианты срока действия ссылки (в секундах)
DURATION_OPTIONS = {
    "1d": timedelta(days=1),
    "1w": timedelta(weeks=1),
    "1m": timedelta(days=30),
    "forever": None,  # Бессрочная
}


@dataclass
class QRCodeData:
    """Данные QR-кода."""

    image_base64: str
    image_format: str = "png"
    token: Optional[str] = None
    expires_at: Optional[datetime] = None


class QRCodeService:
    """Сервис генерации QR-кодов для обмена контактами."""

    def __init__(
        self,
        base_url: str = "",
        share_link_repository: Optional[ShareLinkRepositoryInterface] = None,
    ):
        self._base_url = base_url
        self._share_link_repo = share_link_repository

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

    async def generate_card_qr_with_expiry(
        self,
        card_id: UUID,
        duration: str = "forever",
    ) -> QRCodeData:
        """
        Генерирует QR-код для визитной карточки с ограниченным сроком действия.

        Args:
            card_id: ID визитной карточки
            duration: Срок действия ссылки ('1d', '1w', '1m', 'forever')

        Returns:
            QRCodeData с QR-кодом и информацией о сроке действия
        """
        if not self._share_link_repo:
            # Если репозитория нет, генерируем обычную ссылку
            return self.generate_card_qr(card_id)

        # Генерируем уникальный токен
        token = secrets.token_urlsafe(32)

        # Определяем срок действия
        duration_delta = DURATION_OPTIONS.get(duration)
        expires_at = None
        if duration_delta is not None:
            expires_at = datetime.utcnow() + duration_delta

        # Создаем ссылку в БД
        share_link = ShareLink(
            card_id=card_id,
            token=token,
            expires_at=expires_at,
        )
        await self._share_link_repo.create(share_link)

        # Генерируем QR-код с токеном
        share_url = f"{self._base_url}/share/{token}"
        image_base64 = self._generate_qr_image(share_url)

        return QRCodeData(
            image_base64=image_base64,
            token=token,
            expires_at=expires_at,
        )

    async def get_card_by_token(self, token: str) -> Optional[UUID]:
        """
        Получить ID визитки по токену ссылки.

        Returns:
            ID карточки если ссылка валидна, иначе None
        """
        if not self._share_link_repo:
            return None

        link = await self._share_link_repo.get_by_token(token)
        if not link or not link.is_valid:
            return None

        # Увеличиваем счетчик просмотров
        await self._share_link_repo.increment_views(link.id)

        return link.card_id
