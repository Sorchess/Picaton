"""Фоновые задачи для отправки email."""

import logging
import smtplib
import uuid
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate

from settings.config import settings


def _generate_message_id() -> str:
    """Генерирует уникальный Message-ID для email."""
    domain = (
        settings.email.from_email.split("@")[-1]
        if "@" in settings.email.from_email
        else "picaton.com"
    )
    return f"<{uuid.uuid4()}@{domain}>"


# Импорт брокера в конце модуля после определения функций
# чтобы избежать circular import


logger = logging.getLogger(__name__)


def _get_magic_link_email_html(magic_link: str, expire_minutes: int = 15) -> str:
    """
    Генерирует HTML шаблон письма для magic link в стиле Picaton.

    Тёмная тема, минималистичный дизайн, glass-эффекты.
    """
    return f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вход в Picaton</title>
</head>
<body style="
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #1a1a1a 100%);
    min-height: 100vh;
">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #1a1a1a 100%);">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto;">
                    
                    <!-- Logo -->
                    <tr>
                        <td style="text-align: center; padding-bottom: 32px;">
                            <div style="
                                display: inline-block;
                                font-size: 32px;
                                font-weight: 700;
                                color: #ffffff;
                                letter-spacing: -1px;
                            ">
                                <span style="
                                    background: linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%);
                                    -webkit-background-clip: text;
                                    -webkit-text-fill-color: transparent;
                                    background-clip: text;
                                ">Picaton</span>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Main Card -->
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="
                                background: rgba(255, 255, 255, 0.03);
                                border: 1px solid rgba(255, 255, 255, 0.08);
                                border-radius: 20px;
                                overflow: hidden;
                            ">
                                <!-- Card Header -->
                                <tr>
                                    <td style="
                                        padding: 40px 40px 24px;
                                        text-align: center;
                                    ">
                                        <!-- Icon -->
                                        <div style="
                                            width: 64px;
                                            height: 64px;
                                            margin: 0 auto 24px;
                                            background: rgba(255, 255, 255, 0.05);
                                            border: 1px solid rgba(255, 255, 255, 0.1);
                                            border-radius: 16px;
                                            line-height: 64px;
                                            font-size: 28px;
                                        ">
                                            ✨
                                        </div>
                                        
                                        <h1 style="
                                            margin: 0 0 12px;
                                            font-size: 24px;
                                            font-weight: 600;
                                            color: #ffffff;
                                            letter-spacing: -0.5px;
                                        ">
                                            Вход в аккаунт
                                        </h1>
                                        
                                        <p style="
                                            margin: 0;
                                            font-size: 15px;
                                            color: #a0a0a0;
                                            line-height: 1.5;
                                        ">
                                            Нажмите на кнопку ниже, чтобы войти в свой профиль Picaton
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Button -->
                                <tr>
                                    <td style="padding: 8px 40px 32px; text-align: center;">
                                        <a href="{magic_link}" style="
                                            display: inline-block;
                                            padding: 16px 48px;
                                            background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
                                            color: #0a0a0a;
                                            text-decoration: none;
                                            font-size: 15px;
                                            font-weight: 600;
                                            border-radius: 12px;
                                            letter-spacing: -0.3px;
                                            transition: all 0.2s;
                                        ">
                                            Войти в Picaton
                                        </a>
                                    </td>
                                </tr>
                                
                                <!-- Divider -->
                                <tr>
                                    <td style="padding: 0 40px;">
                                        <div style="
                                            height: 1px;
                                            background: rgba(255, 255, 255, 0.08);
                                        "></div>
                                    </td>
                                </tr>
                                
                                <!-- Timer Info -->
                                <tr>
                                    <td style="
                                        padding: 24px 40px;
                                        text-align: center;
                                    ">
                                        <div style="
                                            display: inline-block;
                                            padding: 12px 20px;
                                            background: rgba(255, 255, 255, 0.03);
                                            border: 1px solid rgba(255, 255, 255, 0.06);
                                            border-radius: 10px;
                                        ">
                                            <span style="
                                                font-size: 13px;
                                                color: #666666;
                                            ">
                                                ⏱ Ссылка действительна <strong style="color: #a0a0a0;">{expire_minutes} минут</strong>
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Alternative Link -->
                                <tr>
                                    <td style="
                                        padding: 0 40px 32px;
                                        text-align: center;
                                    ">
                                        <p style="
                                            margin: 0 0 12px;
                                            font-size: 12px;
                                            color: #666666;
                                        ">
                                            Если кнопка не работает, скопируйте ссылку:
                                        </p>
                                        <p style="
                                            margin: 0;
                                            padding: 12px 16px;
                                            background: rgba(0, 0, 0, 0.3);
                                            border: 1px solid rgba(255, 255, 255, 0.05);
                                            border-radius: 8px;
                                            font-size: 11px;
                                            color: #a0a0a0;
                                            word-break: break-all;
                                            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
                                        ">
                                            {magic_link}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="
                            padding: 32px 20px;
                            text-align: center;
                        ">
                            <p style="
                                margin: 0 0 8px;
                                font-size: 12px;
                                color: #666666;
                            ">
                                Вы получили это письмо, потому что запросили вход в Picaton
                            </p>
                            <p style="
                                margin: 0;
                                font-size: 12px;
                                color: #4a4a4a;
                            ">
                                Если вы не запрашивали вход — просто проигнорируйте это письмо
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Copyright -->
                    <tr>
                        <td style="
                            padding: 20px;
                            text-align: center;
                            border-top: 1px solid rgba(255, 255, 255, 0.05);
                        ">
                            <p style="
                                margin: 0;
                                font-size: 11px;
                                color: #4a4a4a;
                            ">
                                © 2025 Picaton. Все права защищены.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def _get_magic_link_email_text(magic_link: str, expire_minutes: int = 15) -> str:
    """Текстовая версия письма."""
    return f"""
Вход в Picaton

Нажмите на ссылку ниже, чтобы войти в свой профиль:

{magic_link}

Ссылка действительна {expire_minutes} минут.

Если вы не запрашивали вход — проигнорируйте это письмо.

---
© 2025 Picaton
"""


