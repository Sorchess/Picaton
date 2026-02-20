import httpx

from config import settings


async def call_backend(method: str, path: str, **kwargs) -> dict:
    """Make an async HTTP request to the Picaton backend API."""
    url = f"{settings.backend_url}{path}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
