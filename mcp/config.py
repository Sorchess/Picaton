import os


class Settings:
    def __init__(self) -> None:
        # Default to localhost for local dev; docker-compose overrides to http://main-app:8000
        self.backend_url: str = os.getenv("BACKEND_URL", "http://localhost:8000")
        self.host: str = os.getenv("MCP_HOST", "0.0.0.0")
        self.port: int = int(os.getenv("MCP_PORT", "8001"))

        raw_keys = os.getenv("MCP_API_KEYS", "")
        self.mcp_api_keys: set[str] = {k.strip() for k in raw_keys.split(",") if k.strip()}


settings = Settings()