def _get_email_verification_html(code: str, expire_minutes: int = 15) -> str:
    """
    Генерирует HTML шаблон письма для верификации email.
    """
    return f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Подтверждение email - Picaton</title>
</head>
<body style="
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #1a1a1a 100%);
    min-height: 100vh;
">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #1a1a1a 100%);">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto;">
                    
                    <!-- Logo -->
                    <tr>
                        <td style="text-align: center; padding-bottom: 32px;">
                            <div style="
                                display: inline-block;
                                font-size: 32px;
                                font-weight: 700;
                                color: #ffffff;
                                letter-spacing: -1px;
                            ">
                                <span style="color: #ffffff;">Picaton</span>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Main Card -->
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="
                                background: rgba(255, 255, 255, 0.03);
                                border: 1px solid rgba(255, 255, 255, 0.08);
                                border-radius: 20px;
                                overflow: hidden;
                            ">
                                <!-- Card Header -->
                                <tr>
                                    <td style="
                                        padding: 40px 40px 24px;
                                        text-align: center;
                                    ">
                                        <h1 style="
                                            margin: 0 0 16px;
                                            font-size: 24px;
                                            font-weight: 600;
                                            color: #ffffff;
                                        ">Подтверждение email</h1>
                                        <p style="
                                            margin: 0;
                                            font-size: 15px;
                                            color: rgba(255, 255, 255, 0.6);
                                            line-height: 1.5;
                                        ">
                                            Введите этот код в приложении для подтверждения вашего email адреса
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Verification Code -->
                                <tr>
                                    <td style="padding: 0 40px 32px; text-align: center;">
                                        <div style="
                                            display: inline-block;
                                            padding: 20px 40px;
                                            background: rgba(255, 255, 255, 0.05);
                                            border: 1px solid rgba(255, 255, 255, 0.1);
                                            border-radius: 12px;
                                            font-size: 32px;
                                            font-weight: 700;
                                            letter-spacing: 8px;
                                            color: #ffffff;
                                            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
                                        ">{code}</div>
                                    </td>
                                </tr>
                                
                                <!-- Expiry Notice -->
                                <tr>
                                    <td style="padding: 0 40px 40px; text-align: center;">
                                        <p style="
                                            margin: 0;
                                            font-size: 13px;
                                            color: rgba(255, 255, 255, 0.4);
                                        ">
                                            Код действителен {expire_minutes} минут
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding-top: 32px; text-align: center;">
                            <p style="
                                margin: 0;
                                font-size: 12px;
                                color: rgba(255, 255, 255, 0.3);
                            ">
                                Если вы не запрашивали этот код, просто проигнорируйте это письмо.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def _get_email_verification_text(code: str, expire_minutes: int = 15) -> str:
    """Текстовая версия письма верификации."""
    return f"""
Подтверждение email - Picaton

Ваш код подтверждения: {code}

Введите этот код в приложении для подтверждения вашего email адреса.

Код действителен {expire_minutes} минут.

Если вы не запрашивали этот код, просто проигнорируйте это письмо.

---
© 2025 Picaton
"""


