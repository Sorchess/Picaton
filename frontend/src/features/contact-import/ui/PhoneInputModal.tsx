import { useState, useCallback } from "react";
import { Modal, Loader } from "@/shared";
import { parsePhoneInput, hashPhones } from "../lib/hashPhone";
import type { ContactSyncResult, HashedContact } from "../model/types";
import "./PhoneInputModal.scss";

interface PhoneInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (contacts: HashedContact[]) => Promise<ContactSyncResult>;
  onSyncComplete?: () => void;
}

export function PhoneInputModal({
  isOpen,
  onClose,
  onSync,
  onSyncComplete,
}: PhoneInputModalProps) {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ContactSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setError(null);
    setResult(null);

    const parsed = parsePhoneInput(input);
    if (parsed.length === 0) {
      setError("Введите хотя бы один номер телефона");
      return;
    }

    setIsProcessing(true);

    try {
      // Hash phones on client side (privacy-first)
      const hashed = await hashPhones(parsed);

      if (hashed.length === 0) {
        setError("Не удалось обработать номера телефонов");
        return;
      }

      // Send hashes to server
      const syncResult = await onSync(hashed);
      setResult(syncResult);
      onSyncComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка синхронизации");
    } finally {
      setIsProcessing(false);
    }
  }, [input, onSync, onSyncComplete]);

  const handleInvite = useCallback(async () => {
    if (!navigator.share) {
      setError("Функция приглашения недоступна в вашем браузере");
      return;
    }

    try {
      await navigator.share({
        title: "Присоединяйся к Picaton!",
        text: "Найди экспертов и создай свою профессиональную сеть",
        url: window.location.origin,
      });
    } catch {
      // User cancelled share
    }
  }, []);

  const handleClose = useCallback(() => {
    setInput("");
    setResult(null);
    setError(null);
    onClose();
  }, [onClose]);

  const parsedCount = parsePhoneInput(input).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Синхронизация контактов"
    >
      <div className="phone-input-modal">
        {!result ? (
          <>
            <p className="phone-input-modal__description">
              Введите номера телефонов для поиска в Picaton. Номера хешируются
              на вашем устройстве — мы никогда не видим реальные данные.
            </p>

            <div className="phone-input-modal__input-group">
              <label className="phone-input-modal__label">
                Номера телефонов
              </label>
              <textarea
                className="phone-input-modal__textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Иван: +7 999 123 45 67\nМария - 89161234567\n+79031234567`}
                rows={6}
                disabled={isProcessing}
              />
              <span className="phone-input-modal__hint">
                {parsedCount > 0
                  ? `Распознано: ${parsedCount} ${getNoun(
                      parsedCount,
                      "номер",
                      "номера",
                      "номеров",
                    )}`
                  : "Один номер на строку. Формат: Имя: +7 999 123 45 67"}
              </span>
            </div>

            {error && <div className="phone-input-modal__error">{error}</div>}

            <div className="phone-input-modal__actions">
              <button
                className="phone-input-modal__btn phone-input-modal__btn--secondary"
                onClick={handleClose}
                disabled={isProcessing}
              >
                Отмена
              </button>
              <button
                className="phone-input-modal__btn phone-input-modal__btn--primary"
                onClick={handleSync}
                disabled={isProcessing || parsedCount === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader />
                    <span>Поиск...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <span>Найти в Picaton</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="phone-input-modal__results">
            <div className="phone-input-modal__results-summary">
              {result.found.length > 0 && (
                <div className="phone-input-modal__results-stat phone-input-modal__results-stat--success">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>
                    {result.found.length}{" "}
                    {getNoun(
                      result.found.length,
                      "контакт найден",
                      "контакта найдено",
                      "контактов найдено",
                    )}
                  </span>
                </div>
              )}
              {result.pending_count > 0 && (
                <div className="phone-input-modal__results-stat phone-input-modal__results-stat--pending">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>
                    {result.pending_count}{" "}
                    {getNoun(
                      result.pending_count,
                      "номер",
                      "номера",
                      "номеров",
                    )}{" "}
                    ожидает регистрации
                  </span>
                </div>
              )}
            </div>

            {result.found.length > 0 && (
              <div className="phone-input-modal__found-list">
                <h4>Найденные пользователи:</h4>
                {result.found.map((user) => (
                  <div
                    key={user.user.id}
                    className="phone-input-modal__found-item"
                  >
                    <div className="phone-input-modal__found-avatar">
                      {user.user.avatar_url ? (
                        <img src={user.user.avatar_url} alt={user.user.name} />
                      ) : (
                        getInitials(user.user.name)
                      )}
                    </div>
                    <div className="phone-input-modal__found-info">
                      <span className="phone-input-modal__found-name">
                        {user.user.name}
                      </span>
                      <span className="phone-input-modal__found-original">
                        {user.original_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.pending_count > 0 && "share" in navigator && (
              <button
                className="phone-input-modal__btn phone-input-modal__btn--invite"
                onClick={handleInvite}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>Пригласить друзей</span>
              </button>
            )}

            <button
              className="phone-input-modal__btn phone-input-modal__btn--secondary"
              onClick={handleClose}
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function getNoun(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
