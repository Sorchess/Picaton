"""
Cloudinary service for image storage.

Handles avatar uploads with automatic optimization.
"""

import cloudinary
import cloudinary.uploader
from dataclasses import dataclass
from uuid import UUID

from settings.config import settings


@dataclass
class UploadResult:
    """Result of image upload."""

    url: str
    public_id: str
    format: str
    width: int
    height: int


class CloudinaryError(Exception):
    """Base exception for Cloudinary errors."""

    pass


class InvalidFileError(CloudinaryError):
    """Invalid file format or size."""

    pass


class UploadError(CloudinaryError):
    """Upload failed."""

    pass


class CloudinaryService:
    """
    Service for uploading and managing images in Cloudinary.

    Features:
    - Automatic image optimization
    - Size validation
    - Format validation
    - Automatic resizing to 400x400 for avatars
    """

    def __init__(self):
        self._config = settings.cloudinary
        self._configured = False
        self._configure()

    def _configure(self) -> None:
        """Configure Cloudinary SDK."""
        if not self._config.cloud_name or not self._config.api_key:
            return

        cloudinary.config(
            cloud_name=self._config.cloud_name,
            api_key=self._config.api_key,
            api_secret=self._config.api_secret,
            secure=True,
        )
        self._configured = True

    @property
    def is_configured(self) -> bool:
        """Check if Cloudinary is properly configured."""
        return self._configured

    def validate_file(self, file_content: bytes, filename: str) -> None:
        """
        Validate file before upload.

        Args:
            file_content: File bytes
            filename: Original filename

        Raises:
            InvalidFileError: If file is invalid
        """
        # Check size
        if len(file_content) > self._config.max_file_size:
            max_mb = self._config.max_file_size / (1024 * 1024)
            raise InvalidFileError(f"Файл слишком большой. Максимум: {max_mb}MB")

        # Check format
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in self._config.allowed_formats:
            allowed = ", ".join(self._config.allowed_formats)
            raise InvalidFileError(f"Неподдерживаемый формат. Разрешены: {allowed}")

    async def upload_avatar(
        self,
        user_id: UUID,
        file_content: bytes,
        filename: str,
    ) -> UploadResult:
        """
        Upload avatar image.

        Args:
            user_id: User ID for public_id generation
            file_content: Image bytes
            filename: Original filename

        Returns:
            UploadResult with URL and metadata

        Raises:
            InvalidFileError: If file is invalid
            UploadError: If upload fails
            CloudinaryError: If Cloudinary not configured
        """
        if not self._configured:
            raise CloudinaryError("Cloudinary не настроен")

        self.validate_file(file_content, filename)

        public_id = f"{self._config.folder}/{user_id}"

        try:
            result = cloudinary.uploader.upload(
                file_content,
                public_id=public_id,
                overwrite=True,
                resource_type="image",
                transformation=[
                    {"width": 400, "height": 400, "crop": "fill", "gravity": "face"},
                    {"quality": "auto:good"},
                    {"fetch_format": "auto"},
                ],
            )

            return UploadResult(
                url=result["secure_url"],
                public_id=result["public_id"],
                format=result["format"],
                width=result.get("width", 400),
                height=result.get("height", 400),
            )

        except Exception as e:
            raise UploadError(f"Ошибка загрузки: {str(e)}")

    async def delete_avatar(self, user_id: UUID) -> bool:
        """
        Delete avatar image.

        Args:
            user_id: User ID

        Returns:
            True if deleted, False if not found
        """
        if not self._configured:
            return False

        public_id = f"{self._config.folder}/{user_id}"

        try:
            result = cloudinary.uploader.destroy(public_id)
            return result.get("result") == "ok"
        except Exception:
            return False
