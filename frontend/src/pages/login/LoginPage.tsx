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
        <div className="auth-page__bg">
          <svg
            className="auth-page__floating-svg-1"
            width="250"
            height="250"
            viewBox="0 0 250 250"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M40.448 92.8046C49.1435 60.3615 53.4913 44.1399 64.8035 34.982C68.4569 32.0244 72.5532 29.66 76.9419 27.9758C90.5312 22.7608 106.757 27.1073 139.209 35.8004L156.518 40.4371C188.97 49.1301 205.196 53.4767 214.357 64.7857C217.315 68.4381 219.68 72.5332 221.365 76.9208C226.581 90.5063 222.234 106.728 213.538 139.171L208.9 156.475C200.205 188.918 195.857 205.14 184.545 214.298C180.891 217.256 176.795 219.62 172.406 221.304C158.817 226.519 142.591 222.173 110.139 213.479L92.8298 208.843C60.3777 200.15 44.1517 195.803 34.9913 184.494C32.0328 180.842 29.6678 176.747 27.9832 172.359C22.7667 158.774 27.1145 142.552 35.81 110.109L40.448 92.8046Z"
              fill="url(#paint0_linear_1045_17595)"
            />
            <path
              d="M142.097 68.5075C116.103 60.2167 88.5839 75.4357 81.5957 101.509L73.2619 132.602C71.181 140.366 75.4551 148.352 82.8806 151.044C80.7224 161.781 87.2885 172.584 98.0101 175.456L100.752 176.19C101.55 178.152 103.2 179.744 105.399 180.333L113.513 182.506C117.239 183.505 121.086 181.286 122.086 177.558C123.085 173.829 120.863 169.986 117.136 168.987L109.022 166.814C106.824 166.225 104.599 166.779 102.926 168.079L100.184 167.344C93.8772 165.655 90.0778 159.597 91.0445 153.304L94.9692 154.356C97.2113 154.956 99.513 153.625 100.113 151.387L107.36 124.349C107.96 122.11 106.632 119.807 104.39 119.206L86.8106 114.497L89.7093 103.682C95.4886 82.1198 117.995 69.633 139.54 76.505C159.607 82.9044 170.61 104.662 165.119 125.15L162.538 134.783L144.958 130.074C142.716 129.473 140.414 130.804 139.814 133.042L132.567 160.08C131.967 162.319 133.295 164.622 135.537 165.223L146.355 168.121C154.558 170.318 163.019 165.432 165.216 157.234L173.233 127.324C179.838 102.68 166.557 76.3078 142.097 68.5075Z"
              fill="url(#paint1_linear_1045_17595)"
            />
            <path
              d="M114.092 180.344L113.513 182.506L105.399 180.333L105.979 178.171L114.092 180.344ZM119.922 176.979C120.601 174.446 119.089 171.83 116.556 171.151L108.442 168.978C106.971 168.584 105.462 168.945 104.301 169.847L103.42 170.53L99.6041 169.508C92.169 167.516 87.6953 160.36 88.8315 152.964L89.21 150.495L95.5488 152.193L94.9692 154.356L91.0445 153.304C90.1085 159.4 93.6449 165.276 99.6005 167.173L100.184 167.344L102.926 168.079L103.246 167.844C104.768 166.789 106.685 166.324 108.609 166.715L109.022 166.814L117.136 168.987C120.863 169.986 123.085 173.829 122.086 177.558L121.984 177.903C120.846 181.422 117.123 183.473 113.513 182.506L114.092 180.344C116.624 181.022 119.242 179.512 119.922 176.979ZM102.406 174.316L102.827 175.345C103.382 176.707 104.507 177.776 105.979 178.171L105.399 180.333L104.992 180.211C102.997 179.544 101.5 178.028 100.752 176.19L98.0101 175.456L98.5896 173.293L102.406 174.316ZM73.2619 132.602L81.5957 101.509C88.5839 75.4357 116.103 60.2167 142.097 68.5075C166.557 76.3078 179.838 102.68 173.233 127.324L165.216 157.234L164.992 157.993C162.491 165.731 154.302 170.249 146.355 168.121L146.935 165.958C153.942 167.836 161.175 163.659 163.052 156.656L171.069 126.745C177.386 103.178 164.661 78.0526 141.417 70.64C116.646 62.7392 90.4178 77.2456 83.7591 102.089L75.4253 133.183C73.7048 139.604 77.0767 146.212 83.0579 148.709L83.6441 148.939L85.4562 149.596L85.0769 151.485C83.1488 161.077 89.0226 170.731 98.5896 173.293L98.0101 175.456L97.0172 175.163C86.8866 171.908 80.7898 161.445 82.8806 151.044C75.687 148.436 71.4506 140.86 73.085 133.33L73.2619 132.602ZM97.9492 150.808L105.196 123.77C105.476 122.725 104.856 121.651 103.81 121.37L84.067 116.082L87.5455 103.103C93.6538 80.3132 117.452 67.1098 140.221 74.3724C161.509 81.1616 173.061 104.173 167.283 125.731L164.121 137.526L144.378 132.237C143.332 131.957 142.258 132.578 141.978 133.623L134.731 160.661C134.451 161.706 135.071 162.78 136.117 163.061L135.537 165.223L135.129 165.092C133.27 164.386 132.16 162.461 132.477 160.501L132.567 160.08L139.814 133.042C140.377 130.943 142.435 129.644 144.538 129.985L144.958 130.074L162.538 134.783L165.119 125.15C170.525 104.983 159.947 83.5854 140.474 76.8173L139.54 76.505C117.995 69.633 95.4886 82.1198 89.7093 103.682L86.8106 114.497L104.39 119.206C106.632 119.807 107.96 122.11 107.36 124.349L100.113 151.387L99.9807 151.796C99.2754 153.652 97.3513 154.765 95.3888 154.446L94.9692 154.356L95.5488 152.193C96.5947 152.474 97.6688 151.852 97.9492 150.808ZM146.935 165.958L146.355 168.121L135.537 165.223L136.117 163.061L146.935 165.958Z"
              fill="url(#paint2_linear_1045_17595)"
            />
            <defs>
              <linearGradient
                id="paint0_linear_1045_17595"
                x1="59.8694"
                y1="20.3431"
                x2="177.224"
                y2="216.422"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#2995FF" />
                <stop offset="1" stop-color="#A54CFF" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_1045_17595"
                x1="147.864"
                y1="38.1187"
                x2="101.509"
                y2="211.168"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#F7FBFF" />
                <stop offset="0.5" stop-color="#F7FBFF" stop-opacity="0.9" />
                <stop offset="1" stop-color="#F7FBFF" stop-opacity="0.7" />
              </linearGradient>
              <linearGradient
                id="paint2_linear_1045_17595"
                x1="79.8749"
                y1="47.0669"
                x2="169.436"
                y2="202.234"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#F7FBFF" stop-opacity="0.6" />
                <stop offset="0.4927" stop-color="#F7FBFF" stop-opacity="0" />
                <stop offset="0.9971" stop-color="#F7FBFF" stop-opacity="0.3" />
              </linearGradient>
            </defs>
          </svg>

          <svg
            className="auth-page__floating-svg-2"
            width="149"
            height="149"
            viewBox="0 0 149 149"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clip-path="url(#clip0_1045_17598)">
              <rect
                x="12.4375"
                y="59.9844"
                width="90.6176"
                height="89.55"
                rx="22.6545"
                transform="rotate(-32.181 12.4375 59.9844)"
                fill="url(#paint0_linear_1045_17598)"
              />
              <g clip-path="url(#clip1_1045_17598)">
                <path
                  d="M58.2017 49.5363C71.8132 40.971 89.8564 45.0752 98.4228 58.688C106.988 72.2998 102.882 90.3444 89.271 98.9097C85.3429 101.382 80.8503 102.881 76.2277 103.276L76.0053 103.295L75.8565 103.46L67.913 112.215C67.716 112.429 67.4954 112.612 67.2565 112.763C66.5575 113.203 65.6999 113.357 64.8755 113.171L64.8747 113.171C63.7674 112.918 62.8795 112.085 62.556 110.999L59.1847 99.6715L59.1215 99.4574L58.9291 99.3443C54.9265 96.9866 51.5238 93.6874 49.0503 89.7566C40.4843 76.1437 44.5905 58.1016 58.2017 49.5363ZM64.3224 82.9894C63.0145 83.8125 62.6232 85.5385 63.4452 86.8448C64.2672 88.1512 65.9931 88.546 67.3011 87.723L83.6589 77.4295C84.9669 76.6064 85.3577 74.8797 84.5356 73.5733C83.7135 72.2669 81.9882 71.8729 80.6802 72.6959L64.3224 82.9894ZM58.7795 74.1809C57.4716 75.0041 57.0808 76.7309 57.9028 78.0372C58.725 79.3432 60.4504 79.7374 61.7583 78.9145L83.1487 65.4542C84.4567 64.6311 84.8486 62.9045 84.0268 61.5982C83.2047 60.2918 81.4781 59.8974 80.17 60.7206L58.7795 74.1809Z"
                  fill="url(#paint1_linear_1045_17598)"
                  stroke="url(#paint2_linear_1045_17598)"
                  stroke-width="1.13272"
                />
              </g>
            </g>
            <defs>
              <linearGradient
                id="paint0_linear_1045_17598"
                x1="12.4375"
                y1="62.7828"
                x2="94.4971"
                y2="143.23"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#12F0B6" />
                <stop offset="1" stop-color="#3B83ED" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_1045_17598"
                x1="57.9004"
                y1="49.0567"
                x2="89.5727"
                y2="99.3887"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#F7FBFF" />
                <stop offset="0.5" stop-color="#F7FBFF" stop-opacity="0.9" />
                <stop offset="1" stop-color="#F7FBFF" stop-opacity="0.7" />
              </linearGradient>
              <linearGradient
                id="paint2_linear_1045_17598"
                x1="44.7438"
                y1="67.6253"
                x2="102.73"
                y2="80.819"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#F7FBFF" stop-opacity="0.6" />
                <stop offset="0.4927" stop-color="#F7FBFF" stop-opacity="0" />
                <stop offset="0.9971" stop-color="#F7FBFF" stop-opacity="0.3" />
              </linearGradient>
              <clipPath id="clip0_1045_17598">
                <rect
                  width="107.462"
                  height="107.461"
                  fill="white"
                  transform="matrix(0.846355 -0.532601 0.532589 0.846386 0 57.2344)"
                />
              </clipPath>
              <clipPath id="clip1_1045_17598">
                <rect
                  width="58.7672"
                  height="58.7672"
                  fill="white"
                  transform="translate(34.1143 65.207) rotate(-32.1809)"
                />
              </clipPath>
            </defs>
          </svg>
        </div>

        <div className="auth-page__header" style={{ flexDirection: "row" }}>
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
        </div>

        <form className="auth-page__form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-page__error">
              <Typography variant="small">{error}</Typography>
            </div>
          )}

          <div className="auth-page__field">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
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
            Версия: 1.0.0
          </Typography>
        </div>
      </div>
      <div className="auth-page__glow">
        <svg
          width="318"
          height="318"
          viewBox="0 0 318 318"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g filter="url(#filter0_f_1635_19937)">
            <path
              d="M231.881 130.951C224.32 102.73 220.539 88.6201 210.702 80.6541C207.525 78.0814 203.963 76.0248 200.147 74.5598C188.33 70.0236 174.22 73.8044 146.001 81.3661L130.949 85.3992C102.729 92.9609 88.6196 96.7417 80.6539 106.579C78.0813 109.756 76.0248 113.318 74.5598 117.134C70.0238 128.952 73.8045 143.062 81.3659 171.282L85.3989 186.334C92.9603 214.555 96.7411 228.665 106.578 236.631C109.755 239.204 113.317 241.26 117.133 242.725C128.95 247.262 143.06 243.481 171.279 235.919L186.331 231.886C214.551 224.324 228.66 220.544 236.626 210.706C239.199 207.529 241.255 203.967 242.72 200.151C247.256 188.333 243.476 174.223 235.914 146.003L231.881 130.951Z"
              fill="url(#paint0_linear_1635_19937)"
            />
          </g>
          <defs>
            <filter
              id="filter0_f_1635_19937"
              x="9.91821e-05"
              y="-0.000389099"
              width="317.28"
              height="317.286"
              filterUnits="userSpaceOnUse"
              color-interpolation-filters="sRGB"
            >
              <feFlood flood-opacity="0" result="BackgroundImageFix" />
              <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="BackgroundImageFix"
                result="shape"
              />
              <feGaussianBlur
                stdDeviation="36.3"
                result="effect1_foregroundBlur_1635_19937"
              />
            </filter>
            <linearGradient
              id="paint0_linear_1635_19937"
              x1="214.993"
              y1="67.9205"
              x2="112.898"
              y2="238.451"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#0081FF" />
              <stop offset="1" stop-color="#A54CFF" />
            </linearGradient>
          </defs>
        </svg>

        <svg
          width="383"
          height="383"
          viewBox="0 0 383 383"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g filter="url(#filter0_f_1635_19939)">
            <rect
              width="153.506"
              height="153.604"
              rx="38.3764"
              transform="matrix(-0.846362 -0.53259 -0.5326 0.846379 297.164 167.188)"
              fill="url(#paint0_linear_1635_19939)"
            />
          </g>
          <defs>
            <filter
              id="filter0_f_1635_19939"
              x="0"
              y="0"
              width="382.597"
              height="382.627"
              filterUnits="userSpaceOnUse"
              color-interpolation-filters="sRGB"
            >
              <feFlood flood-opacity="0" result="BackgroundImageFix" />
              <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="BackgroundImageFix"
                result="shape"
              />
              <feGaussianBlur
                stdDeviation="50"
                result="effect1_foregroundBlur_1635_19939"
              />
            </filter>
            <linearGradient
              id="paint0_linear_1635_19939"
              x1="2.03009e-06"
              y1="4.80012"
              x2="140.71"
              y2="141.034"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#12F0B6" />
              <stop offset="1" stop-color="#0081FF" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
