"""Сервис генерации названий для визитных карточек."""

import logging

from infrastructure.llm.groq_client import GroqClient, GroqError

logger = logging.getLogger(__name__)


class CardTitleGenerator:
    """
    Генератор названий для визитных карточек.

    Использует AI для создания осмысленных названий
    на основе информации о пользователе.
    """

    SYSTEM_PROMPT = """Ты помощник для создания коротких названий визитных карточек.
Твоя задача - предложить короткое и понятное название для визитной карточки человека.

Правила:
1. Название должно быть на русском языке
2. Максимум 2-3 слова
3. Отражать профессию или сферу деятельности
4. Если информации недостаточно - используй "Основная карточка"

Примеры хороших названий:
- "Основная" (для первой карточки)
- "Дизайнер"
- "ML инженер"
- "Бизнес-аналитик"
- "Стартапер"
- "Консультант"

Отвечай ТОЛЬКО названием, без кавычек и пояснений."""

    def __init__(self):
        self._client = GroqClient()

    async def generate_title(
        self,
        first_name: str,
        last_name: str,
        bio: str | None = None,
        location: str | None = None,
    ) -> str:
        """
        Сгенерировать название для визитной карточки.

        Args:
            first_name: Имя пользователя
            last_name: Фамилия пользователя
            bio: Описание/биография
            location: Локация

        Returns:
            Название карточки
        """
        # Если нет bio - возвращаем стандартное название
        if not bio or not bio.strip():
            return "Основная"

        # Формируем запрос
        user_info = f"Имя: {first_name} {last_name}"
        if bio:
            user_info += f"\nО себе: {bio}"
        if location:
            user_info += f"\nЛокация: {location}"

        user_prompt = f"""Придумай короткое название для визитной карточки этого человека:

{user_info}

Название:"""

        try:
            if not self._client.is_configured:
                logger.warning("Groq API not configured, using default title")
                return "Основная"

            response = await self._client.complete(
                system_prompt=self.SYSTEM_PROMPT,
                user_prompt=user_prompt,
                max_tokens=20,
                temperature=0.7,
            )

            title = response.content.strip().strip("\"'")

            # Валидация - если слишком длинное или пустое, используем дефолт
            if not title or len(title) > 50:
                return "Основная"

            logger.info(f"Generated card title: {title}")
            return title

        except GroqError as e:
            logger.error(f"Failed to generate card title: {e}")
            return "Основная"
        except Exception as e:
            logger.error(f"Unexpected error generating card title: {e}")
            return "Основная"
