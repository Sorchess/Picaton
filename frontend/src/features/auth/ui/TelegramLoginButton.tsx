import { useEffect, useRef, useCallback, useState } from "react";
import type { TelegramAuthData } from "@/features/auth";
import { authApi } from "@/features/auth";
import "./TelegramLoginButton.scss";

interface TelegramLoginButtonProps {
  onAuth: (data: TelegramAuthData) => void;
  onError?: (error: string) => void;
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  showAvatar?: boolean;
  lang?: string;
}

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnauth?: (user: TelegramAuthData) => void;
    };
  }
}

export function TelegramLoginButton({
  onAuth,
  onError,
  buttonSize = "large",
  cornerRadius = 12,
  showAvatar = true,
  lang = "ru",
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);

  // Загружаем конфигурацию Telegram
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await authApi.getTelegramConfig();
        setBotUsername(config.bot_username);
        setIsEnabled(config.enabled);
      } catch (error) {
        console.error("Failed to load Telegram config:", error);
        onError?.("Не удалось загрузить конфигурацию Telegram");
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [onError]);

  // Callback для Telegram Widget
  const handleTelegramAuth = useCallback(
    (user: TelegramAuthData) => {
      onAuth(user);
    },
    [onAuth]
  );

  // Инициализируем Telegram Widget
  useEffect(() => {
    if (!botUsername || !isEnabled || !containerRef.current) return;

    // Регистрируем глобальный callback
    window.TelegramLoginWidget = {
      dataOnauth: handleTelegramAuth,
    };

    // Создаём script элемент для Telegram Widget
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-radius", cornerRadius.toString());
    script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", showAvatar.toString());
    script.setAttribute("data-lang", lang);
    script.async = true;

    // Очищаем контейнер и добавляем script
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);

    return () => {
      // Cleanup
      delete window.TelegramLoginWidget;
    };
  }, [
    botUsername,
    isEnabled,
    buttonSize,
    cornerRadius,
    showAvatar,
    lang,
    handleTelegramAuth,
  ]);

  if (isLoading) {
    return (
      <div className="telegram-login telegram-login--loading">
        <div className="telegram-login__spinner" />
      </div>
    );
  }

  if (!isEnabled) {
    return null; // Telegram не настроен, не показываем кнопку
  }

  return (
    <div className="telegram-login">
      <div ref={containerRef} className="telegram-login__widget" />
    </div>
  );
}
