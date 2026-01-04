import { useState, useEffect } from "react";
import { ThemeProvider, ThemeToggle } from "./shared";
import { PageSwitcher } from "./widgets";
import type { PageType } from "./widgets";
import {
  SearchPage,
  ContactsPage,
  ProfilePage,
  LoginPage,
  OnboardingPage,
  CompanyPage,
} from "./pages";
import { AuthProvider, useAuth } from "./features/auth";
import { SpecialistModal } from "./features/specialist-modal";
import { companyApi } from "./entities/company";
import type { UserPublic } from "./entities/user";
import { userApi } from "./entities/user";
import "./App.scss";

// Парсинг URL для получения токена приглашения
function getInviteTokenFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/invite\/([^/]+)$/);
  return match ? match[1] : null;
}

// Парсинг URL для получения ID пользователя из QR кода
function getUserIdFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/users\/([^/]+)$/);
  return match ? match[1] : null;
}

// Сохранение токена для использования после авторизации
function saveInviteToken(token: string) {
  sessionStorage.setItem("pendingInviteToken", token);
}

function getPendingInviteToken(): string | null {
  return sessionStorage.getItem("pendingInviteToken");
}

function clearPendingInviteToken() {
  sessionStorage.removeItem("pendingInviteToken");
}

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageType>("search");
  const [inviteProcessing, setInviteProcessing] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // User QR code modal state
  const [qrUser, setQrUser] = useState<UserPublic | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLoadingQrUser, setIsLoadingQrUser] = useState(false);

  // Обработка приглашения из URL или сохраненного токена
  useEffect(() => {
    const urlToken = getInviteTokenFromUrl();
    const pendingToken = getPendingInviteToken();
    const token = urlToken || pendingToken;

    if (token && !inviteProcessing) {
      setInviteProcessing(true);
      // Очищаем сохраненный токен
      clearPendingInviteToken();

      companyApi
        .acceptInvitation({ token })
        .then(() => {
          setInviteMessage({
            type: "success",
            text: "Вы успешно присоединились к компании!",
          });
          setCurrentPage("company");
          // Очищаем URL
          window.history.replaceState({}, "", "/");
        })
        .catch((err) => {
          const errorMessage =
            err?.data?.detail ||
            err?.message ||
            "Не удалось принять приглашение";
          setInviteMessage({ type: "error", text: errorMessage });
          window.history.replaceState({}, "", "/");
        })
        .finally(() => {
          setInviteProcessing(false);
        });
    }
  }, []);

  // Обработка ссылки на пользователя из QR кода
  useEffect(() => {
    const userId = getUserIdFromUrl();
    if (userId && !isLoadingQrUser && !qrUser) {
      setIsLoadingQrUser(true);
      userApi
        .getPublic(userId)
        .then((userData) => {
          setQrUser(userData);
          setIsQrModalOpen(true);
          // Очищаем URL
          window.history.replaceState({}, "", "/");
        })
        .catch((err) => {
          const errorMessage =
            err?.data?.detail ||
            err?.message ||
            "Не удалось загрузить профиль пользователя";
          setInviteMessage({ type: "error", text: errorMessage });
          window.history.replaceState({}, "", "/");
        })
        .finally(() => {
          setIsLoadingQrUser(false);
        });
    }
  }, []);

  // Автоскрытие сообщения
  useEffect(() => {
    if (inviteMessage) {
      const timer = setTimeout(() => setInviteMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [inviteMessage]);

  // Показываем загрузку при обработке приглашения
  if (inviteProcessing) {
    return (
      <div className="app app--loading">
        <div className="app__loader">
          <div className="app__spinner" />
          <span>Принимаем приглашение...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Уведомление о приглашении */}
      {inviteMessage && (
        <div
          className={`app__invite-notification app__invite-notification--${inviteMessage.type}`}
        >
          <span>{inviteMessage.text}</span>
          <button onClick={() => setInviteMessage(null)}>×</button>
        </div>
      )}

      <header className="app__header">
        <div className="app__logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient
                id="logoGradient"
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
            <circle cx="16" cy="16" r="14" fill="url(#logoGradient)" />
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
          <span className="app__logo-text">Picaton</span>
        </div>

        <div className="app__page-switcher app__page-switcher--desktop">
          <PageSwitcher value={currentPage} onChange={setCurrentPage} />
        </div>

        <div className="app__actions">
          <span className="app__user">{user?.first_name}</span>
          <button className="app__logout" onClick={logout} title="Выйти">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="app__main">
        {currentPage === "search" && <SearchPage />}
        {currentPage === "contacts" && <ContactsPage />}
        {currentPage === "profile" && <ProfilePage />}
        {currentPage === "company" && <CompanyPage />}
      </main>

      {/* Мобильный футер с навигацией */}
      <footer className="app__footer">
        <PageSwitcher value={currentPage} onChange={setCurrentPage} />
      </footer>

      {/* User QR Code Modal */}
      {qrUser && (
        <SpecialistModal
          user={qrUser}
          isOpen={isQrModalOpen}
          onClose={() => {
            setIsQrModalOpen(false);
            setQrUser(null);
          }}
          onSaveContact={async (savedUser) => {
            if (!user?.id) return;
            try {
              await userApi.saveContact(user.id, savedUser.id);
              setInviteMessage({
                type: "success",
                text: "Контакт сохранен!",
              });
              // Закрываем модальное окно после сохранения
              setIsQrModalOpen(false);
              setQrUser(null);
            } catch (err) {
              setInviteMessage({
                type: "error",
                text: "Не удалось сохранить контакт",
              });
            }
          }}
        />
      )}
    </div>
  );
}

function UnauthenticatedApp() {
  // Сохраняем токен приглашения для использования после авторизации
  useEffect(() => {
    const token = getInviteTokenFromUrl();
    if (token) {
      saveInviteToken(token);
      // Очищаем URL
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="app">
      <LoginPage />
    </div>
  );
}

// Проверяем, нужно ли показывать онбординг (новый пользователь без имени)
function needsOnboarding(user: ReturnType<typeof useAuth>["user"]): boolean {
  if (!user) return false;
  // Если у пользователя нет имени или фамилии — показываем онбординг
  return !user.first_name?.trim() || !user.last_name?.trim();
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="app app--loading">
        <div className="app__loader">
          <div className="app__spinner" />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  // Показываем онбординг для новых пользователей
  if (isAuthenticated && needsOnboarding(user)) {
    return (
      <div className="app">
        <OnboardingPage />
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
