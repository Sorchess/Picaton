import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth";
import { Typography, Button, Input } from "@/shared";
import "./AuthPage.scss";

interface AuthPageProps {
  onSwitchToRegister: () => void;
}

export function LoginPage({ onSwitchToRegister }: AuthPageProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login({ email, password });
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { detail?: string } };
      if (apiErr.status !== undefined) {
        if (apiErr.status === 401) {
          setError("Неверный email или пароль");
        } else if (apiErr.status === 404) {
          setError("Пользователь с таким email не найден");
        } else if (apiErr.status === 429) {
          setError("Слишком много попыток. Попробуйте позже");
        } else if (apiErr.status === 422) {
          setError("Проверьте правильность введённых данных");
        } else if (apiErr.status >= 500) {
          setError("Ошибка сервера. Попробуйте позже");
        } else {
          setError(apiErr.data?.detail || "Ошибка авторизации");
        }
      } else if (
        err instanceof TypeError &&
        (err as TypeError).message === "Failed to fetch"
      ) {
        setError("Нет соединения с сервером. Проверьте интернет");
      } else {
        setError(err instanceof Error ? err.message : "Ошибка входа");
      }
    }
  };

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
              {/* Network nodes */}
              <circle cx="16" cy="10" r="2.5" fill="white" />
              <circle cx="10" cy="20" r="2.5" fill="white" />
              <circle cx="22" cy="20" r="2.5" fill="white" />
              <circle cx="16" cy="16" r="3" fill="white" opacity="0.9" />
              {/* Connection lines */}
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
            Войдите в свой аккаунт
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
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">Пароль</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="auth-page__submit"
            disabled={isLoading}
          >
            {isLoading ? "Вход..." : "Войти"}
          </Button>
        </form>

        <div className="auth-page__footer">
          <Typography variant="small">
            Нет аккаунта?{" "}
            <button
              type="button"
              className="auth-page__link"
              onClick={onSwitchToRegister}
            >
              Зарегистрироваться
            </button>
          </Typography>
        </div>
      </div>
    </div>
  );
}
