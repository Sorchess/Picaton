import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { useAuth, TelegramLoginButton } from "@/features/auth";
import { Typography, Button, Input } from "@/shared";
import "./AuthPage.scss";

type AuthView = "email" | "sent" | "verifying" | "error";

export function LoginPage() {
  const { requestMagicLink, verifyMagicLink, refreshUser, isLoading } =
    useAuth();
  const [email, setEmail] = useState("");
  const [view, setView] = useState<AuthView>("email");
  const [error, setError] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);

  const handleVerifyToken = useCallback(
    async (token: string) => {
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
    },
    [verifyMagicLink],
  );

  // Проверяем URL на наличие magic link токена
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token && !isVerifyingRef.current) {
      isVerifyingRef.current = true;
      // Убираем токен из URL сразу, чтобы избежать повторных запросов при перезагрузке
      window.history.replaceState({}, "", window.location.pathname);
      // Вызываем через setTimeout чтобы избежать setState в sync effect
      setTimeout(() => {
        handleVerifyToken(token);
      }, 0);
    }
  }, [handleVerifyToken]);

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

  const handleTelegramSuccess = async () => {
    // Токен уже сохранён в TelegramLoginButton
    // Просто обновляем данные пользователя
    await refreshUser();
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
            <svg
              width="64"
              height="67"
              viewBox="0 0 41 43"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter="url(#filter0_ddii_auth_logo)">
                <path
                  d="M15.6699 7.40995C15.6699 2.43033 22.1549 0.511287 24.8647 4.689L27.0697 8.08838C27.4651 8.69792 27.9886 9.21396 28.6037 9.60061L36.6791 14.6766C40.172 16.8721 39.653 22.1144 35.7975 23.5825L25.9007 27.351C24.5676 27.8586 23.5149 28.9114 23.0073 30.2444L20.3426 37.2423C18.7074 41.5366 12.6324 41.5366 10.9972 37.2423L8.15462 29.7771C7.76023 28.7413 6.94226 27.9234 5.90653 27.529C1.87508 25.9939 2.97512 20.0137 7.28896 20.0137H11.0866C13.6179 20.0137 15.6699 17.9616 15.6699 15.4303V7.40995Z"
                  fill="#0081FF"
                />
                <path
                  d="M15.6699 7.40995C15.6699 2.43033 22.1549 0.511287 24.8647 4.689L27.0697 8.08838C27.4651 8.69792 27.9886 9.21396 28.6037 9.60061L36.6791 14.6766C40.172 16.8721 39.653 22.1144 35.7975 23.5825L25.9007 27.351C24.5676 27.8586 23.5149 28.9114 23.0073 30.2444L20.3426 37.2423C18.7074 41.5366 12.6324 41.5366 10.9972 37.2423L8.15462 29.7771C7.76023 28.7413 6.94226 27.9234 5.90653 27.529C1.87508 25.9939 2.97512 20.0137 7.28896 20.0137H11.0866C13.6179 20.0137 15.6699 17.9616 15.6699 15.4303V7.40995Z"
                  fill="url(#paint0_radial_auth_logo)"
                />
                <path
                  d="M15.6699 7.40995C15.6699 2.43033 22.1549 0.511287 24.8647 4.689L27.0697 8.08838C27.4651 8.69792 27.9886 9.21396 28.6037 9.60061L36.6791 14.6766C40.172 16.8721 39.653 22.1144 35.7975 23.5825L25.9007 27.351C24.5676 27.8586 23.5149 28.9114 23.0073 30.2444L20.3426 37.2423C18.7074 41.5366 12.6324 41.5366 10.9972 37.2423L8.15462 29.7771C7.76023 28.7413 6.94226 27.9234 5.90653 27.529C1.87508 25.9939 2.97512 20.0137 7.28896 20.0137H11.0866C13.6179 20.0137 15.6699 17.9616 15.6699 15.4303V7.40995Z"
                  fill="url(#paint1_radial_auth_logo)"
                />
              </g>
              <defs>
                <filter
                  id="filter0_ddii_auth_logo"
                  x="-9.77516e-05"
                  y="0.00039053"
                  width="43.0191"
                  height="42.8625"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dx="-2" />
                  <feComposite in2="hardAlpha" operator="out" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0.336951 0 0 0 0 0.666955 0 0 0 1 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dx="-1" />
                  <feGaussianBlur stdDeviation="1.2" />
                  <feComposite in2="hardAlpha" operator="out" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.00784314 0 0 0 0 0.686275 0 0 0 0 0.878431 0 0 0 1 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="effect1_dropShadow"
                    result="effect2_dropShadow"
                  />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="effect2_dropShadow"
                    result="shape"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dx="4" dy="2" />
                  <feGaussianBlur stdDeviation="2" />
                  <feComposite
                    in2="hardAlpha"
                    operator="arithmetic"
                    k2="-1"
                    k3="1"
                  />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="shape"
                    result="effect3_innerShadow"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dx="1" dy="-1" />
                  <feGaussianBlur stdDeviation="1.2" />
                  <feComposite
                    in2="hardAlpha"
                    operator="arithmetic"
                    k2="-1"
                    k3="1"
                  />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.00784314 0 0 0 0 0.752941 0 0 0 0 0.909804 0 0 0 1 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="effect3_innerShadow"
                    result="effect4_innerShadow"
                  />
                </filter>
                <radialGradient
                  id="paint0_radial_auth_logo"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientUnits="userSpaceOnUse"
                  gradientTransform="translate(31.6699 20.5137) rotate(75) scale(32.6112)"
                >
                  <stop stopColor="#8C00FF" />
                  <stop offset="1" stopColor="#0283FF" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                  id="paint1_radial_auth_logo"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientUnits="userSpaceOnUse"
                  gradientTransform="translate(15.6699 36.5137) rotate(32.3827) scale(28.941)"
                >
                  <stop stopColor="#00EAFF" />
                  <stop offset="1" stopColor="#0283FF" stopOpacity="0" />
                </radialGradient>
              </defs>
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

          <div className="auth-page__divider">
            <span>или</span>
          </div>

          <div className="auth-page__social">
            <TelegramLoginButton
              onSuccess={handleTelegramSuccess}
              onError={(error) => setError(error)}
            />
          </div>
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
