import json
import logging
from uuid import UUID

import httpx
from mcp.types import TextContent

from client import call_backend

logger = logging.getLogger("picaton.mcp.tools.profiles")


async def get_user_profile(user_id: str) -> list[TextContent]:
    """
    Получить публичный профиль специалиста по его ID.

    ID можно получить из результатов поиска (поле user_id в search_experts).
    Возвращает имя, навыки, краткое описание и контакты (с учётом настроек приватности).
    """
    # Validate UUID format before sending to backend
    try:
        UUID(user_id)
    except (ValueError, AttributeError):
        return [TextContent(type="text", text=f"Некорректный формат user_id: '{user_id}'. Ожидается UUID.")]

    logger.info("get_user_profile: user_id=%s", user_id)

    try:
        data = await call_backend("GET", f"/api/users/{user_id}")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return [TextContent(type="text", text=f"Пользователь {user_id} не найден.")]
        if e.response.status_code == 403:
            return [TextContent(type="text", text="Профиль скрыт настройками приватности.")]
        logger.error("Backend error for user %s: %s", user_id, e.response.status_code)
        return [TextContent(type="text", text=f"Ошибка backend: {e.response.status_code}")]
    except httpx.RequestError as e:
        logger.error("Connection error: %s", e)
        return [TextContent(type="text", text=f"Ошибка соединения с backend: {e}")]

    # UserPublicResponse fields (from backend/presentation/api/users/schemas.py):
    # id, first_name, last_name, avatar_url, bio, ai_generated_bio,
    # location, tags (list[TagInfo]), search_tags (list[str]),
    # contacts (list[ContactInfo]), profile_completeness
    # NOTE: position, status, username are NOT in UserPublicResponse

    contacts = [
        {"type": c.get("type"), "value": c.get("value")}
        for c in data.get("contacts", [])
        if c.get("is_visible", True)
    ]

    # Use search_tags (flat list of strings) for cleaner agent output
    skills = data.get("search_tags", [])
    if not skills:
        # Fallback to tags objects if search_tags is empty
        skills = [t.get("name") for t in data.get("tags", []) if t.get("name")]

    profile = {
        "user_id": str(data.get("id", "")),
        "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
        "avatar_url": data.get("avatar_url"),
        "bio": data.get("bio") or data.get("ai_generated_bio"),
        "location": data.get("location"),
        "skills": skills,
        "contacts": contacts,
        # CORRECT field name in UserPublicResponse is "profile_completeness"
        "profile_completeness": data.get("profile_completeness", 0),
    }

    logger.info("get_user_profile: found user '%s'", profile["name"])
    return [TextContent(type="text", text=json.dumps(profile, ensure_ascii=False, indent=2))]
