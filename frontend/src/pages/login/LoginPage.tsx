import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "@/features/auth";
import { Typography, Button, Input } from "@/shared";
import "./AuthPage.scss";

type AuthView = "email" | "sent" | "verifying" | "error";

export function LoginPage() {
  const { requestMagicLink, verifyMagicLink, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [view, setView] = useState<AuthView>("email");
  const [error, setError] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);

  // Проверяем URL на наличие magic link токена
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token && !isVerifyingRef.current) {
      isVerifyingRef.current = true;
      // Убираем токен из URL сразу, чтобы избежать повторных запросов при перезагрузке
      window.history.replaceState({}, "", window.location.pathname);
      handleVerifyToken(token);
    }
  }, []);

  const handleVerifyToken = async (token: string) => {
    setView("verifying");
    setError(null);

    try {
      await verifyMagicLink(token);
      // URL уже очищен в useEffect, здесь ничего делать не нужно
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { detail?: string } };
      setView("error");

      if (apiErr.status === 410) {
        setError("Ссылка для входа истекла. Запросите новую.");
      } else if (apiErr.status === 400) {
        setError(apiErr.data?.detail || "Невалидная ссылка для входа");
      } else {
        setError("Ошибка при входе. Попробуйте ещё раз.");
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await requestMagicLink(email);
      setView("sent");
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { detail?: string } };
      if (apiErr.status === 429) {
        setError("Слишком много запросов. Подождите немного.");
      } else if (apiErr.status === 422) {
        setError("Введите корректный email");
      } else {
        setError("Не удалось отправить ссылку. Попробуйте позже.");
      }
    }
  };

  const handleBack = () => {
    setView("email");
    setError(null);
  };

  // Показываем экран загрузки при верификации токена
  if (view === "verifying") {
    return (
      <div className="auth-page">
        <div className="auth-page__container">
          <div className="auth-page__header">
            <div className="auth-page__icon auth-page__icon--loading">
              <div className="auth-page__spinner" />
            </div>
            <Typography variant="h1" className="auth-page__title">
              Входим...
            </Typography>
            <Typography variant="body" className="auth-page__subtitle">
              Проверяем ссылку для входа
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  // Показываем ошибку верификации
  if (view === "error") {
    return (
      <div className="auth-page">
        <div className="auth-page__container">
          <div className="auth-page__header">
            <div className="auth-page__icon auth-page__icon--error">❌</div>
            <Typography variant="h1" className="auth-page__title">
              Ошибка входа
            </Typography>
            <Typography variant="body" className="auth-page__subtitle">
              {error}
            </Typography>
          </div>

          <Button
            variant="primary"
            className="auth-page__submit"
            onClick={handleBack}
          >
            Запросить новую ссылку
          </Button>
        </div>
      </div>
    );
  }

  // Показываем экран "ссылка отправлена"
  if (view === "sent") {
    return (
      <div className="auth-page">
        <div className="auth-page__container">
          <div className="auth-page__header">
            <div className="auth-page__icon auth-page__icon--success">✉️</div>
            <Typography variant="h1" className="auth-page__title">
              Проверьте почту
            </Typography>
            <Typography variant="body" className="auth-page__subtitle">
              Мы отправили ссылку для входа на
            </Typography>
            <Typography variant="body" className="auth-page__email-highlight">
              {email}
            </Typography>
          </div>

          <div className="auth-page__sent-info">
            <Typography variant="small" className="auth-page__sent-tip">
              💡 Ссылка действительна 15 минут
            </Typography>
            <Typography variant="small" className="auth-page__sent-tip">
              📧 Проверьте папку "Спам", если письмо не пришло
            </Typography>
          </div>

          <div className="auth-page__footer">
            <Typography variant="small">
              Не получили письмо?{" "}
              <button
                type="button"
                className="auth-page__link"
                onClick={handleBack}
              >
                Отправить ещё раз
              </button>
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  // Основная форма ввода email
  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__header">
          <div className="auth-page__logo">
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient
                  id="authLogoGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="14" fill="url(#authLogoGradient)" />
              <circle cx="16" cy="10" r="2.5" fill="white" />
              <circle cx="10" cy="20" r="2.5" fill="white" />
              <circle cx="22" cy="20" r="2.5" fill="white" />
              <circle cx="16" cy="16" r="3" fill="white" opacity="0.9" />
              <line
                x1="16"
                y1="10"
                x2="16"
                y2="16"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <line
                x1="16"
                y1="16"
                x2="10"
                y2="20"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <line
                x1="16"
                y1="16"
                x2="22"
                y2="20"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
            </svg>
          </div>
          <Typography variant="h1" className="auth-page__title">
            Picaton
          </Typography>
          <Typography variant="body" className="auth-page__subtitle">
            Войдите или зарегистрируйтесь
          </Typography>
        </div>

        <form className="auth-page__form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-page__error">
              <Typography variant="small">{error}</Typography>
            </div>
          )}

          <div className="auth-page__field">
            <label className="auth-page__label">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="auth-page__submit"
            disabled={isLoading || !email}
          >
            {isLoading ? "Отправка..." : "Получить ссылку для входа"}
          </Button>
        </form>

        <div className="auth-page__footer">
          <Typography variant="small" className="auth-page__hint">
            🔐 Без пароля — просто перейдите по ссылке из письма
          </Typography>
        </div>
      </div>
    </div>
  );
}
