import { useEffect, useState, useCallback, useRef } from "react";
import { authApi } from "@/features/auth";
import { useI18n } from "@/shared/config";
import { tokenStorage } from "@/shared/api";
import "./TelegramLoginButton.scss";

interface TelegramLoginButtonProps {
  onSuccess: () => void;
  onError?: (error: string) => void;
}

type AuthStatus = "idle" | "loading" | "waiting" | "success" | "error";

export function TelegramLoginButton({
  onSuccess,
  onError,
}: TelegramLoginButtonProps) {
  const [status, setStatus] = useState<AuthStatus>("idle");
  const { t } = useI18n();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  const pollingRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const authTokenRef = useRef<string | null>(null);

  // Загружаем конфигурацию Telegram
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await authApi.getTelegramConfig();
        setIsEnabled(config.enabled);
      } catch (error) {
        console.error("Failed to load Telegram config:", error);
      } finally {
        setIsConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Polling статуса авторизации
  const startPolling = useCallback(
    (authToken: string) => {
      // Очищаем предыдущий polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      const poll = async () => {
        try {
          const result = await authApi.checkTelegramAuthStatus(authToken);

          if (result.status === "confirmed" && result.access_token) {
            // Успешная авторизация
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
            }
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }

            tokenStorage.set(result.access_token);
            setStatus("success");
            onSuccess();
          } else if (result.status === "expired") {
            // Токен истёк
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
            }
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }

            setStatus("error");
            onError?.(t("auth.telegramAuthExpired"));
          }
          // Если pending - продолжаем polling
        } catch (error) {
          console.error("Polling error:", error);
        }
      };

      // Первый запрос сразу
      poll();

      // Затем каждые 2 секунды
      pollingRef.current = window.setInterval(poll, 2000);
    },
    [onSuccess, onError],
  );

  // Таймер обратного отсчёта
  const startCountdown = useCallback((seconds: number) => {
    setRemaining(seconds);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    countdownRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Запуск авторизации
  const handleClick = async () => {
    setStatus("loading");

    try {
      const result = await authApi.createTelegramDeepLink();

      authTokenRef.current = result.token;
      setDeepLink(result.deep_link);
      setStatus("waiting");

      // Запускаем таймер
      startCountdown(result.expires_in);

      // Запускаем polling
      startPolling(result.token);

      // Пробуем открыть Telegram приложение
      // Сначала пробуем tg:// протокол, потом fallback на https
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // На мобильных сразу открываем ссылку
        window.location.href = result.tg_link;
      } else {
        // На десктопе пробуем tg://, если не сработает - покажем ссылку
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = result.tg_link;
        document.body.appendChild(iframe);

        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to create deep link:", error);
      setStatus("error");
      onError?.(t("auth.telegramLinkFailed"));
    }
  };

  // Сброс состояния
  const handleRetry = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    setStatus("idle");
    authTokenRef.current = null;
    setDeepLink(null);
  };

  // Форматирование времени
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isConfigLoading) {
    return (
      <div className="telegram-login telegram-login--loading">
        <div className="telegram-login__spinner" />
      </div>
    );
  }

  if (!isEnabled) {
    return null;
  }

  // Ожидание подтверждения в Telegram
  if (status === "waiting") {
    return (
      <div className="telegram-login telegram-login--waiting">
        <div className="telegram-login__waiting-content">
          <div className="telegram-login__icon">📱</div>
          <div className="telegram-login__waiting-text">
            <p className="telegram-login__waiting-title">
              {t("auth.telegramConfirm")}
            </p>
            <p className="telegram-login__waiting-subtitle">
              {t("auth.telegramInstruction")}
            </p>
          </div>
          <div className="telegram-login__timer">{formatTime(remaining)}</div>
        </div>

        {deepLink && (
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="telegram-login__open-link"
          >
            {t("auth.openTelegram")}
          </a>
        )}

        <button
          type="button"
          className="telegram-login__cancel"
          onClick={handleRetry}
        >
          {t("common.cancel")}
        </button>
      </div>
    );
  }

  // Ошибка
  if (status === "error") {
    return (
      <div className="telegram-login telegram-login--error">
        <button
          type="button"
          className="telegram-login__button telegram-login__button--retry"
          onClick={handleRetry}
        >
          <TelegramIcon />
          <span>{t("common.tryAgain")}</span>
        </button>
      </div>
    );
  }

  // Основная кнопка
  return (
    <div className="telegram-login">
      <button
        type="button"
        className="telegram-login__button"
        onClick={handleClick}
        disabled={status === "loading"}
      >
        <TelegramIcon />
        <span>
          {status === "loading"
            ? t("common.loading")
            : t("auth.signInTelegram")}
        </span>
      </button>
    </div>
  );
}

function TelegramIcon() {
  return (
    <svg
      className="telegram-login__tg-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
