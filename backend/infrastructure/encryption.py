"""Сервис шифрования сообщений чата.

Использует Fernet (AES-128-CBC + HMAC-SHA256) из библиотеки cryptography.
Fernet гарантирует:
- Конфиденциальность (AES-128-CBC)
- Целостность (HMAC-SHA256)
- Уникальный IV для каждого шифрования
- Защиту от replay-атак (timestamp)

Зашифрованные данные хранятся в MongoDB как строки с префиксом 'enc:',
что позволяет отличать зашифрованные данные от незашифрованных
(для обратной совместимости с существующими сообщениями).
"""

import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from settings.config import settings


logger = logging.getLogger(__name__)

# Префикс для идентификации зашифрованных данных
ENCRYPTED_PREFIX = "enc:"


class MessageEncryption:
    """Сервис шифрования/дешифрования контента сообщений."""

    def __init__(self, key: str):
        """
        Args:
            key: Fernet-совместимый ключ (base64-encoded 32 bytes).
                 Сгенерировать: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
        """
        if not key:
            raise ValueError(
                "Encryption key is not configured. "
                "Set ENCRYPTION__CHAT_KEY env var. "
                'Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        """Зашифровать текст.

        Returns:
            Строка с префиксом 'enc:' + зашифрованные данные в base64
        """
        if not plaintext:
            return plaintext
        encrypted = self._fernet.encrypt(plaintext.encode("utf-8"))
        return ENCRYPTED_PREFIX + encrypted.decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        """Расшифровать текст.

        Автоматически определяет, зашифрован ли текст (по префиксу 'enc:').
        Если текст не зашифрован — возвращает как есть (обратная совместимость).

        Returns:
            Расшифрованный текст или исходный текст если не зашифрован
        """
        if not ciphertext:
            return ciphertext

        # Незашифрованные данные возвращаем как есть (обратная совместимость)
        if not ciphertext.startswith(ENCRYPTED_PREFIX):
            return ciphertext

        encrypted_data = ciphertext[len(ENCRYPTED_PREFIX) :]
        try:
            decrypted = self._fernet.decrypt(encrypted_data.encode("utf-8"))
            return decrypted.decode("utf-8")
        except InvalidToken:
            logger.error(
                "Failed to decrypt message — invalid token or corrupted data. "
                "Check that ENCRYPTION__CHAT_KEY has not changed."
            )
            return "[Ошибка расшифровки]"
        except Exception as e:
            logger.error(f"Unexpected decryption error: {e}")
            return "[Ошибка расшифровки]"


@lru_cache(maxsize=1)
def get_message_encryption() -> MessageEncryption:
    """Получить singleton экземпляр сервиса шифрования сообщений."""
    return MessageEncryption(settings.encryption.chat_key)
