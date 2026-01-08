from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from infrastructure.database.client import mongodb_client
from infrastructure.broker import broker
from presentation.api.users.handlers import router as user_router
from presentation.api.auth.handlers import router as auth_router
from presentation.api.cards.handlers import router as cards_router
from presentation.api.cards.websocket import router as cards_ws_router
from presentation.api.companies.handlers import router as companies_router
from presentation.api.endorsements.handlers import router as endorsements_router

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://d.picaton.com",
    "https://d.picaton.com",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения."""
    # Startup
    await mongodb_client.connect()

    # Запуск брокера TaskIQ
    if not broker.is_worker_process:
        await broker.startup()

    yield

    # Shutdown
    if not broker.is_worker_process:
        await broker.shutdown()
    await mongodb_client.disconnect()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Nexus API",
        description="Сервис поиска экспертов через ассоциативный поиск",
        version="1.0.0",
        docs_url="/api/docs",
        debug=True,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Подключение роутеров
    app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
    app.include_router(user_router, prefix="/api/users", tags=["Users"])
    app.include_router(cards_router, prefix="/api/cards", tags=["Business Cards"])
    app.include_router(cards_ws_router, prefix="/api", tags=["WebSocket"])
    app.include_router(companies_router, prefix="/api/companies", tags=["Companies"])
    app.include_router(
        endorsements_router, prefix="/api/endorsements", tags=["Skill Endorsements"]
    )

    return app


app = create_app()
