FROM python:3.12-slim

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Poetry
RUN pip install --no-cache-dir poetry==1.8.3

# Copy dependency files first (layer caching — reinstall only when deps change)
COPY pyproject.toml poetry.lock* ./

# Install runtime dependencies only (no dev tools, no virtualenv overhead)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main

# Copy source code
COPY . .

EXPOSE 8001

# Docker-level health check (independent of compose healthcheck)
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:8001/health || exit 1

CMD ["python", "server.py"]
