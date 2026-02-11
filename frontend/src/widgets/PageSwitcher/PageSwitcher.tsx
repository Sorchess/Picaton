import { useState, useRef, useEffect } from "react";
import { TapBar, type TapBarOption } from "@/shared";
import "./PageSwitcher.scss";

type PageType = "collaboration" | "contacts" | "chats" | "profile" | "company";

interface PageSwitcherProps {
  value: PageType;
  onChange: (page: PageType) => void;
  /** Called when search is submitted from the tab bar */
  onSearchSubmit?: (query: string) => void;
}

/** Tabs WITHOUT contacts — contacts is a separate button */
const pageOptions: TapBarOption[] = [
  {
    value: "collaboration",
    label: "Коллаб",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2v1" />
        <path d="M12 21v1" />
        <path d="m4.93 4.93.71.71" />
        <path d="m18.36 18.36.71.71" />
        <path d="M2 12h1" />
        <path d="M21 12h1" />
        <path d="m4.93 19.07.71-.71" />
        <path d="m18.36 5.64.71-.71" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    value: "chats",
    label: "Чаты",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    value: "profile",
    label: "Профиль",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    value: "company",
    label: "Компания",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9h.01" />
        <path d="M9 12h.01" />
        <path d="M9 15h.01" />
        <path d="M9 18h.01" />
      </svg>
    ),
  },
];

export function PageSwitcher({
  value,
  onChange,
  onSearchSubmit,
}: PageSwitcherProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when search opens
  useEffect(() => {
    if (isSearchOpen) {
      // small delay so the transition plays first
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isSearchOpen]);

  const handleSearchClick = () => {
    if (isSearchOpen) return;
    setIsSearchOpen(true);
    // Navigate to contacts page when search opens
    onChange("contacts");
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleSubmit = () => {
    if (!searchQuery.trim()) return;
    onSearchSubmit?.(searchQuery.trim());
    handleCloseSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") handleCloseSearch();
  };

  // Determine if contacts tab is active (for the separate button highlight)
  const isContactsActive = value === "contacts" && !isSearchOpen;

  return (
    <div
      className={`page-switcher-wrapper ${isSearchOpen ? "page-switcher-wrapper--search-open" : ""}`}
    >
      {/* Search mode — replaces the tab bar */}
      {isSearchOpen && (
        <div className="page-switcher-search">
          <div className="page-switcher-search__field">
            <svg
              className="page-switcher-search__icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="page-switcher-search__input"
              placeholder="Поиск по навыкам, имени..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {searchQuery && (
              <button
                className="page-switcher-search__clear"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                ✕
              </button>
            )}
          </div>
          <button
            className="page-switcher-search__submit"
            onClick={handleSubmit}
            disabled={!searchQuery.trim()}
            type="button"
          >
            Найти
          </button>
        </div>
      )}

      {/* Normal mode — tab bar */}
      {!isSearchOpen && (
        <TapBar
          options={pageOptions}
          value={value === "contacts" ? "" : value}
          onChange={(val) => onChange(val as PageType)}
          size="lg"
          className="page-switcher"
        />
      )}

      {/* Circular button — always visible, toggles between search icon and close icon */}
      <button
        className={`page-switcher-contacts ${isContactsActive ? "page-switcher-contacts--active" : ""} ${isSearchOpen ? "page-switcher-contacts--close" : ""}`}
        onClick={isSearchOpen ? handleCloseSearch : handleSearchClick}
        type="button"
        aria-label={isSearchOpen ? "Закрыть поиск" : "Контакты и поиск"}
      >
        {isSearchOpen ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export type { PageType };
