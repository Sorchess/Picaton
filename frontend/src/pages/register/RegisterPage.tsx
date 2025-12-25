import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth";
import { Typography, Button, Input } from "@/shared";
import { ApiError } from "@/shared/api";
import "./AuthPage.scss";

interface AuthPageProps {
  onSwitchToLogin: () => void;
}

export function RegisterPage({ onSwitchToLogin }: AuthPageProps) {
  const { register, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (formData.password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("Пользователь с таким email уже существует");
        } else {
          const data = err.data as { detail?: string } | null;
          setError(data?.detail || "Ошибка регистрации");
        }
      } else {
        setError(err instanceof Error ? err.message : "Ошибка регистрации");
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
              <path
                d="M10 12h4v8h-4v-8zm8 0h4v8h-4v-8zm-4 2h4v4h-4v-4z"
                fill="white"
                opacity="0.9"
              />
            </svg>
          </div>
          <Typography variant="h1" className="auth-page__title">
            Picaton
          </Typography>
          <Typography variant="body" className="auth-page__subtitle">
            Создайте новый аккаунт
          </Typography>
        </div>

        <form className="auth-page__form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-page__error">
              <Typography variant="small">{error}</Typography>
            </div>
          )}

          <div className="auth-page__row">
            <div className="auth-page__field">
              <label className="auth-page__label">Имя</label>
              <Input
                type="text"
                value={formData.first_name}
                onChange={handleChange("first_name")}
                placeholder="Иван"
                required
              />
            </div>

            <div className="auth-page__field">
              <label className="auth-page__label">Фамилия</label>
              <Input
                type="text"
                value={formData.last_name}
                onChange={handleChange("last_name")}
                placeholder="Иванов"
                required
              />
            </div>
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={handleChange("email")}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">Пароль</label>
            <Input
              type="password"
              value={formData.password}
              onChange={handleChange("password")}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">Подтвердите пароль</label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange("confirmPassword")}
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
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </Button>
        </form>

        <div className="auth-page__footer">
          <Typography variant="small">
            Уже есть аккаунт?{" "}
            <button
              type="button"
              className="auth-page__link"
              onClick={onSwitchToLogin}
            >
              Войти
            </button>
          </Typography>
        </div>
      </div>
    </div>
  );
}
