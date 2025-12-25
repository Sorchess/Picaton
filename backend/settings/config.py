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
    mongo: DatabaseConfig
    api: APIConfig


settings = Config()
