"""WebSocket handlers for real-time AI generation."""

import json
import logging
from uuid import UUID
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect, APIRouter

from application.services.local_bio import LocalBioGenerator
from application.services.local_tags import LocalTagsGenerator
from application.services.business_card import BusinessCardService
from infrastructure.database.client import mongodb_client
from infrastructure.database.repositories import (
    MongoBusinessCardRepository,
    MongoUserRepository,
)
from settings.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manage active WebSocket connections."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """Accept and register a new connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket connected: {client_id}")

    def disconnect(self, client_id: str) -> None:
        """Remove a connection."""
        self.active_connections.pop(client_id, None)
        logger.info(f"WebSocket disconnected: {client_id}")

    async def send_json(self, client_id: str, data: dict[str, Any]) -> bool:
        """Send JSON data to a specific client."""
        ws = self.active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json(data)
                return True
            except Exception as e:
                logger.error(f"Failed to send to {client_id}: {e}")
                self.disconnect(client_id)
        return False


manager = ConnectionManager()


def _get_card_service() -> BusinessCardService:
    """Get business card service instance."""
    db = mongodb_client.database
    card_repo = MongoBusinessCardRepository(db["business_cards"])
    user_repo = MongoUserRepository(db["users"])
    return BusinessCardService(card_repo, user_repo)


@router.websocket("/ws/cards/{card_id}")
async def websocket_card_ai(
    websocket: WebSocket,
    card_id: str,
    owner_id: str,
):
    """
    WebSocket endpoint for real-time AI generation.

    Supports streaming bio generation and tag suggestions.

    Protocol:
    ---------
    Client -> Server:
        {"action": "generate_bio"}
        {"action": "suggest_tags", "bio_text": "..."}
        {"action": "ping"}

    Server -> Client:
        {"type": "chunk", "content": "..."}       - Text chunk during generation
        {"type": "complete", "full_bio": "..."}   - Generation completed
        {"type": "tags_update", "tags": [...]}    - Tag suggestions
        {"type": "error", "message": "..."}       - Error occurred
        {"type": "pong"}                          - Response to ping
    """
    client_id = f"{owner_id}_{card_id}"

    # Validate UUIDs
    try:
        card_uuid = UUID(card_id)
        owner_uuid = UUID(owner_id)
    except ValueError:
        await websocket.close(code=4000, reason="Invalid UUID format")
        return

    # Check if local LLM is enabled
    if not settings.local_llm.enabled:
        await websocket.accept()
        await websocket.send_json(
            {
                "type": "error",
                "message": "Local LLM is not enabled. Streaming not available.",
            }
        )
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, client_id)

    try:
        card_service = _get_card_service()
        bio_generator = LocalBioGenerator()
        tags_generator = LocalTagsGenerator()

        while True:
            try:
                # Receive message with timeout
                data = await websocket.receive_json()
            except json.JSONDecodeError:
                await manager.send_json(
                    client_id,
                    {
                        "type": "error",
                        "message": "Invalid JSON format",
                    },
                )
                continue

            action = data.get("action")

            if action == "ping":
                await manager.send_json(client_id, {"type": "pong"})

            elif action == "generate_bio":
                await _handle_generate_bio(
                    client_id=client_id,
                    card_id=card_uuid,
                    owner_id=owner_uuid,
                    card_service=card_service,
                    bio_generator=bio_generator,
                )

            elif action == "suggest_tags":
                bio_text = data.get("bio_text", "")
                await _handle_suggest_tags(
                    client_id=client_id,
                    bio_text=bio_text,
                    tags_generator=tags_generator,
                )

            else:
                await manager.send_json(
                    client_id,
                    {
                        "type": "error",
                        "message": f"Unknown action: {action}",
                    },
                )

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        await manager.send_json(
            client_id,
            {
                "type": "error",
                "message": str(e),
            },
        )
    finally:
        manager.disconnect(client_id)


async def _handle_generate_bio(
    client_id: str,
    card_id: UUID,
    owner_id: UUID,
    card_service: BusinessCardService,
    bio_generator: LocalBioGenerator,
) -> None:
    """Handle bio generation with streaming."""
    try:
        # Get card
        card = await card_service.get_card(card_id)

        # Check ownership
        if card.owner_id != owner_id:
            await manager.send_json(
                client_id,
                {
                    "type": "error",
                    "message": "Access denied",
                },
            )
            return

        # Check if bio exists
        if not card.bio or not card.bio.strip():
            await manager.send_json(
                client_id,
                {
                    "type": "error",
                    "message": "Bio text is required",
                },
            )
            return

        # Notify start
        await manager.send_json(
            client_id,
            {
                "type": "start",
                "message": "Starting generation...",
            },
        )

        # Stream bio generation
        full_bio = ""
        async for chunk in bio_generator.stream_bio(
            bio_text=card.bio,
            name=card.display_name,
            random_facts=card.random_facts,
            tags=[tag.name for tag in card.tags] if card.tags else None,
        ):
            full_bio += chunk
            await manager.send_json(
                client_id,
                {
                    "type": "chunk",
                    "content": chunk,
                },
            )

        # Clean the result
        full_bio = full_bio.strip()
        if full_bio.startswith('"') and full_bio.endswith('"'):
            full_bio = full_bio[1:-1]

        # Save to database
        await card_service.set_ai_generated_bio(card_id, owner_id, full_bio)

        # Send completion
        await manager.send_json(
            client_id,
            {
                "type": "complete",
                "full_bio": full_bio,
            },
        )

    except Exception as e:
        logger.error(f"Bio generation error: {e}")
        await manager.send_json(
            client_id,
            {
                "type": "error",
                "message": f"Generation failed: {str(e)}",
            },
        )


async def _handle_suggest_tags(
    client_id: str,
    bio_text: str,
    tags_generator: LocalTagsGenerator,
) -> None:
    """Handle tag suggestions."""
    try:
        if not bio_text or len(bio_text.strip()) < 20:
            await manager.send_json(
                client_id,
                {
                    "type": "error",
                    "message": "Bio text must be at least 20 characters",
                },
            )
            return

        logger.info(f"Generating tags for bio: {bio_text[:100]}...")

        # Generate tags
        result = await tags_generator.generate_tags_from_bio(bio_text)

        logger.info(
            f"Generated {len(result.suggested_tags)} tags: {[t.name for t in result.suggested_tags]}"
        )

        # Send tags
        await manager.send_json(
            client_id,
            {
                "type": "tags_update",
                "tags": [
                    {
                        "name": t.name,
                        "category": t.category,
                        "confidence": t.confidence,
                        "reason": t.reason,
                    }
                    for t in result.suggested_tags
                ],
            },
        )

    except Exception as e:
        logger.error(f"Tag suggestion error: {e}")
        await manager.send_json(
            client_id,
            {
                "type": "error",
                "message": f"Tag generation failed: {str(e)}",
            },
        )
