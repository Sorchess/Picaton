import { useState, useEffect, useRef, type FC } from "react";
import { IconButton, Modal, Button } from "@/shared";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import { useAuth } from "@/features/auth";
import { getFullName } from "@/entities/user";
import { QrModal } from "@/features/qr-modal";
import "./ShareContactPage.scss";

// Типы длительности
export type DurationOption = "1d" | "1w" | "1m" | "forever";

// Опции длительности
const DURATION_OPTIONS: { value: DurationOption; label: string }[] = [
  { value: "1d", label: "1 день" },
  { value: "1w", label: "1 неделя" },
  { value: "1m", label: "1 месяц" },
  { value: "forever", label: "∞" },
];

interface ShareContactPageProps {
  /** Business cards to display */
  cards: BusinessCard[];
  /** Callback to go back */
  onBack: () => void;
  /** Initially selected card IDs */
  initialSelectedIds?: string[];
}

// QR Code icon for header
const QRCodeIcon = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    <rect
      x="5"
      y="5"
      width="45"
      height="45"
      rx="8"
      stroke="currentColor"
      strokeOpacity="0.3"
      strokeWidth="4"
    />
    <rect
      x="18"
      y="18"
      width="19"
      height="19"
      rx="3"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <rect
      x="70"
      y="5"
      width="45"
      height="45"
      rx="8"
      stroke="currentColor"
      strokeOpacity="0.3"
      strokeWidth="4"
    />
    <rect
      x="83"
      y="18"
      width="19"
      height="19"
      rx="3"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <rect
      x="5"
      y="70"
      width="45"
      height="45"
      rx="8"
      stroke="currentColor"
      strokeOpacity="0.3"
      strokeWidth="4"
    />
    <rect
      x="18"
      y="83"
      width="19"
      height="19"
      rx="3"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <rect
      x="70"
      y="70"
      width="18"
      height="18"
      rx="3"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <rect
      x="95"
      y="70"
      width="18"
      height="18"
      rx="3"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <rect
      x="83"
      y="83"
      width="12"
      height="12"
      rx="2"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <rect
      x="70"
      y="95"
      width="18"
      height="18"
      rx="3"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <rect
      x="95"
      y="95"
      width="18"
      height="18"
      rx="3"
      fill="currentColor"
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

// Share arrow icon
const ShareArrowIcon = () => (
  <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
    <path
      d="M12.918 18.0312C12.54 18.0312 12.225 17.9076 11.971 17.6602C11.723 17.4128 11.6 17.1035 11.6 16.7324V13.207H11.355C10.164 13.207 9.116 13.334 8.211 13.5879C7.306 13.8418 6.512 14.2552 5.828 14.8281C5.145 15.401 4.546 16.1693 4.031 17.1328C3.842 17.4844 3.631 17.7155 3.396 17.8262C3.169 17.9368 2.928 17.9922 2.674 17.9922C2.335 17.9922 2.049 17.8359 1.814 17.5234C1.587 17.2174 1.473 16.7617 1.473 16.1562C1.473 14.3854 1.671 12.7969 2.068 11.3906C2.465 9.9779 3.068 8.7734 3.875 7.7773C4.689 6.7812 5.714 6.0228 6.951 5.502C8.195 4.9746 9.663 4.7109 11.355 4.7109H11.6V1.2148C11.6 0.8438 11.723 0.528 11.971 0.2676C12.225 0.0007 12.544 -0.1328 12.928 -0.1328C13.188 -0.1328 13.423 -0.0742 13.631 0.043C13.846 0.1536 14.093 0.3424 14.373 0.6094L22.107 7.8164C22.296 7.9922 22.43 8.181 22.508 8.3828C22.592 8.5781 22.635 8.7669 22.635 8.9492C22.635 9.125 22.592 9.3138 22.508 9.5156C22.43 9.7174 22.296 9.9062 22.107 10.082L14.373 17.3477C14.119 17.5885 13.875 17.7611 13.641 17.8652C13.413 17.9759 13.172 18.0312 12.918 18.0312Z"
      fill="black"
    />
  </svg>
);

type ViewTab = "settings" | "preview";

/**
 * Share contact page component for selecting business cards to share
 * Based on Figma design with QR code icons and card selection
 */
