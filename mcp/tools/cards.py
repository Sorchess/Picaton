import json
import logging
from uuid import UUID

import httpx
from mcp.types import TextContent

from client import call_backend

logger = logging.getLogger("picaton.mcp.tools.cards")


async def get_business_card(card_id: str) -> list[TextContent]:
    """
    Получить визитную карточку специалиста по ID карточки.

    card_id берётся из результатов поиска (search_experts).
    Визитка содержит специализацию, навыки и контакты для конкретной роли специалиста.
    """
    # Validate UUID format before sending to backend
    try:
        UUID(card_id)
    except (ValueError, AttributeError):
        return [TextContent(type="text", text=f"Некорректный формат card_id: '{card_id}'. Ожидается UUID.")]

    logger.info("get_business_card: card_id=%s", card_id)

    try:
        data = await call_backend("GET", f"/api/cards/{card_id}")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return [TextContent(type="text", text=f"Карточка {card_id} не найдена.")]
        logger.error("Backend error for card %s: %s", card_id, e.response.status_code)
        return [TextContent(type="text", text=f"Ошибка backend: {e.response.status_code}")]
    except httpx.RequestError as e:
        logger.error("Connection error: %s", e)
        return [TextContent(type="text", text=f"Ошибка соединения с backend: {e}")]

    # BusinessCardPublicResponse fields (from backend/presentation/api/cards/schemas.py):
    # id, owner_id, title, display_name, avatar_url, bio, ai_generated_bio,
    # tags (list[CardTagInfo]), search_tags (list[str]),
    # contacts (list[CardContactInfo]), completeness, emojis
    # NOTE: is_primary is NOT in BusinessCardPublicResponse (only in BusinessCardResponse)

    contacts = [
        {"type": c.get("type"), "value": c.get("value")}
        for c in data.get("contacts", [])
        if c.get("is_visible", True)
    ]

    # Use search_tags (flat list of strings) for cleaner agent output
    skills = data.get("search_tags", [])
    if not skills:
        skills = [t.get("name") for t in data.get("tags", []) if t.get("name")]

    card = {
        "card_id": str(data.get("id", "")),
        "user_id": str(data.get("owner_id", "")),
        "title": data.get("title"),
        "display_name": data.get("display_name"),
        "avatar_url": data.get("avatar_url"),
        "bio": data.get("bio") or data.get("ai_generated_bio"),
        "skills": skills,
        "contacts": contacts,
        # CORRECT field name in BusinessCardPublicResponse is "completeness"
        "completeness": data.get("completeness", 0),
    }

    logger.info("get_business_card: found card '%s' for user %s", card["title"], card["user_id"])
    return [TextContent(type="text", text=json.dumps(card, ensure_ascii=False, indent=2))]
