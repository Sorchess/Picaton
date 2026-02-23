import { useState, useEffect, useRef, type FC } from "react";
import type { BusinessCard } from "@/entities/business-card";
import { useI18n } from "@/shared/config";
import "./ShareMenu.scss";

// Типы длительности
export type DurationOption = "1d" | "1w" | "1m" | "forever";

// Опции длительности
const DURATION_OPTIONS: {
  value: DurationOption;
  labelKey: string;
  fallback: string;
}[] = [
  { value: "1d", labelKey: "share.day1", fallback: "1 day" },
  { value: "1w", labelKey: "share.week1", fallback: "1 week" },
  { value: "1m", labelKey: "share.month1", fallback: "1 month" },
  { value: "forever", labelKey: "", fallback: "∞" },
];

interface ShareMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Business cards to display */
  cards: BusinessCard[];
  /** Callback when sharing is confirmed */
  onShare: (selectedCardIds: string[], duration: DurationOption) => void;
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

// Share arrow icon for share button
const ShareArrowIcon = () => (
  <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
    <path
      d="M12.918 18.0312C12.54 18.0312 12.225 17.9076 11.971 17.6602C11.723 17.4128 11.6 17.1035 11.6 16.7324V13.207H11.355C10.164 13.207 9.116 13.334 8.211 13.5879C7.306 13.8418 6.512 14.2552 5.828 14.8281C5.145 15.401 4.546 16.1693 4.031 17.1328C3.842 17.4844 3.631 17.7155 3.396 17.8262C3.169 17.9368 2.928 17.9922 2.674 17.9922C2.335 17.9922 2.049 17.8359 1.814 17.5234C1.587 17.2174 1.473 16.7617 1.473 16.1562C1.473 14.3854 1.671 12.7969 2.068 11.3906C2.465 9.9779 3.068 8.7734 3.875 7.7773C4.689 6.7812 5.714 6.0228 6.951 5.502C8.195 4.9746 9.663 4.7109 11.355 4.7109H11.6V1.2148C11.6 0.8438 11.723 0.528 11.971 0.2676C12.225 0.0007 12.544 -0.1328 12.928 -0.1328C13.188 -0.1328 13.423 -0.0742 13.631 0.043C13.846 0.1536 14.093 0.3424 14.373 0.6094L22.107 7.8164C22.296 7.9922 22.43 8.181 22.508 8.3828C22.592 8.5781 22.635 8.7669 22.635 8.9492C22.635 9.125 22.592 9.3138 22.508 9.5156C22.43 9.7174 22.296 9.9062 22.107 10.082L14.373 17.3477C14.119 17.5885 13.875 17.7611 13.641 17.8652C13.413 17.9759 13.172 18.0312 12.918 18.0312Z"
      fill="black"
    />
  </svg>
);

// Back arrow icon
const BackArrowIcon = () => (
  <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
    <path
      d="M9 1L1 9L9 17"
      stroke="black"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
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
  const { t } = useI18n();

  const [selectedCardIds, setSelectedCardIds] =
    useState<string[]>(initialSelectedIds);
  const [activeTab, setActiveTab] = useState<ViewTab>("settings");
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [durationIndex, setDurationIndex] = useState(1); // Default to "1w" (1 week)
  const sliderRef = useRef<HTMLDivElement>(null);

  // Calculate duration index from position
  const calculateIndexFromPosition = (clientX: number) => {
    if (!sliderRef.current) return durationIndex;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(percentage * (DURATION_OPTIONS.length - 1));
  };

  // Handle slider track click
  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const newIndex = calculateIndexFromPosition(e.clientX);
    setDurationIndex(newIndex);
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX =
        "touches" in moveEvent
          ? moveEvent.touches[0].clientX
          : moveEvent.clientX;
      const newIndex = calculateIndexFromPosition(clientX);
      setDurationIndex(newIndex);
    };

    const handleEnd = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove);
    document.addEventListener("touchend", handleEnd);
  };

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
    const duration = DURATION_OPTIONS[durationIndex].value;
    onShare(selectedCardIds, duration);
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
        {/* Header with back and share buttons */}
        <div className="share-menu__header">
          <button
            type="button"
            className="share-menu__back-btn"
            onClick={onClose}
            aria-label={t("common.back")}
          >
            <BackArrowIcon />
          </button>
          <button
            type="button"
            className="share-menu__share-btn"
            onClick={handleShare}
            disabled={selectedCardIds.length === 0}
            aria-label={t("common.share")}
          >
            <ShareArrowIcon />
          </button>
        </div>

        {/* Content */}
        <div className="share-menu__content">
          {/* QR Code Icons */}
          <div className="share-menu__qr-header">
            <QRCodeIcon />
          </div>

          {/* Tab Switcher */}
          <div className="share-menu__tabs">
            <button
              type="button"
              className={`share-menu__tab ${activeTab === "settings" ? "share-menu__tab--active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              {t("share.settings")}
            </button>
            <button
              type="button"
              className={`share-menu__tab ${activeTab === "preview" ? "share-menu__tab--active" : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              {t("share.preview")}
            </button>
          </div>

          {/* Section Label */}
          <div className="share-menu__section-label">{t("share.linkName")}</div>

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
                    {card.title || t("share.cardFallback")}
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
                {t("share.createNewCard")}
              </span>
              <button
                type="button"
                className="share-menu__add-card-btn"
                aria-label={t("share.createNewCard")}
              >
                <PlusIcon />
              </button>
            </div>
          </div>

          {/* Duration Label */}
          <div className="share-menu__section-label">
            {t("share.timeLimit")}
          </div>

          {/* Duration Selector */}
          <div className="share-menu__duration">
            <div className="share-menu__duration-options">
              {DURATION_OPTIONS.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={`share-menu__duration-option ${
                    index === durationIndex
                      ? "share-menu__duration-option--active"
                      : ""
                  } ${option.value === "forever" ? "share-menu__duration-option--infinity" : ""}`}
                  onClick={() => setDurationIndex(index)}
                >
                  {option.labelKey ? t(option.labelKey) : option.fallback}
                </button>
              ))}
            </div>
            <div
              ref={sliderRef}
              className="share-menu__duration-slider"
              onClick={handleSliderClick}
            >
              <div className="share-menu__duration-track" />
              <div
                className="share-menu__duration-handle"
                style={{
                  left: `${(durationIndex / (DURATION_OPTIONS.length - 1)) * 100}%`,
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
