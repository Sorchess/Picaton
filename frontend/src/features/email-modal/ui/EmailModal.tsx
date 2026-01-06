import { useState } from "react";
import { Modal, Button } from "@/shared";
import { userApi } from "@/entities/user";
import "./EmailModal.scss";

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onEmailUpdated: (email: string) => void;
}

type Step = "email" | "code";

export function EmailModal({
  isOpen,
  onClose,
  userId,
  onEmailUpdated,
}: EmailModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Введите email");
      return;
    }

    if (!validateEmail(email)) {
      setError("Введите корректный email");
      return;
    }

    setIsLoading(true);
    try {
      await userApi.sendEmailVerificationCode(userId, email);
      setStep("code");
    } catch (err) {
      setError("Не удалось отправить код. Попробуйте ещё раз.");
      console.error("Failed to send verification code:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Введите код");
      return;
    }

    if (code.length !== 6) {
      setError("Код должен содержать 6 цифр");
      return;
    }

    setIsLoading(true);
    try {
      const response = await userApi.verifyEmailCode(userId, code);
      onEmailUpdated(response.email);
      onClose();
    } catch (err) {
      setError("Неверный или истёкший код. Попробуйте ещё раз.");
      console.error("Failed to verify code:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await userApi.sendEmailVerificationCode(userId, email);
      setCode("");
      setError(null);
    } catch (err) {
      setError("Не удалось отправить код повторно.");
      console.error("Failed to resend code:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setCode("");
    setError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={false}
      closeOnEscape={false}
    >
      <div className="email-modal">
        <div className="email-modal__header">
          <h2 className="email-modal__title">
            {step === "email" ? "Укажите ваш email" : "Подтвердите email"}
          </h2>
        </div>

        {step === "email" ? (
          <form className="email-modal__form" onSubmit={handleSendCode}>
            <p className="email-modal__description">
              Для завершения регистрации укажите ваш email. На него придёт код
              подтверждения.
            </p>
            <div className="email-modal__input-wrapper">
              <input
                type="email"
                className="email-modal__input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
              {error && <span className="email-modal__error">{error}</span>}
            </div>
            <div className="email-modal__actions">
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? "Отправка..." : "Отправить код"}
              </Button>
            </div>
          </form>
        ) : (
          <form className="email-modal__form" onSubmit={handleVerifyCode}>
            <p className="email-modal__description">
              Мы отправили 6-значный код на <strong>{email}</strong>. Введите
              его ниже для подтверждения.
            </p>
            <div className="email-modal__input-wrapper">
              <input
                type="text"
                className="email-modal__input email-modal__input--code"
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                disabled={isLoading}
                autoFocus
                inputMode="numeric"
                maxLength={6}
              />
              {error && <span className="email-modal__error">{error}</span>}
            </div>
            <div className="email-modal__actions">
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? "Проверка..." : "Подтвердить"}
              </Button>
            </div>
            <div className="email-modal__footer">
              <button
                type="button"
                className="email-modal__link"
                onClick={handleResendCode}
                disabled={isLoading}
              >
                Отправить код повторно
              </button>
              <span className="email-modal__separator">•</span>
              <button
                type="button"
                className="email-modal__link"
                onClick={handleBackToEmail}
                disabled={isLoading}
              >
                Изменить email
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
