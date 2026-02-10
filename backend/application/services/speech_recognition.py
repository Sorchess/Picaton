"""Сервис распознавания речи через Yandex SpeechKit."""

import logging
from dataclasses import dataclass

import httpx

from settings.config import settings

logger = logging.getLogger(__name__)

YANDEX_STT_URL = "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize"


class SpeechRecognitionError(Exception):
    """Ошибка распознавания речи."""


class SpeechRecognitionUnavailableError(SpeechRecognitionError):
    """Сервис распознавания речи не настроен."""


@dataclass
class RecognitionResult:
    """Результат распознавания речи."""

    text: str


class SpeechRecognitionService:
    """Распознавание речи через Yandex SpeechKit (синхронный REST API v1).

    Принимает аудио до 30 секунд и возвращает распознанный текст.
    Поддерживаемые форматы: OGG/Opus, WAV (PCM), LPCM.
    """

    def __init__(self) -> None:
        config = settings.yandex_speechkit
        if not config.api_key or not config.folder_id:
            raise SpeechRecognitionUnavailableError(
                "Yandex SpeechKit не настроен: укажите YANDEX_SPEECHKIT__API_KEY и YANDEX_SPEECHKIT__FOLDER_ID"
            )
        self._api_key = config.api_key
        self._folder_id = config.folder_id
        self._lang = config.lang
        self._topic = config.topic

    async def recognize(
        self,
        audio_data: bytes,
        content_type: str | None = None,
    ) -> RecognitionResult:
        """Распознать речь из аудиоданных.

        Args:
            audio_data: Бинарные аудиоданные (OGG/Opus, WAV и т.д.)
            content_type: MIME-тип аудио. Если не указан, авто-определяется.

        Returns:
            RecognitionResult с распознанным текстом.

        Raises:
            SpeechRecognitionError: При ошибке API или пустом результате.
        """
        if not audio_data:
            raise SpeechRecognitionError("Пустые аудиоданные")

        # Определяем формат по content_type или по magic bytes
        format_param = self._detect_format(audio_data, content_type)

        params = {
            "folderId": self._folder_id,
            "lang": self._lang,
            "topic": self._topic,
        }
        if format_param:
            params["format"] = format_param

        headers = {
            "Authorization": f"Api-Key {self._api_key}",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    YANDEX_STT_URL,
                    params=params,
                    headers=headers,
                    content=audio_data,
                )

            if response.status_code != 200:
                error_text = response.text
                logger.error(
                    "Yandex SpeechKit error: status=%d, body=%s",
                    response.status_code,
                    error_text,
                )
                raise SpeechRecognitionError(
                    f"Ошибка распознавания речи (HTTP {response.status_code})"
                )

            data = response.json()
            text = data.get("result", "").strip()

            if not text:
                raise SpeechRecognitionError(
                    "Речь не распознана. Попробуйте говорить громче и чётче."
                )

            logger.info("Speech recognized: %d chars", len(text))
            return RecognitionResult(text=text)

        except httpx.TimeoutException:
            raise SpeechRecognitionError(
                "Превышено время ожидания ответа от сервиса распознавания"
            )
        except httpx.HTTPError as e:
            logger.error("HTTP error during speech recognition: %s", e)
            raise SpeechRecognitionError(
                "Ошибка соединения с сервисом распознавания речи"
            )

    @staticmethod
    def _detect_format(
        audio_data: bytes, content_type: str | None
    ) -> str | None:
        """Определить формат аудио для Yandex SpeechKit."""
        if content_type:
            ct = content_type.lower()
            if "ogg" in ct or "opus" in ct:
                return "oggopus"
            if "wav" in ct:
                return None  # WAV определяется автоматически
            if "webm" in ct:
                return "oggopus"  # WebM Opus -> oggopus

        # По magic bytes
        if audio_data[:4] == b"OggS":
            return "oggopus"
        if audio_data[:4] == b"RIFF":
            return None  # WAV

        return "oggopus"  # Default для браузерного MediaRecorder
