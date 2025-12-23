FROM python:3.13.9-slim

# Установка системных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Установка Poetry
ENV POETRY_VERSION=2.2.1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1 \
    PYTHONPATH="/"

RUN pip install --no-cache-dir "poetry==$POETRY_VERSION"

WORKDIR /backend
COPY pyproject.toml ./
# Генерируем lock-файл если его нет
COPY poetry.lock* ./
RUN poetry lock --no-update || true

# Установка Python-зависимостей
RUN poetry install --no-interaction --no-ansi

COPY . .