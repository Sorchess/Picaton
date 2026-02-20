import json
import logging

import httpx
from mcp.types import TextContent

from client import call_backend

logger = logging.getLogger("picaton.mcp.tools.search")


async def search_experts(query: str, limit: int = 5) -> list[TextContent]:
    """
    Найти специалистов на платформе Picaton по навыкам, должности или задаче.

    Поиск семантический — понимает синонимы и контекст:
    - "Python разработчик с опытом в ML"
    - "дизайнер логотипов и фирменного стиля"
    - "нужен маркетолог для стартапа"
    - "frontend разработчик React"

    Возвращает список специалистов с именами, навыками и описанием.
    Используйте user_id для get_user_profile и card_id для get_business_card.
    """
    limit = max(1, min(limit, 20))
    logger.info("search_experts: query='%s' limit=%d", query, limit)

    try:
        data = await call_backend(
            "POST",
            "/api/users/search",
            json={
                "query": query,
                "limit": limit,
                "include_users": True,
                "include_contacts": False,
            },
        )
    except httpx.HTTPStatusError as e:
        logger.error("Backend search error: %s", e.response.status_code)
        return [TextContent(type="text", text=f"Ошибка поиска: {e.response.status_code}")]
    except httpx.RequestError as e:
        logger.error("Connection error during search: %s", e)
        return [TextContent(type="text", text=f"Ошибка соединения с backend: {e}")]

    results = []

    # SearchCardResult fields (backend/presentation/api/users/schemas.py):
    # id, owner_id, display_name, owner_first_name, owner_last_name,
    # avatar_url, bio, ai_generated_bio, search_tags (list[str]),
    # contacts (list[SearchCardContactInfo]), completeness
    for card in data.get("cards", []):
        name = card.get("display_name") or (
            f"{card.get('owner_first_name', '')} {card.get('owner_last_name', '')}".strip()
        )
        results.append({
            "user_id": str(card.get("owner_id", "")),
            "card_id": str(card.get("id", "")),
            "name": name,
            "avatar_url": card.get("avatar_url"),
            "skills": card.get("search_tags", []),
            "bio": card.get("bio") or card.get("ai_generated_bio"),
            "contacts": [
                {"type": c.get("type"), "value": c.get("value")}
                for c in card.get("contacts", [])
            ],
        })

    # UserPublicResponse (legacy fallback) fields:
    # id, first_name, last_name, avatar_url, bio, ai_generated_bio,
    # location, tags (list[TagInfo]), search_tags (list[str]),
    # contacts, profile_completeness
    # NOTE: position is NOT in UserPublicResponse
    for user in data.get("users", []):
        name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        results.append({
            "user_id": str(user.get("id", "")),
            "card_id": None,
            "name": name,
            "avatar_url": user.get("avatar_url"),
            # Use flat search_tags list instead of tags objects
            "skills": user.get("search_tags", []),
            "bio": user.get("bio") or user.get("ai_generated_bio"),
            "contacts": [
                {"type": c.get("type"), "value": c.get("value")}
                for c in user.get("contacts", [])
                if c.get("is_visible", True)
            ],
        })

    if not results:
        logger.info("search_experts: no results for query='%s'", query)
        return [TextContent(type="text", text=f"По запросу «{query}» специалистов не найдено.")]

    output = {
        "query": query,
        "expanded_tags": data.get("expanded_tags", []),
        "total": data.get("total_count", len(results)),
        "experts": results,
    }

    logger.info("search_experts: found %d experts for query='%s'", len(results), query)
    return [TextContent(type="text", text=json.dumps(output, ensure_ascii=False, indent=2))]
