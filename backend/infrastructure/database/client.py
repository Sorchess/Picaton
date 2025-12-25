import logging
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase,
    AsyncIOMotorCollection,
)

from settings.config import settings


logger = logging.getLogger(__name__)


class MongoDBClient:
    """
    Клиент для работы с MongoDB.
    Реализует паттерн Singleton для переиспользования соединения.
    """

    _instance: "MongoDBClient | None" = None
    _client: AsyncIOMotorClient | None = None
    _database: AsyncIOMotorDatabase | None = None

    def __init__(self, url: str, db_name: str) -> None:
        self.url = url
        self.db_name = db_name

    async def connect(self) -> None:
        """Установить соединение с MongoDB."""
        if self._client is None:
            logger.info("Connecting to MongoDB...")
            self._client = AsyncIOMotorClient(
                host=self.url,
                maxPoolSize=50,
                minPoolSize=10,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
            )
            self._database = self._client[self.db_name]

    async def disconnect(self) -> None:
        """Закрыть соединение с MongoDB."""
        if self._client is not None:
            self._client.close()
            self._client = None
            self._database = None

    @property
    def client(self) -> AsyncIOMotorClient:
        """Получить клиент MongoDB."""
        if self._client is None:
            raise RuntimeError("MongoDB client is not connected. Call connect() first.")
        return self._client

    @property
    def database(self) -> AsyncIOMotorDatabase:
        """Получить базу данных."""
        if self._database is None:
            raise RuntimeError(
                "MongoDB database is not available. Call connect() first."
            )
        return self._database

    def get_collection(self, name: str) -> AsyncIOMotorCollection:
        """Получить коллекцию по имени."""
        return self._database[name]

    async def ping(self) -> bool:
        """Проверить соединение с MongoDB."""
        try:
            await self._client.admin.command("ping")
            return True
        except Exception:
            return False


mongodb_client = MongoDBClient(
    url=settings.mongo.url,
    db_name=settings.mongo.name,
)
