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

export function EmailModal({
  isOpen,
  onClose,
  userId,
  onEmailUpdated,
}: EmailModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      await userApi.updateEmail(userId, email);
      onEmailUpdated(email);
      onClose();
    } catch (err) {
      setError("Не удалось сохранить email. Попробуйте ещё раз.");
      console.error("Failed to update email:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="email-modal">
        <div className="email-modal__header">
          <h2 className="email-modal__title">Укажите ваш email</h2>
        </div>
        <form className="email-modal__form" onSubmit={handleSubmit}>
          <p className="email-modal__description">
            Для завершения регистрации укажите ваш email. Он будет
            использоваться для приглашений в компании и восстановления доступа.
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
              {isLoading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
