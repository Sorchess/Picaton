"""
Telegram Bot для авторизации и синхронизации контактов в Picaton.

Обрабатывает:
- /start auth_TOKEN - авторизация
- /start sync_TOKEN - синхронизация контактов
- Пересланные контакты - добавление в сессию синхронизации
"""

import asyncio
import logging
import os
import re
import httpx
from settings.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Regex для извлечения токенов
AUTH_TOKEN_PATTERN = re.compile(r"^auth_([a-zA-Z0-9_-]+)$")
SYNC_TOKEN_PATTERN = re.compile(r"^sync_([a-zA-Z0-9_-]+)$")

# Хранилище активных сессий синхронизации (chat_id -> sync_token)
_active_sync_sessions: dict[int, str] = {}
# Собранные контакты для каждой сессии (chat_id -> list of contacts)
_collected_contacts: dict[int, list[dict]] = {}


def get_api_base_url() -> str:
    """Получить базовый URL API."""
    if os.getenv("RUNNING_IN_DOCKER"):
        return "http://main-app:8000/api"
    return f"http://localhost:{settings.api.port}/api"


async def get_bot_updates(offset: int = 0) -> dict:
    """Получить обновления от Telegram Bot API."""
    bot_token = settings.telegram.bot_token
    if not bot_token:
        raise ValueError("TELEGRAM__BOT_TOKEN not configured")

    url = f"https://api.telegram.org/bot{bot_token}/getUpdates"
    params = {"offset": offset, "timeout": 30}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=35)
        response.raise_for_status()
        return response.json()


async def send_message(
    chat_id: int,
    text: str,
    parse_mode: str = "HTML",
    reply_markup: dict | None = None,
) -> dict:
    """Отправить сообщение пользователю."""
    bot_token = settings.telegram.bot_token
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        return response.json()


