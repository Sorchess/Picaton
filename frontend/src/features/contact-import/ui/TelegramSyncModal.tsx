import { useState, useCallback, useEffect, useRef } from "react";
import { Modal, Loader } from "@/shared";
import { authApi } from "@/features/auth";
import type { TelegramFoundContact } from "@/features/auth/model/types";
import "./TelegramSyncModal.scss";

interface TelegramSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (contacts: TelegramFoundContact[]) => void;
}

type SyncStatus = "idle" | "loading" | "waiting" | "success" | "error";

export function TelegramSyncModal({
  isOpen,
  onClose,
  onSyncComplete,
}: TelegramSyncModalProps) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [foundContacts, setFoundContacts] = useState<TelegramFoundContact[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(0);

  const pollingRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Очистка при закрытии
  useEffect(() => {
    if (!isOpen) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setStatus("idle");
      setError(null);
      setDeepLink(null);
      tokenRef.current = null;
    }
  }, [isOpen]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    setRemaining(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startPolling = useCallback(
    (token: string) => {
      if (pollingRef.current) clearInterval(pollingRef.current);

      const poll = async () => {
        try {
          const result = await authApi.checkContactSyncStatus(token);

          if (result.status === "completed" && result.contacts) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);

            setFoundContacts(result.contacts);
            setStatus("success");
            onSyncComplete?.(result.contacts);
          } else if (result.status === "expired") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);

            setStatus("error");
            setError("Время синхронизации истекло. Попробуйте ещё раз.");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      };

      poll();
      pollingRef.current = window.setInterval(poll, 2000);
    },
    [onSyncComplete]
  );

  const handleStartSync = async () => {
    setStatus("loading");
    setError(null);

    try {
      const result = await authApi.createContactSyncSession();

      tokenRef.current = result.token;
      setDeepLink(result.deep_link);
      setStatus("waiting");

      startCountdown(result.expires_in);
      startPolling(result.token);

      // Открываем Telegram
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        window.location.href = result.tg_link;
      } else {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = result.tg_link;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    } catch (err) {
      console.error("Failed to start sync:", err);
      setStatus("error");
      setError("Не удалось начать синхронизацию");
    }
  };

  const handleRetry = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setStatus("idle");
    setError(null);
    setDeepLink(null);
    tokenRef.current = null;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClose = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    onClose();
  };

  const handleInvite = () => {
    const inviteText = encodeURIComponent(
      "Привет! Присоединяйся к Picaton — сервису для создания профессиональной сети. Создай свой профиль и находи нужных специалистов!"
    );
    const inviteUrl = encodeURIComponent(window.location.origin);

    // tg://msg_url для десктопа, https://t.me/share для мобильных
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      window.location.href = `https://t.me/share/url?url=${inviteUrl}&text=${inviteText}`;
    } else {
      // Пробуем открыть через tg:// протокол
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `tg://msg_url?url=${inviteUrl}&text=${inviteText}`;
      document.body.appendChild(iframe);
      setTimeout(() => document.body.removeChild(iframe), 1000);

      // Fallback: открываем web версию через 500ms
      setTimeout(() => {
        window.open(
          `https://t.me/share/url?url=${inviteUrl}&text=${inviteText}`,
          "_blank"
        );
      }, 500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Синхронизация контактов"
      size="md"
    >
      <div className="telegram-sync-modal">
        {status === "idle" && (
          <>
            <div className="telegram-sync-modal__icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>

            <p className="telegram-sync-modal__description">
              Найдите знакомых, которые уже есть в Picaton. Перешлите боту
              контакты из Telegram — мы покажем, кто уже зарегистрирован.
            </p>

            <div className="telegram-sync-modal__steps">
              <div className="telegram-sync-modal__step">
                <span className="telegram-sync-modal__step-num">1</span>
                <span>Нажмите кнопку ниже</span>
              </div>
              <div className="telegram-sync-modal__step">
                <span className="telegram-sync-modal__step-num">2</span>
                <span>Откроется Telegram бот</span>
              </div>
              <div className="telegram-sync-modal__step">
                <span className="telegram-sync-modal__step-num">3</span>
                <span>Перешлите контакты, которые хотите найти</span>
              </div>
              <div className="telegram-sync-modal__step">
                <span className="telegram-sync-modal__step-num">4</span>
                <span>Нажмите "Готово" в боте</span>
              </div>
            </div>

            <div className="telegram-sync-modal__actions">
              <button
                className="telegram-sync-modal__btn telegram-sync-modal__btn--secondary"
                onClick={handleClose}
              >
                Отмена
              </button>
              <button
                className="telegram-sync-modal__btn telegram-sync-modal__btn--primary"
                onClick={handleStartSync}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="20"
                  height="20"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Открыть Telegram
              </button>
            </div>

            <div className="telegram-sync-modal__divider">
              <span>или</span>
            </div>

            <button
              className="telegram-sync-modal__invite-btn"
              onClick={handleInvite}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="20"
                height="20"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
              Пригласить друга в Picaton
            </button>
          </>
        )}

        {status === "loading" && (
          <div className="telegram-sync-modal__loading">
            <Loader />
            <p>Создаём сессию синхронизации...</p>
          </div>
        )}

        {status === "waiting" && (
          <>
            <div className="telegram-sync-modal__waiting-icon">📱</div>
            <p className="telegram-sync-modal__waiting-title">
              Ожидаем контакты из Telegram
            </p>
            <p className="telegram-sync-modal__waiting-subtitle">
              Перешлите контакты боту и нажмите "Готово"
            </p>
            <div className="telegram-sync-modal__timer">
              {formatTime(remaining)}
            </div>

            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="telegram-sync-modal__open-link"
              >
                Открыть Telegram
              </a>
            )}

            <button
              className="telegram-sync-modal__btn telegram-sync-modal__btn--text"
              onClick={handleRetry}
            >
              Отмена
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <div className="telegram-sync-modal__success-icon">✅</div>
            <p className="telegram-sync-modal__success-title">
              Синхронизация завершена!
            </p>
            <p className="telegram-sync-modal__success-subtitle">
              {foundContacts.length > 0
                ? `Найдено ${foundContacts.length} ${getNoun(
                    foundContacts.length,
                    "контакт",
                    "контакта",
                    "контактов"
                  )} в Picaton`
                : "К сожалению, никого не нашли среди ваших контактов"}
            </p>

            {foundContacts.length > 0 && (
              <div className="telegram-sync-modal__contacts">
                {foundContacts.slice(0, 5).map((contact) => (
                  <div
                    key={contact.user_id}
                    className="telegram-sync-modal__contact"
                  >
                    {contact.avatar_url ? (
                      <img
                        src={contact.avatar_url}
                        alt=""
                        className="telegram-sync-modal__contact-avatar"
                      />
                    ) : (
                      <div className="telegram-sync-modal__contact-avatar telegram-sync-modal__contact-avatar--placeholder">
                        {contact.user_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="telegram-sync-modal__contact-info">
                      <span className="telegram-sync-modal__contact-name">
                        {contact.user_name}
                      </span>
                      {contact.telegram_username && (
                        <span className="telegram-sync-modal__contact-username">
                          @{contact.telegram_username}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {foundContacts.length > 5 && (
                  <p className="telegram-sync-modal__more">
                    и ещё {foundContacts.length - 5}
                  </p>
                )}
              </div>
            )}

            {foundContacts.length === 0 && (
              <button
                className="telegram-sync-modal__invite-btn"
                onClick={handleInvite}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="20"
                  height="20"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
                Пригласить друзей в Picaton
              </button>
            )}

            <button
              className="telegram-sync-modal__btn telegram-sync-modal__btn--primary"
              onClick={handleClose}
            >
              Готово
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="telegram-sync-modal__error-icon">❌</div>
            <p className="telegram-sync-modal__error-title">Ошибка</p>
            <p className="telegram-sync-modal__error-text">{error}</p>

            <div className="telegram-sync-modal__actions">
              <button
                className="telegram-sync-modal__btn telegram-sync-modal__btn--secondary"
                onClick={handleClose}
              >
                Закрыть
              </button>
              <button
                className="telegram-sync-modal__btn telegram-sync-modal__btn--primary"
                onClick={handleRetry}
              >
                Попробовать снова
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function getNoun(
  number: number,
  one: string,
  two: string,
  five: string
): string {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) return five;
  n %= 10;
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return two;
  return five;
}
