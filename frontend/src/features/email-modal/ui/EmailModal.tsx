import { useState } from "react";
import { Modal, Button, Input } from "@/shared";
import { userApi } from "@/entities/user";
import { useI18n } from "@/shared/config";
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
  const { t } = useI18n();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError(t("emailModal.enterEmail"));
      return;
    }

    if (!validateEmail(email)) {
      setError(t("emailModal.invalidEmail"));
      return;
    }

    setIsLoading(true);
    try {
      await userApi.sendEmailVerificationCode(userId, email);
      setStep("code");
    } catch (err) {
      setError(t("emailModal.sendFailed"));
      console.error("Failed to send verification code:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError(t("emailModal.enterCode"));
      return;
    }

    if (code.length !== 6) {
      setError(t("emailModal.codeMustBe6"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await userApi.verifyEmailCode(userId, code);
      onEmailUpdated(response.email);
      onClose();
    } catch (err: unknown) {
      // Попробуем получить детальную ошибку от сервера
      const errorMessage =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || t("emailModal.invalidCode");
      setError(errorMessage);
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
      setError(t("emailModal.resendFailed"));
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
      closeOnOverlayClick={true}
      closeOnEscape={true}
    >
      <div className="email-modal">
        <div className="email-modal__header">
          <h2 className="email-modal__title">
            {step === "email"
              ? t("emailModal.specifyEmail")
              : t("emailModal.confirmEmail")}
          </h2>
        </div>

        {step === "email" ? (
          <form className="email-modal__form" onSubmit={handleSendCode}>
            <p className="email-modal__description">
              {t("emailModal.emailDescription")}
            </p>
            <div className="email-modal__input-wrapper">
              <Input
                placeholder="Email"
                className="email-modal__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
              />

              {error && <span className="email-modal__error">{error}</span>}
            </div>
            <div className="email-modal__actions">
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? t("common.sending") : t("emailModal.sendCode")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                {t("emailModal.later")}
              </Button>
            </div>
          </form>
        ) : (
          <form className="email-modal__form" onSubmit={handleVerifyCode}>
            <p className="email-modal__description">
              {t("emailModal.codeDescription", { email })
                .split(email)
                .map((part, i, arr) =>
                  i < arr.length - 1 ? (
                    <span key={i}>
                      {part}
                      <strong>{email}</strong>
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
            </p>
            <div className="email-modal__input-wrapper">
              <Input
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
                {isLoading ? t("emailModal.verifying") : t("emailModal.verify")}
              </Button>
            </div>
            <div className="email-modal__footer">
              <button
                type="button"
                className="email-modal__link"
                onClick={handleResendCode}
                disabled={isLoading}
              >
                {t("emailModal.resendCode")}
              </button>
              <span className="email-modal__separator">•</span>
              <button
                type="button"
                className="email-modal__link"
                onClick={handleBackToEmail}
                disabled={isLoading}
              >
                {t("emailModal.changeEmail")}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
