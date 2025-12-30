from attr import dataclass


@dataclass
class EmailMessage:
    """Структура email сообщения."""

    to: str | list[str]
    subject: str
    body_html: str
    body_text: str | None = None