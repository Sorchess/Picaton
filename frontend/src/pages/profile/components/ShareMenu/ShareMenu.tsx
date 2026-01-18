import { useState, useEffect, type FC } from "react";
import type { BusinessCard } from "@/entities/business-card";
import "./ShareMenu.scss";

interface ShareMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Business cards to display */
  cards: BusinessCard[];
  /** Callback when sharing is confirmed */
  onShare: (selectedCardIds: string[]) => void;
  /** Initially selected card IDs */
  initialSelectedIds?: string[];
}

// QR Code icon for header
const QRCodeIcon = () => (
  <svg width="65" height="65" viewBox="0 0 65 65" fill="none">
    <rect
      x="5"
      y="5"
      width="25"
      height="25"
      rx="5"
      stroke="black"
      strokeOpacity="0.3"
      strokeWidth="3"
    />
    <rect
      x="12"
      y="12"
      width="11"
      height="11"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
    <rect
      x="35"
      y="5"
      width="25"
      height="25"
      rx="5"
      stroke="black"
      strokeOpacity="0.3"
      strokeWidth="3"
    />
    <rect
      x="42"
      y="12"
      width="11"
      height="11"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
    <rect
      x="5"
      y="35"
      width="25"
      height="25"
      rx="5"
      stroke="black"
      strokeOpacity="0.3"
      strokeWidth="3"
    />
    <rect
      x="12"
      y="42"
      width="11"
      height="11"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
    <rect
      x="35"
      y="35"
      width="10"
      height="10"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
    <rect
      x="50"
      y="35"
      width="10"
      height="10"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
    <rect
      x="42"
      y="42"
      width="8"
      height="8"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
    <rect
      x="35"
      y="50"
      width="10"
      height="10"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
    <rect
      x="50"
      y="50"
      width="10"
      height="10"
      rx="2"
      fill="black"
      fillOpacity="0.3"
    />
  </svg>
);

// Checkmark icon for selected cards
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="9" fill="#0081FF" />
    <path
      d="M5.5 9L8 11.5L12.5 6.5"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Arrow icon for card item
const ArrowIcon = () => (
  <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
    <path
      d="M1 1L7 7L1 13"
      stroke="black"
      strokeOpacity="0.3"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Plus icon for add button
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path
      d="M7.5 1V14M1 7.5H14"
      stroke="#0081FF"
      strokeOpacity="0.3"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

type ViewTab = "settings" | "preview";

/**
 * Share menu component for selecting business cards to share
 * Based on Figma design with QR code icons and card selection
 */
export const ShareMenu: FC<ShareMenuProps> = ({
  isOpen,
  onClose,
  cards,
  onShare,
  initialSelectedIds = [],
}) => {
  const [selectedCardIds, setSelectedCardIds] =
    useState<string[]>(initialSelectedIds);
  const [activeTab, setActiveTab] = useState<ViewTab>("settings");
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle animation
  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout>;
    let animationFrame: number;
    let hideTimer: ReturnType<typeof setTimeout>;

    if (isOpen) {
      showTimer = setTimeout(() => {
        setIsVisible(true);
        animationFrame = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAnimating(true);
          });
        });
      }, 0);
      document.body.style.overflow = "hidden";
    } else if (isVisible) {
      hideTimer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(() => setIsVisible(false), 300);
      }, 0);
      document.body.style.overflow = "";
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isOpen, isVisible]);

  // Reset selection when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedCardIds(
        initialSelectedIds.length > 0
          ? initialSelectedIds
          : cards.filter((c) => c.is_primary).map((c) => c.id),
      );
    }
  }, [isOpen, initialSelectedIds, cards]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  };

  const handleShare = () => {
    onShare(selectedCardIds);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`share-menu-overlay ${isAnimating ? "share-menu-overlay--active" : ""}`}
      onClick={onClose}
    >
      <div
        className={`share-menu ${isAnimating ? "share-menu--active" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* QR Code Icons Header */}
        <div className="share-menu__qr-header">
          <QRCodeIcon />
          <QRCodeIcon />
        </div>

        {/* Tab Switcher */}
        <div className="share-menu__tabs">
          <button
            type="button"
            className={`share-menu__tab ${activeTab === "settings" ? "share-menu__tab--active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Настройки
          </button>
          <button
            type="button"
            className={`share-menu__tab ${activeTab === "preview" ? "share-menu__tab--active" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            Посмотреть
          </button>
        </div>

        {/* Cards List */}
        <div className="share-menu__cards">
          {cards.map((card) => (
            <div
              key={card.id}
              className="share-menu__card"
              onClick={() => toggleCardSelection(card.id)}
            >
              <div className="share-menu__card-check">
                {selectedCardIds.includes(card.id) ? (
                  <CheckIcon />
                ) : (
                  <div className="share-menu__card-check-empty" />
                )}
              </div>
              <div className="share-menu__card-info">
                <span className="share-menu__card-title">
                  {card.title || "Визитка"}
                </span>
              </div>
              <div className="share-menu__card-arrow">
                <ArrowIcon />
              </div>
            </div>
          ))}

          {/* Add New Card Button */}
          <div className="share-menu__add-card">
            <span className="share-menu__add-card-text">
              Создать новую визитку
            </span>
            <button
              type="button"
              className="share-menu__add-card-btn"
              aria-label="Создать новую визитку"
            >
              <PlusIcon />
            </button>
          </div>
        </div>

        {/* Duration Selector */}
        <div className="share-menu__duration">
          <div className="share-menu__duration-options">
            <span className="share-menu__duration-option">1 день</span>
            <span className="share-menu__duration-option">1 неделя</span>
            <span className="share-menu__duration-option">1 месяц</span>
            <span className="share-menu__duration-option share-menu__duration-option--infinity">
              ∞
            </span>
          </div>
          <div className="share-menu__duration-slider">
            <div className="share-menu__duration-track" />
            <div className="share-menu__duration-handle" />
          </div>
        </div>

        {/* Help Text */}
        <div className="share-menu__help">
          <span className="share-menu__help-text">
            Организуйте и выбирайте нужные визитки
          </span>
          <button
            type="button"
            className="share-menu__share-btn"
            onClick={handleShare}
            disabled={selectedCardIds.length === 0}
            aria-label="Поделиться выбранными визитками"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
