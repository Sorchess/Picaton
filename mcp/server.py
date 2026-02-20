"""
Picaton MCP Server

Предоставляет внешним AI-агентам доступ к базе специалистов Picaton
через протокол Model Context Protocol (HTTP/SSE transport).

Инструменты:
  - search_experts      — семантический поиск специалистов
  - get_user_profile    — публичный профиль пользователя
  - get_business_card   — визитная карточка специалиста

Запуск:
  python server.py

Подключение агента:
  SSE endpoint: http://<host>:8001/sse
  Заголовок:    X-MCP-API-Key: <ключ>
"""

import logging

import uvicorn
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import Tool, TextContent
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from config import settings
from tools import search_experts, get_user_profile, get_business_card

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
)
logger = logging.getLogger("picaton.mcp")

# ---------------------------------------------------------------------------
# MCP Server definition
# ---------------------------------------------------------------------------

server = Server("picaton")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_experts",
            description=(
                "Найти специалистов на платформе Picaton по навыкам, должности или задаче. "
                "Поиск семантический — понимает синонимы и контекст. "
                "Примеры: 'Python разработчик', 'дизайнер логотипов', 'нужен маркетолог для стартапа'."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Поисковый запрос (навык, должность или описание задачи)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Максимальное кол-во результатов (1–20, по умолчанию 5)",
                        "default": 5,
                        "minimum": 1,
                        "maximum": 20,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="get_user_profile",
            description=(
                "Получить публичный профиль специалиста по его ID. "
                "user_id берётся из поля 'user_id' в результатах search_experts. "
                "Возвращает имя, навыки, bio и контакты (с учётом настроек приватности)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "UUID пользователя (из поля user_id в search_experts)",
                    },
                },
                "required": ["user_id"],
            },
        ),
        Tool(
            name="get_business_card",
            description=(
                "Получить визитную карточку специалиста по ID карточки. "
                "card_id берётся из поля 'card_id' в результатах search_experts. "
                "Визитка содержит специализацию, навыки и контакты для конкретной роли."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "card_id": {
                        "type": "string",
                        "description": "UUID визитной карточки (из поля card_id в search_experts)",
                    },
                },
                "required": ["card_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    logger.info("Tool called: %s  args=%s", name, arguments)

    if name == "search_experts":
        query = str(arguments.get("query", "")).strip()
        if not query:
            return [TextContent(type="text", text="Параметр 'query' обязателен и не может быть пустым.")]
        # Safe int conversion — agent might pass a string or float
        try:
            limit = int(arguments.get("limit", 5))
            limit = max(1, min(limit, 20))
        except (TypeError, ValueError):
            limit = 5
        return await search_experts(query, limit)

    if name == "get_user_profile":
        user_id = str(arguments.get("user_id", "")).strip()
        if not user_id:
            return [TextContent(type="text", text="Параметр 'user_id' обязателен.")]
        return await get_user_profile(user_id)

    if name == "get_business_card":
        card_id = str(arguments.get("card_id", "")).strip()
        if not card_id:
            return [TextContent(type="text", text="Параметр 'card_id' обязателен.")]
        return await get_business_card(card_id)

    return [TextContent(type="text", text=f"Неизвестный инструмент: {name}")]


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Validate X-MCP-API-Key header when MCP_API_KEYS is configured."""

    # Paths that bypass authentication (health checks, probes)
    PUBLIC_PATHS = {"/health"}

    async def dispatch(self, request: Request, call_next):
        # Always allow health checks (needed for docker healthcheck and orchestration)
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        # If no keys configured → open access (useful for local dev / internal network)
        if not settings.mcp_api_keys:
            return await call_next(request)

        key = request.headers.get("x-mcp-api-key")
        if not key or key not in settings.mcp_api_keys:
            logger.warning(
                "Rejected request: path=%s  client=%s  key_provided=%s",
                request.url.path,
                request.client,
                bool(key),
            )
            return JSONResponse(
                {"error": "Invalid or missing X-MCP-API-Key header"},
                status_code=401,
            )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Starlette app with SSE transport
# ---------------------------------------------------------------------------

sse_transport = SseServerTransport("/messages/")


async def sse_endpoint(request: Request) -> None:
    # request._send is the raw ASGI send callable — required by SseServerTransport
    async with sse_transport.connect_sse(  # noqa: SLF001
        request.scope, request.receive, request._send
    ) as streams:
        await server.run(
            streams[0],
            streams[1],
            server.create_initialization_options(),
        )


async def health_endpoint(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "server": "picaton-mcp", "backend": settings.backend_url})


app = Starlette(
    routes=[
        Route("/sse", endpoint=sse_endpoint),
        Mount("/messages", app=sse_transport.handle_post_message),
        Route("/health", endpoint=health_endpoint),
    ],
    middleware=[Middleware(APIKeyMiddleware)],
)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logger.info(
        "Starting Picaton MCP Server  host=%s  port=%s  backend=%s  api_keys=%s",
        settings.host,
        settings.port,
        settings.backend_url,
        "configured (%d keys)" % len(settings.mcp_api_keys) if settings.mcp_api_keys else "none (open access)",
    )
    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        log_level="info",
    )
