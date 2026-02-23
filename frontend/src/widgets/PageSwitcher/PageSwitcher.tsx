import { useState, useRef, useEffect, useMemo } from "react";
import { TapBar, type TapBarOption } from "@/shared";
import { useI18n } from "@/shared/config";
import "./PageSwitcher.scss";

type PageType = "contacts" | "chats" | "profile" | "settings";

interface PageSwitcherProps {
  value: PageType;
  onChange: (page: PageType) => void;
  /** Called when search is submitted from the tab bar */
  onSearchSubmit?: (query: string) => void;
}

/** Tabs WITHOUT contacts — contacts is a separate button */
function usePageOptions(): TapBarOption[] {
  const { t } = useI18n();
  return useMemo(
    () => [
      {
        value: "chats",
        label: t("nav.chats"),
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
        label: t("nav.profile"),
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
        value: "settings",
        label: t("nav.settings"),
        icon: (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
    ],
    [t],
  );
}

export function PageSwitcher({
  value,
  onChange,
  onSearchSubmit,
}: PageSwitcherProps) {
  const { t } = useI18n();
  const pageOptions = usePageOptions();
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
              placeholder={t("search.placeholder")}
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
            {t("common.search")}
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
        aria-label={isSearchOpen ? t("common.close") : t("nav.contacts")}
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
