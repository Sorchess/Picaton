import logging
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate

from email.message import EmailMessage

logger = logging.getLogger(__name__)


class SmtpEmailBackend:
    """Сервис отправки email через SMTP."""

    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
        from_name: str = "Picaton",
        use_tls: bool = True,
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_email = from_email
        self.from_name = from_name
        self.use_tls = use_tls

    def _generate_message_id(self) -> str:
        """Генерирует уникальный Message-ID для email."""
        domain = (
            self.from_email.split("@")[-1] if "@" in self.from_email else "picaton.com"
        )
        return f"<{uuid.uuid4()}@{domain}>"

    def _create_message(self, email: EmailMessage) -> MIMEMultipart:
        """Создаёт MIME сообщение."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = email.subject
        msg["From"] = f"{self.from_name} <{self.from_email}>"

        if isinstance(email.to, list):
            msg["To"] = ", ".join(email.to)
        else:
            msg["To"] = email.to

        msg["Message-ID"] = self._generate_message_id()
        msg["Date"] = formatdate(localtime=True)

        # Текстовая версия (fallback)
        if email.body_text:
            msg.attach(MIMEText(email.body_text, "plain", "utf-8"))

        # HTML версия
        msg.attach(MIMEText(email.body_html, "html", "utf-8"))

        return msg

    async def send(self, email: EmailMessage) -> bool:
        """
        Отправляет email.

        Returns:
            True если успешно, False при ошибке.
        """
        try:
            msg = self._create_message(email)
            recipients = email.to if isinstance(email.to, list) else [email.to]

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                # Авторизация только если указаны credentials
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, recipients, msg.as_string())

            logger.info(f"Email sent successfully to {recipients}")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