# Импортируем брокер здесь, после определения всех хелпер-функций
# чтобы избежать circular import
from infrastructure.broker import broker


@broker.task
async def send_magic_link_email(to_email: str, magic_link: str) -> bool:
    """
    Задача отправки magic link на email.

    Args:
        to_email: Email получателя
        magic_link: Полная ссылка для входа

    Returns:
        True если успешно, False при ошибке
    """

    try:
        # Создаём сообщение
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🔐 Вход в Picaton"
        msg["From"] = f"{settings.email.from_name} <{settings.email.from_email}>"
        msg["To"] = to_email
        msg["Message-ID"] = _generate_message_id()
        msg["Date"] = formatdate(localtime=True)

        # Добавляем текстовую и HTML версии
        expire_minutes = settings.magic_link.expire_minutes

        text_part = MIMEText(
            _get_magic_link_email_text(magic_link, expire_minutes), "plain", "utf-8"
        )
        html_part = MIMEText(
            _get_magic_link_email_html(magic_link, expire_minutes), "html", "utf-8"
        )

        msg.attach(text_part)
        msg.attach(html_part)

        # Отправляем
        with smtplib.SMTP(settings.email.smtp_host, settings.email.smtp_port) as server:
            if settings.email.use_tls:
                server.starttls()
            if settings.email.smtp_user and settings.email.smtp_password:
                server.login(settings.email.smtp_user, settings.email.smtp_password)
            server.sendmail(settings.email.from_email, [to_email], msg.as_string())

        logger.info(f"Magic link email sent to {to_email}")
        return True

    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending magic link to {to_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send magic link email to {to_email}: {e}")
        return False


@broker.task
async def send_email_verification_code(to_email: str, code: str) -> bool:
    """
    Задача отправки кода верификации email.

    Args:
        to_email: Email получателя
        code: 6-значный код подтверждения

    Returns:
        True если успешно, False при ошибке
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🔐 Код подтверждения - Picaton"
        msg["From"] = f"{settings.email.from_name} <{settings.email.from_email}>"
        msg["To"] = to_email
        msg["Message-ID"] = _generate_message_id()
        msg["Date"] = formatdate(localtime=True)

        expire_minutes = 15

        text_part = MIMEText(
            _get_email_verification_text(code, expire_minutes), "plain", "utf-8"
        )
        html_part = MIMEText(
            _get_email_verification_html(code, expire_minutes), "html", "utf-8"
        )

        msg.attach(text_part)
        msg.attach(html_part)

        with smtplib.SMTP(settings.email.smtp_host, settings.email.smtp_port) as server:
            if settings.email.use_tls:
                server.starttls()
            if settings.email.smtp_user and settings.email.smtp_password:
                server.login(settings.email.smtp_user, settings.email.smtp_password)
            server.sendmail(settings.email.from_email, [to_email], msg.as_string())

        logger.info(f"Verification code email sent to {to_email}")
        return True

    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending verification code to {to_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send verification code email to {to_email}: {e}")
        return False


@broker.task
async def send_welcome_email(to_email: str, user_name: str) -> bool:
    """
    Задача отправки приветственного письма.

    Args:
        to_email: Email получателя
        user_name: Имя пользователя

    Returns:
        True если успешно, False при ошибке
    """

    html = f"""
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="
            margin: 0;
            padding: 40px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #111111 100%);
        ">
            <table role="presentation" width="100%" style="max-width: 500px; margin: 0 auto;">
                <tr>
                    <td style="text-align: center; padding-bottom: 24px;">
                        <span style="font-size: 28px; font-weight: 700; color: #ffffff;">Picaton</span>
                    </td>
                </tr>
                <tr>
                    <td style="
                        background: rgba(255, 255, 255, 0.03);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 20px;
                        padding: 40px;
                        text-align: center;
                    ">
                        <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                        <h1 style="margin: 0 0 16px; font-size: 22px; color: #ffffff;">
                            Добро пожаловать, {user_name}!
                        </h1>
                        <p style="margin: 0 0 24px; font-size: 15px; color: #a0a0a0; line-height: 1.6;">
                            Спасибо за регистрацию в Picaton. Теперь вы можете создать свой профиль 
                            и делиться контактами через QR-код.
                        </p>
                        <a href="{settings.magic_link.frontend_url}/profile" style="
                            display: inline-block;
                            padding: 14px 32px;
                            background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
                            color: #0a0a0a;
                            text-decoration: none;
                            font-weight: 600;
                            border-radius: 10px;
                        ">
                            Перейти в профиль
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 24px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #666666;">
                            © 2025 Picaton
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🎉 Добро пожаловать в Picaton!"
        msg["From"] = f"{settings.email.from_name} <{settings.email.from_email}>"
        msg["To"] = to_email
        msg["Message-ID"] = _generate_message_id()
        msg["Date"] = formatdate(localtime=True)

        msg.attach(
            MIMEText(f"Добро пожаловать в Picaton, {user_name}!", "plain", "utf-8")
        )
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(settings.email.smtp_host, settings.email.smtp_port) as server:
            if settings.email.use_tls:
                server.starttls()
            if settings.email.smtp_user and settings.email.smtp_password:
                server.login(settings.email.smtp_user, settings.email.smtp_password)
            server.sendmail(settings.email.from_email, [to_email], msg.as_string())

        logger.info(f"Welcome email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send welcome email to {to_email}: {e}")
        return False


def _get_company_invitation_email_html(
    company_name: str,
    inviter_name: str,
    role: str,
    invitation_link: str,
    expire_days: int = 7,
) -> str:
    """
    Генерирует HTML шаблон письма для приглашения в компанию.
    """
    role_display = {
        "owner": "Владелец",
        "admin": "Администратор",
        "member": "Участник",
    }.get(role, "Участник")

    return f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Приглашение в команду</title>
</head>
<body style="
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #1a1a1a 100%);
    min-height: 100vh;
">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #1a1a1a 100%);">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto;">
                    
                    <!-- Logo -->
                    <tr>
                        <td style="text-align: center; padding-bottom: 32px;">
                            <div style="
                                display: inline-block;
                                font-size: 32px;
                                font-weight: 700;
                                color: #ffffff;
                                letter-spacing: -1px;
                            ">
                                <span style="color: #ffffff;">Picaton</span>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Main Card -->
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="
                                background: rgba(255, 255, 255, 0.03);
                                border: 1px solid rgba(255, 255, 255, 0.08);
                                border-radius: 20px;
                                overflow: hidden;
                            ">
                                <!-- Card Header -->
                                <tr>
                                    <td style="
                                        padding: 40px 40px 24px;
                                        text-align: center;
                                    ">
                                        <!-- Icon -->
                                        <div style="
                                            width: 64px;
                                            height: 64px;
                                            margin: 0 auto 24px;
                                            background: rgba(255, 255, 255, 0.05);
                                            border: 1px solid rgba(255, 255, 255, 0.1);
                                            border-radius: 16px;
                                            line-height: 64px;
                                            font-size: 28px;
                                        ">
                                            🤝
                                        </div>
                                        
                                        <h1 style="
                                            margin: 0 0 12px;
                                            font-size: 24px;
                                            font-weight: 600;
                                            color: #ffffff;
                                            letter-spacing: -0.5px;
                                        ">
                                            Приглашение в команду
                                        </h1>
                                        
                                        <p style="
                                            margin: 0;
                                            font-size: 15px;
                                            color: #a0a0a0;
                                            line-height: 1.6;
                                        ">
                                            <strong style="color: #ffffff;">{inviter_name}</strong> приглашает вас 
                                            присоединиться к компании <strong style="color: #ffffff;">{company_name}</strong>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Role Info -->
                                <tr>
                                    <td style="padding: 0 40px 24px;">
                                        <div style="
                                            background: rgba(255, 255, 255, 0.02);
                                            border: 1px solid rgba(255, 255, 255, 0.05);
                                            border-radius: 12px;
                                            padding: 16px;
                                            text-align: center;
                                        ">
                                            <p style="margin: 0; font-size: 13px; color: #666666;">
                                                Ваша роль в команде
                                            </p>
                                            <p style="margin: 8px 0 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                                                {role_display}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Button -->
                                <tr>
                                    <td style="padding: 0 40px 24px; text-align: center;">
                                        <a href="{invitation_link}" style="
                                            display: inline-block;
                                            padding: 16px 48px;
                                            background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
                                            color: #0a0a0a;
                                            text-decoration: none;
                                            font-size: 15px;
                                            font-weight: 600;
                                            border-radius: 12px;
                                            letter-spacing: -0.2px;
                                        ">
                                            Принять приглашение
                                        </a>
                                    </td>
                                </tr>
                                
                                <!-- Expire Notice -->
                                <tr>
                                    <td style="
                                        padding: 20px 40px;
                                        background: rgba(255, 255, 255, 0.02);
                                        border-top: 1px solid rgba(255, 255, 255, 0.05);
                                    ">
                                        <p style="
                                            margin: 0;
                                            font-size: 13px;
                                            color: #666666;
                                            text-align: center;
                                        ">
                                            ⏰ Приглашение действительно {expire_days} дней
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 32px 20px; text-align: center;">
                            <p style="
                                margin: 0;
                                font-size: 12px;
                                color: #444444;
                            ">
                                Если вы не ожидали это приглашение, просто проигнорируйте письмо.
                            </p>
                            <p style="
                                margin: 16px 0 0;
                                font-size: 12px;
                                color: #333333;
                            ">
                                © 2026 Picaton
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


@broker.task
async def send_company_invitation_email(
    to_email: str,
    company_name: str,
    inviter_name: str,
    role: str,
    invitation_link: str,
) -> bool:
    """
    Задача отправки письма с приглашением в компанию.

    Args:
        to_email: Email получателя
        company_name: Название компании
        inviter_name: Имя приглашающего
        role: Роль в компании
        invitation_link: Ссылка для принятия приглашения

    Returns:
        True если успешно, False при ошибке
    """
    try:
        html = _get_company_invitation_email_html(
            company_name=company_name,
            inviter_name=inviter_name,
            role=role,
            invitation_link=invitation_link,
        )

        text = f"""
Приглашение в команду {company_name}

{inviter_name} приглашает вас присоединиться к компании {company_name} в Picaton.

Ваша роль: {role}

Чтобы принять приглашение, перейдите по ссылке:
{invitation_link}

Приглашение действительно 7 дней.

Если вы не ожидали это приглашение, просто проигнорируйте письмо.

© 2026 Picaton
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🤝 {inviter_name} приглашает вас в {company_name}"
        msg["From"] = f"{settings.email.from_name} <{settings.email.from_email}>"
        msg["To"] = to_email
        msg["Message-ID"] = _generate_message_id()
        msg["Date"] = formatdate(localtime=True)

        text_part = MIMEText(text.strip(), "plain", "utf-8")
        html_part = MIMEText(html, "html", "utf-8")
        msg.attach(text_part)
        msg.attach(html_part)

        with smtplib.SMTP(settings.email.smtp_host, settings.email.smtp_port) as server:
            if settings.email.use_tls:
                server.starttls()
            if settings.email.smtp_user and settings.email.smtp_password:
                server.login(settings.email.smtp_user, settings.email.smtp_password)
            server.sendmail(settings.email.from_email, [to_email], msg.as_string())

        logger.info(f"Company invitation email sent to {to_email} for {company_name}")
        return True

    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending invitation to {to_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send invitation email to {to_email}: {e}")
        return False
