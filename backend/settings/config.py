import logging
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


LOG_DEFAULT_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-3s - %(message)s"


class LoggingConfig(BaseModel):
    log_level: Literal["debug", "info", "warning", "error", "critical"] = "info"
    log_format: str = LOG_DEFAULT_FORMAT
    date_format: str = "%Y-%m-%d %H:%M:%S"

    @property
    def log_level_value(self) -> int:
        return logging.getLevelNamesMapping()[self.log_level.upper()]


class DatabaseConfig(BaseModel):
    host: str
    port: str
    username: str
    password: str
    name: str
    tls: bool = False  # Enable TLS for MongoDB connection
    tls_ca_file: str = ""  # Path to CA certificate file
    tls_allow_invalid_certificates: bool = False  # Allow self-signed certs (dev only)

    @property
    def url(self) -> str:
        base = f"mongodb://{self.username}:{self.password}@{self.host}:{self.port}/"
        if self.tls:
            params = ["tls=true"]
            if self.tls_ca_file:
                params.append(f"tlsCAFile={self.tls_ca_file}")
            if self.tls_allow_invalid_certificates:
                params.append("tlsAllowInvalidCertificates=true")
            base += "?" + "&".join(params)
        return base


class APIConfig(BaseModel):
    url: str
    port: str


class JWTConfig(BaseModel):
    secret_key: str = Field(
        default=...,
        description="JWT secret key — MUST be set via JWT__SECRET_KEY env var",
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days


class GigaChatConfig(BaseModel):
    """Конфигурация GigaChat API от Сбера."""

    credentials: str = ""  # Base64 encoded client_id:client_secret
    scope: str = "GIGACHAT_API_PERS"  # GIGACHAT_API_PERS или GIGACHAT_API_CORP
    model: str = "GigaChat"  # GigaChat, GigaChat-Pro, GigaChat-Max
    max_tokens: int = 500
    temperature: float = 0.7
    verify_ssl_certs: bool = False  # Для разработки без Russian CA cert


class LocalLLMConfig(BaseModel):
    """Конфигурация локального LLM (llama.cpp сервер)."""

    enabled: bool = False
    base_url: str = "http://localhost:8080"
    model: str = "T-lite-instruct-0.1"
    max_tokens: int = 500
    temperature: float = 0.7
    timeout: float = 120.0  # Увеличенный timeout для локальной модели


class EmbeddingConfig(BaseModel):
    """Конфигурация сервиса эмбеддингов (USER-bge-m3)."""

    enabled: bool = False
    model_path: str = "/root/models/embedding/user-bge-m3"
    dimensions: int = 1024
    normalize: bool = True


class CloudinaryConfig(BaseModel):
    """Конфигурация Cloudinary для хранения изображений."""

    cloud_name: str = ""
    api_key: str = ""
    api_secret: str = ""
    folder: str = "picaton/avatars"
    max_file_size: int = 5 * 1024 * 1024  # 5MB
    allowed_formats: list[str] = ["jpg", "jpeg", "png", "webp"]


class EmailConfig(BaseModel):
    """Конфигурация отправки email."""

    smtp_host: str = "localhost"  # Локальный Postfix на сервере
    smtp_port: int = 25  # Локальный порт без TLS
    smtp_user: str = ""  # Не нужен для локального Postfix
    smtp_password: str = ""  # Не нужен для локального Postfix
    from_email: str = "info@picaton.com"
    from_name: str = "Picaton"
    use_tls: bool = False  # Для локального Postfix TLS не нужен
    enabled: bool = False


class RabbitMQConfig(BaseModel):
    """Конфигурация RabbitMQ."""

    host: str = "rabbitmq"
    port: int = 5672
    username: str = "guest"
    password: str = "guest"

    @property
    def url(self) -> str:
        return f"amqp://{self.username}:{self.password}@{self.host}:{self.port}/"


class MagicLinkConfig(BaseModel):
    """Конфигурация magic link авторизации."""

    secret_key: str = Field(
        default=...,
        description="Magic link secret — MUST be set via MAGIC_LINK__SECRET_KEY env var",
    )
    expire_minutes: int = 15  # Ссылка действует 15 минут
    frontend_url: str = ""  # URL фронтенда для ссылок в QR-кодах и email


class YandexSpeechKitConfig(BaseModel):
    """Конфигурация Yandex SpeechKit для распознавания речи."""

    api_key: str = ""  # API-ключ сервисного аккаунта
    folder_id: str = ""  # ID каталога в Yandex Cloud
    lang: str = "ru-RU"  # Язык распознавания
    topic: str = "general"  # Языковая модель


class TelegramConfig(BaseModel):
    """Конфигурация Telegram авторизации."""

    bot_token: str = ""  # Токен Telegram бота от @BotFather
    bot_username: str = ""  # Username бота без @
    auth_timeout: int = 86400  # Время жизни auth данных (24 часа)

    @property
    def bot_id(self) -> str:
        """Получить ID бота из токена."""
        if self.bot_token:
            return self.bot_token.split(":")[0]
        return ""


class EncryptionConfig(BaseModel):
    """Конфигурация шифрования сообщений чата.

    Генерация ключа:
        python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    """

    chat_key: str = Field(
        default=...,
        description="Fernet key for chat message encryption — MUST be set via ENCRYPTION__CHAT_KEY env var",
    )


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )
    logging: LoggingConfig = LoggingConfig()
    jwt: JWTConfig
    gigachat: GigaChatConfig = GigaChatConfig()
    local_llm: LocalLLMConfig = LocalLLMConfig()
    embedding: EmbeddingConfig = EmbeddingConfig()
    cloudinary: CloudinaryConfig = CloudinaryConfig()
    email: EmailConfig = EmailConfig()
    rabbitmq: RabbitMQConfig = RabbitMQConfig()
    magic_link: MagicLinkConfig
    telegram: TelegramConfig = TelegramConfig()
    yandex_speechkit: YandexSpeechKitConfig = YandexSpeechKitConfig()
    encryption: EncryptionConfig
    mongo: DatabaseConfig
    api: APIConfig


settings = Config()
