"""Настройка брокера сообщений TaskIQ с RabbitMQ."""

from taskiq_aio_pika import AioPikaBroker

from settings.config import settings


# Брокер сообщений для асинхронных задач
broker = AioPikaBroker(
    url=settings.rabbitmq.url,
    queue_name="picaton_tasks",
)