export const ShareContactPage: FC<ShareContactPageProps> = ({
  cards,
  onBack,
  initialSelectedIds = [],
}) => {
  const { user } = useAuth();
  const [localCards, setLocalCards] = useState<BusinessCard[]>(cards);
  const [selectedCardIds, setSelectedCardIds] =
    useState<string[]>(initialSelectedIds);
  const [activeTab, setActiveTab] = useState<ViewTab>("settings");
  const [durationIndex, setDurationIndex] = useState(1); // Default to "1w" (1 week)
  const sliderRef = useRef<HTMLDivElement>(null);

  // Create card modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // QR modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCardName, setQrCardName] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Set initial selection
  useEffect(() => {
    if (initialSelectedIds.length > 0) {
      setSelectedCardIds(initialSelectedIds);
    } else {
      const primaryCards = localCards
        .filter((c) => c.is_primary)
        .map((c) => c.id);
      setSelectedCardIds(primaryCards);
    }
  }, [initialSelectedIds, localCards]);

  // Sync local cards with prop
  useEffect(() => {
    setLocalCards(cards);
  }, [cards]);

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  };

  // Create new card
  const handleCreateCard = async () => {
    if (!user || !newCardTitle.trim()) return;
    setIsCreating(true);
    try {
      const newCard = await businessCardApi.create(user.id, {
        title: newCardTitle.trim(),
      });
      setLocalCards((prev) => [...prev, newCard]);
      setSelectedCardIds((prev) => [...prev, newCard.id]);
      setNewCardTitle("");
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания карточки");
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    if (selectedCardIds.length === 0 || !user) return;

    setIsGenerating(true);
    setError(null);

    try {
      const duration = DURATION_OPTIONS[durationIndex].value;
      // Для простоты показываем QR первой выбранной визитки
      const firstSelectedCard = localCards.find((c) =>
        selectedCardIds.includes(c.id),
      );
      if (firstSelectedCard) {
        const qr = await businessCardApi.getQRCode(
          firstSelectedCard.id,
          duration,
        );
        setQrCodeImage(qr.image_base64);
        setQrCardName(firstSelectedCard.title || getFullName(user));
        setShowQrModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации QR");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="share-contact-page">
      {/* Toast для ошибок */}
      {error && (
        <div
          className="share-contact-page__toast"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {/* Header with back and share buttons */}
      <div className="share-contact-page__header">
        <IconButton onClick={onBack} aria-label="Назад">
          <BackArrowIcon />
        </IconButton>

        <span className="share-contact-page__header-title">Изменить</span>

        <IconButton
          onClick={handleShare}
          disabled={selectedCardIds.length === 0 || isGenerating}
          aria-label="Поделиться"
        >
          <ShareArrowIcon />
        </IconButton>
      </div>

      {/* Content */}
      <div className="share-contact-page__content">
        {/* QR Code Icons */}
        <div className="share-contact-page__qr-header">
          <QRCodeIcon />
        </div>

        {/* Tab Switcher */}
        <div className="share-contact-page__tabs">
          <button
            type="button"
            className={`share-contact-page__tab ${activeTab === "settings" ? "share-contact-page__tab--active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Настройки
          </button>
          <button
            type="button"
            className={`share-contact-page__tab ${activeTab === "preview" ? "share-contact-page__tab--active" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            Посмотреть
          </button>
        </div>

        {/* Section Label */}
        <div className="share-contact-page__section-label">
          Название ссылки / QR
        </div>

        {/* Cards List */}
        <div className="share-contact-page__cards">
          {localCards.map((card) => (
            <div
              key={card.id}
              className="share-contact-page__card"
              onClick={() => toggleCardSelection(card.id)}
            >
              <div className="share-contact-page__card-check">
                {selectedCardIds.includes(card.id) ? (
                  <CheckIcon />
                ) : (
                  <div className="share-contact-page__card-check-empty" />
                )}
              </div>
              <div className="share-contact-page__card-info">
                <span className="share-contact-page__card-title">
                  {card.is_primary ? "Личный" : card.title || "Визитка"}
                </span>
              </div>
              <div className="share-contact-page__card-arrow">
                <ArrowIcon />
              </div>
            </div>
          ))}

          {/* Add New Card Button */}
          <div
            className="share-contact-page__add-card"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="share-contact-page__add-card-text">
              Создать новую визитку
            </span>
            <button
              type="button"
              className="share-contact-page__add-card-btn"
              aria-label="Создать новую визитку"
            >
              <PlusIcon />
            </button>
          </div>
        </div>

        {/* Duration Label */}
        <div className="share-contact-page__duration-label">
          Ограничение по времени
        </div>

        {/* Duration Selector */}
        <div className="share-contact-page__duration">
          <div className="share-contact-page__duration-options">
            {DURATION_OPTIONS.map((option, index) => (
              <button
                key={option.value}
                type="button"
                className={`share-contact-page__duration-option ${
                  index === durationIndex
                    ? "share-contact-page__duration-option--active"
                    : ""
                } ${option.value === "forever" ? "share-contact-page__duration-option--infinity" : ""}`}
                onClick={() => setDurationIndex(index)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div
            ref={sliderRef}
            className="share-contact-page__duration-slider"
            onClick={handleSliderClick}
          >
            <div className="share-contact-page__duration-track">
              {DURATION_OPTIONS.map((_, index) => (
                <div
                  key={index}
                  className="share-contact-page__duration-tick"
                  style={{
                    left: `${(index / (DURATION_OPTIONS.length - 1)) * 100}%`,
                  }}
                />
              ))}
            </div>
            <div
              className="share-contact-page__duration-handle"
              style={{
                left: `${(durationIndex / (DURATION_OPTIONS.length - 1)) * 100}%`,
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            />
          </div>
        </div>

        {/* Bottom section with share button */}
        <div className="share-contact-page__bottom">
          <button
            type="button"
            className="share-contact-page__share-button"
            onClick={handleShare}
            disabled={selectedCardIds.length === 0 || isGenerating}
          >
            {isGenerating ? "Генерация..." : "Создать ссылку / QR"}
          </button>
        </div>
      </div>

      {/* Create Card Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Новая визитка"
      >
        <div className="share-contact-page__create-modal">
          <p className="share-contact-page__create-hint">
            Придумайте название для вашей визитки. Например: "Разработчик",
            "Дизайнер" или "Личная"
          </p>
          <input
            type="text"
            className="share-contact-page__create-input"
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            placeholder="Название визитки"
            maxLength={50}
          />
          <div className="share-contact-page__create-actions">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateCard}
              disabled={!newCardTitle.trim() || isCreating}
            >
              {isCreating ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Code Modal */}
      {qrCodeImage && (
        <QrModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          qrCodeImage={qrCodeImage}
          userName={qrCardName}
        />
      )}
    </div>
  );
};
