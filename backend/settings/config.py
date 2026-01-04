import logging
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


LOG_DEFAULT_FORMAT = "[%(asctime)s.%(msecs)03d] %(levelname)-3s - %(message)s"


class LoggingConfig(BaseSettings):
    log_level: Literal["debug", "info", "warning", "error", "critical"] = "info"
    log_format: str = LOG_DEFAULT_FORMAT
    date_format: str = "%Y-%m-%d %H:%M:%S"

    @property
    def log_level_value(self) -> int:
        return logging.getLevelNamesMapping()[self.log_level.upper()]


class DatabaseConfig(BaseSettings):
    host: str
    port: str
    username: str
    password: str
    name: str

    @property
    def url(self) -> str:
        return f"mongodb://{self.username}:{self.password}@{self.host}:{self.port}/"


class APIConfig(BaseSettings):
    url: str
    port: str


class JWTConfig(BaseSettings):
    secret_key: str = "super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days


class GroqConfig(BaseSettings):
    """Конфигурация Groq LLM API."""

    api_key: str = ""
    model: str = "llama-3.3-70b-versatile"
    max_tokens: int = 500
    temperature: float = 0.7


class CloudinaryConfig(BaseSettings):
    """Конфигурация Cloudinary для хранения изображений."""

    cloud_name: str = ""
    api_key: str = ""
    api_secret: str = ""
    folder: str = "picaton/avatars"
    max_file_size: int = 5 * 1024 * 1024  # 5MB
    allowed_formats: list[str] = ["jpg", "jpeg", "png", "webp"]


class EmailConfig(BaseSettings):
    """Конфигурация отправки email."""

    smtp_host: str = "localhost"  # Локальный Postfix на сервере
    smtp_port: int = 25  # Локальный порт без TLS
    smtp_user: str = ""  # Не нужен для локального Postfix
    smtp_password: str = ""  # Не нужен для локального Postfix
    from_email: str = "info@picaton.com"
    from_name: str = "Picaton"
    use_tls: bool = False  # Для локального Postfix TLS не нужен
    enabled: bool = False


class RabbitMQConfig(BaseSettings):
    """Конфигурация RabbitMQ."""

    host: str = "rabbitmq"
    port: int = 5672
    username: str = "guest"
    password: str = "guest"

    @property
    def url(self) -> str:
        return f"amqp://{self.username}:{self.password}@{self.host}:{self.port}/"


class MagicLinkConfig(BaseSettings):
    """Конфигурация magic link авторизации."""

    secret_key: str = "magic-link-secret-change-in-production"
    expire_minutes: int = 15  # Ссылка действует 15 минут
    frontend_url: str = ""  # URL фронтенда для ссылок в QR-кодах и email


class TelegramConfig(BaseSettings):
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


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )
    logging: LoggingConfig = LoggingConfig()
    jwt: JWTConfig = JWTConfig()
    groq: GroqConfig = GroqConfig()
    cloudinary: CloudinaryConfig = CloudinaryConfig()
    email: EmailConfig = EmailConfig()
    rabbitmq: RabbitMQConfig = RabbitMQConfig()
    magic_link: MagicLinkConfig = MagicLinkConfig()
    telegram: TelegramConfig = TelegramConfig()
    mongo: DatabaseConfig
    api: APIConfig


settings = Config()
