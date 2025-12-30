import { useState } from "react";
import { ThemeProvider, ThemeToggle } from "./shared";
import { PageSwitcher } from "./widgets";
import type { PageType } from "./widgets";
import { SearchPage, ContactsPage, ProfilePage, LoginPage } from "./pages";
import { AuthProvider, useAuth } from "./features/auth";
import "./App.scss";

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageType>("search");

  return (
    <div className="app">
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

        <PageSwitcher value={currentPage} onChange={setCurrentPage} />

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
      </main>
    </div>
  );
}

function UnauthenticatedApp() {
  return (
    <div className="app">
      <LoginPage />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

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