async def confirm_auth(token: str, user: dict) -> bool:
    """Подтвердить авторизацию на бэкенде."""
    api_url = f"{get_api_base_url()}/auth/telegram/bot/confirm"

    # Получаем фото профиля
    photo_url = await get_user_photo(user["id"])

    payload = {
        "token": token,
        "telegram_id": user["id"],
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name"),
        "username": user.get("username"),
        "photo_url": photo_url,
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(api_url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to confirm auth: {e}")
            return False


async def send_contacts_to_backend(token: str, contacts: list[dict]) -> bool:
    """Отправить контакты на бэкенд."""
    api_url = f"{get_api_base_url()}/auth/telegram/bot/sync-contacts"

    payload = {
        "token": token,
        "contacts": contacts,
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(api_url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to send contacts: {e}")
            return False


async def complete_sync_on_backend(token: str) -> bool:
    """Завершить синхронизацию на бэкенде."""
    api_url = f"{get_api_base_url()}/auth/telegram/bot/sync-complete"

    payload = {"token": token}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(api_url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to complete sync: {e}")
            return False


async def get_user_photo(user_id: int) -> str | None:
    """Получить URL фото профиля пользователя."""
    bot_token = settings.telegram.bot_token
    url = f"https://api.telegram.org/bot{bot_token}/getUserProfilePhotos"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params={"user_id": user_id, "limit": 1})
            data = response.json()

            if data.get("ok") and data["result"]["total_count"] > 0:
                # Получаем file_id самой большой фотки
                photos = data["result"]["photos"][0]
                file_id = photos[-1]["file_id"]  # Последняя = самая большая

                # Получаем путь к файлу
                file_url = f"https://api.telegram.org/bot{bot_token}/getFile"
                file_response = await client.get(file_url, params={"file_id": file_id})
                file_data = file_response.json()

                if file_data.get("ok"):
                    file_path = file_data["result"]["file_path"]
                    return f"https://api.telegram.org/file/bot{bot_token}/{file_path}"

        except Exception as e:
            logger.error(f"Failed to get user photo: {e}")

    return None


async def handle_message(message: dict) -> None:
    """Обработать входящее сообщение."""
    text = message.get("text", "")
    user = message.get("from", {})
    chat_id = message["chat"]["id"]
    contact = message.get("contact")

    # Обработка пересланного контакта
    if contact:
        await handle_contact(chat_id, contact)
        return

    # Проверяем /start команду
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)

        if len(parts) == 2:
            param = parts[1]

            # Авторизация
            auth_match = AUTH_TOKEN_PATTERN.match(param)
            if auth_match:
                token = auth_match.group(1)
                logger.info(f"Auth request from {user.get('username', user['id'])}")

                success = await confirm_auth(token, user)

                if success:
                    await send_message(
                        chat_id,
                        "✅ <b>Авторизация успешна!</b>\n\n"
                        "Вы можете вернуться в приложение — вход выполнен автоматически.",
                    )
                else:
                    await send_message(
                        chat_id,
                        "❌ <b>Ссылка устарела</b>\n\n"
                        "Попробуйте авторизоваться снова в приложении.",
                    )
                return

            # Синхронизация контактов
            sync_match = SYNC_TOKEN_PATTERN.match(param)
            if sync_match:
                token = sync_match.group(1)
                logger.info(f"Sync request from {user.get('username', user['id'])}")

                # Сохраняем сессию
                _active_sync_sessions[chat_id] = token
                _collected_contacts[chat_id] = []

                # Показываем инструкцию с кнопкой "Готово"
                await send_message(
                    chat_id,
                    "📱 <b>Синхронизация контактов</b>\n\n"
                    "Перешлите мне контакты, которые хотите найти в Picaton.\n\n"
                    "Как переслать контакт:\n"
                    "1. Откройте чат с нужным человеком\n"
                    "2. Нажмите на его имя вверху\n"
                    "3. Выберите «Отправить контакт»\n"
                    "4. Отправьте его сюда\n\n"
                    "Когда закончите — нажмите /done",
                )
                return

        # Обычный /start
        await send_message(
            chat_id,
            f"👋 Привет, <b>{user.get('first_name', 'друг')}</b>!\n\n"
            "Я бот <b>Picaton</b> — помогаю с авторизацией и синхронизацией контактов.\n\n"
            "Чтобы войти или синхронизировать контакты, используйте кнопки в приложении.",
        )
        return

    # Команда /done - завершить синхронизацию
    if text == "/done":
        await handle_done(chat_id)
        return

    # Если есть активная сессия синхронизации, напоминаем о формате
    if chat_id in _active_sync_sessions:
        count = len(_collected_contacts.get(chat_id, []))
        await send_message(
            chat_id,
            f"📎 Пересылайте контакты, а не текст.\n\n"
            f"Собрано контактов: {count}\n\n"
            "Когда закончите — нажмите /done",
        )


async def handle_contact(chat_id: int, contact: dict) -> None:
    """Обработать пересланный контакт."""
    if chat_id not in _active_sync_sessions:
        await send_message(
            chat_id,
            "ℹ️ Чтобы синхронизировать контакты, начните с приложения Picaton.",
        )
        return

    # Извлекаем данные контакта
    contact_data = {
        "telegram_id": contact.get("user_id", 0),
        "first_name": contact.get("first_name", ""),
        "last_name": contact.get("last_name"),
        "phone": contact.get("phone_number"),
        "username": None,  # Контакт не содержит username
    }

    # Добавляем в список
    if chat_id not in _collected_contacts:
        _collected_contacts[chat_id] = []

    _collected_contacts[chat_id].append(contact_data)

    count = len(_collected_contacts[chat_id])
    name = f"{contact_data['first_name']} {contact_data.get('last_name') or ''}".strip()

    await send_message(
        chat_id,
        f"✅ Контакт <b>{name}</b> добавлен\n\n"
        f"Всего собрано: {count}\n\n"
        "Продолжайте пересылать или нажмите /done",
    )


async def handle_done(chat_id: int) -> None:
    """Завершить синхронизацию контактов."""
    if chat_id not in _active_sync_sessions:
        await send_message(
            chat_id,
            "ℹ️ Нет активной сессии синхронизации.\n" "Начните с приложения Picaton.",
        )
        return

    token = _active_sync_sessions[chat_id]
    contacts = _collected_contacts.get(chat_id, [])

    if not contacts:
        await send_message(
            chat_id,
            "❌ Вы не переслали ни одного контакта.\n\n"
            "Перешлите контакты и нажмите /done снова.",
        )
        return

    # Отправляем контакты на бэкенд
    await send_message(chat_id, "⏳ Ищем ваших знакомых в Picaton...")

    success = await send_contacts_to_backend(token, contacts)
    if not success:
        await send_message(
            chat_id,
            "❌ Сессия истекла. Попробуйте начать синхронизацию заново в приложении.",
        )
        # Очищаем
        _active_sync_sessions.pop(chat_id, None)
        _collected_contacts.pop(chat_id, None)
        return

    # Завершаем синхронизацию
    success = await complete_sync_on_backend(token)

    if success:
        await send_message(
            chat_id,
            f"✅ <b>Синхронизация завершена!</b>\n\n"
            f"Отправлено контактов: {len(contacts)}\n\n"
            "Вернитесь в приложение — результаты уже там.",
        )
    else:
        await send_message(
            chat_id,
            "❌ Не удалось завершить синхронизацию. Попробуйте ещё раз.",
        )

    # Очищаем
    _active_sync_sessions.pop(chat_id, None)
    _collected_contacts.pop(chat_id, None)


async def run_bot() -> None:
    """Запустить бота в режиме long polling."""
    logger.info("Starting Telegram bot...")

    if not settings.telegram.bot_token:
        logger.error("TELEGRAM__BOT_TOKEN not configured!")
        return

    offset = 0

    while True:
        try:
            data = await get_bot_updates(offset)

            if data.get("ok"):
                for update in data.get("result", []):
                    offset = update["update_id"] + 1

                    if "message" in update:
                        await handle_message(update["message"])

        except httpx.TimeoutException:
            # Нормальное поведение для long polling
            continue
        except Exception as e:
            logger.error(f"Bot error: {e}")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run_bot())
