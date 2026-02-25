"""Скрипт миграции: шифрование существующих сообщений в MongoDB.

Шифрует все незашифрованные сообщения (без префикса 'enc:') в коллекциях:
- chat_messages (проектные чаты)
- direct_messages (личные сообщения)
- conversations (превью последнего сообщения)

Запуск:
    cd backend
    python -m infrastructure.database.migrations.encrypt_messages

Скрипт идемпотентный — повторный запуск безопасен, уже зашифрованные
данные (с префиксом 'enc:') будут пропущены.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Добавляем корневую директорию backend в path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from motor.motor_asyncio import AsyncIOMotorClient

from settings.config import settings
from infrastructure.encryption import get_message_encryption, ENCRYPTED_PREFIX


logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def encrypt_collection_field(
    client: AsyncIOMotorClient,
    db_name: str,
    collection_name: str,
    field_name: str,
) -> int:
    """Зашифровать указанное поле во всех документах коллекции.

    Пропускает документы, где поле уже зашифровано (начинается с 'enc:'),
    пустое или None.

    Returns:
        Количество обновлённых документов.
    """
    encryption = get_message_encryption()
    db = client[db_name]
    collection = db[collection_name]

    # Находим документы с незашифрованным контентом:
    # - поле существует и не пустое
    # - не начинается с 'enc:' (уже зашифрованные)
    query = {
        field_name: {
            "$exists": True,
            "$ne": None,
            "$ne": "",
            "$not": {"$regex": f"^{ENCRYPTED_PREFIX}"},
        },
    }

    total = await collection.count_documents(query)
    if total == 0:
        logger.info(f"  {collection_name}.{field_name}: нет данных для шифрования")
        return 0

    logger.info(
        f"  {collection_name}.{field_name}: найдено {total} записей для шифрования"
    )

    updated = 0
    cursor = collection.find(query, {"_id": 1, field_name: 1})

    async for doc in cursor:
        plaintext = doc.get(field_name)
        if not plaintext or plaintext.startswith(ENCRYPTED_PREFIX):
            continue

        encrypted = encryption.encrypt(plaintext)
        await collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {field_name: encrypted}},
        )
        updated += 1

        if updated % 500 == 0:
            logger.info(f"    ... обработано {updated}/{total}")

    logger.info(f"  {collection_name}.{field_name}: зашифровано {updated} записей")
    return updated


async def main():
    logger.info("=" * 60)
    logger.info("Миграция: шифрование существующих сообщений")
    logger.info("=" * 60)

    encryption = get_message_encryption()
    logger.info("Ключ шифрования загружен успешно")

    # Проверяем работоспособность шифрования
    test_text = "test encryption check"
    encrypted = encryption.encrypt(test_text)
    decrypted = encryption.decrypt(encrypted)
    assert (
        decrypted == test_text
    ), "Ошибка: шифрование/дешифрование не работает корректно!"
    logger.info("Тест шифрования пройден")

    client = AsyncIOMotorClient(
        settings.mongo.url,
        maxPoolSize=10,
        serverSelectionTimeoutMS=5000,
    )

    try:
        await client.admin.command("ping")
        logger.info(f"Подключение к MongoDB: OK")
    except Exception as e:
        logger.error(f"Не удалось подключиться к MongoDB: {e}")
        return

    db_name = settings.mongo.name
    total_updated = 0

    logger.info("\n1. Шифрование сообщений проектных чатов...")
    total_updated += await encrypt_collection_field(
        client, db_name, "chat_messages", "content"
    )

    logger.info("\n2. Шифрование прямых сообщений...")
    total_updated += await encrypt_collection_field(
        client, db_name, "direct_messages", "content"
    )

    logger.info("\n3. Шифрование превью последних сообщений в диалогах...")
    total_updated += await encrypt_collection_field(
        client, db_name, "conversations", "last_message_content"
    )

    logger.info("\n" + "=" * 60)
    logger.info(f"Миграция завершена. Всего зашифровано записей: {total_updated}")
    logger.info("=" * 60)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
