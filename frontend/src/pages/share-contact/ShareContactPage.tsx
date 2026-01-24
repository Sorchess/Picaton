import { useState, useEffect, useRef, type FC } from "react";
import { IconButton, Modal, Button, Tabs } from "@/shared";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import { useAuth } from "@/features/auth";
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
  /** Callback to open/edit a card */
  onOpenCard?: (card: BusinessCard) => void;
  /** Callback to preview selected card (opens full profile page) */
  onPreview?: (cardId: string) => void;
  /** Initially selected card IDs */
  initialSelectedIds?: string[];
}

// QR Code icon for header
const QRCodeIcon = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.8104 54.9865C9.18531 54.9865 5.71654 53.8302 3.40402 51.5177C1.13433 49.2052 -0.000521637 45.6508 -0.000521637 40.8544V14.0678C-0.000521637 9.27143 1.13433 5.73842 3.40402 3.46872C5.71654 1.15621 9.18531 -5.26756e-05 13.8104 -5.26756e-05H41.1109C45.736 -5.26756e-05 49.2047 1.15621 51.5172 3.46872C53.8298 5.73842 54.986 9.27143 54.986 14.0678V40.8544C54.986 45.6508 53.8298 49.2052 51.5172 51.5177C49.2047 53.8302 45.736 54.9865 41.1109 54.9865H13.8104ZM13.6176 44.7729H41.3036C42.4599 44.7729 43.3378 44.4731 43.9373 43.8736C44.5369 43.274 44.8366 42.3747 44.8366 41.1756V13.6823C44.8366 12.4833 44.5369 11.6054 43.9373 11.0486C43.3378 10.4491 42.4599 10.1493 41.3036 10.1493H13.6176C12.4614 10.1493 11.5835 10.4491 10.9839 11.0486C10.4272 11.6054 10.1489 12.4833 10.1489 13.6823V41.1756C10.1489 42.3747 10.4272 43.274 10.9839 43.8736C11.5835 44.4731 12.4614 44.7729 13.6176 44.7729ZM21.7115 34.5592C20.8121 34.5592 20.3625 34.0239 20.3625 32.9533V21.8404C20.3625 20.8554 20.8121 20.363 21.7115 20.363H33.1456C34.0877 20.363 34.5588 20.8554 34.5588 21.8404V32.9533C34.5588 34.0239 34.0877 34.5592 33.1456 34.5592H21.7115ZM78.8178 54.9865C74.1928 54.9865 70.724 53.8302 68.4115 51.5177C66.099 49.2052 64.9427 45.6508 64.9427 40.8544V14.0678C64.9427 9.27143 66.099 5.73842 68.4115 3.46872C70.724 1.15621 74.1928 -5.26756e-05 78.8178 -5.26756e-05H106.118C110.743 -5.26756e-05 114.191 1.15621 116.46 3.46872C118.773 5.73842 119.929 9.27143 119.929 14.0678V40.8544C119.929 45.6508 118.773 49.2052 116.46 51.5177C114.191 53.8302 110.743 54.9865 106.118 54.9865H78.8178ZM78.6251 44.7729H106.311C107.51 44.7729 108.388 44.4731 108.945 43.8736C109.502 43.274 109.78 42.3747 109.78 41.1756V13.6823C109.78 12.4833 109.502 11.6054 108.945 11.0486C108.388 10.4491 107.51 10.1493 106.311 10.1493H78.6251C77.426 10.1493 76.5267 10.4491 75.9272 11.0486C75.3704 11.6054 75.0921 12.4833 75.0921 13.6823V41.1756C75.0921 42.3747 75.3704 43.274 75.9272 43.8736C76.5267 44.4731 77.426 44.7729 78.6251 44.7729ZM86.9759 34.5592C86.1622 34.5592 85.7554 34.0239 85.7554 32.9533V21.8404C85.7554 20.8554 86.1622 20.363 86.9759 20.363H98.4742C99.4164 20.363 99.8874 20.8554 99.8874 21.8404V32.9533C99.8874 34.0239 99.4164 34.5592 98.4742 34.5592H86.9759ZM13.8104 119.93C9.18531 119.93 5.71654 118.773 3.40402 116.461C1.13433 114.191 -0.000521637 110.658 -0.000521637 105.862V79.011C-0.000521637 74.2575 1.13433 70.7245 3.40402 68.4119C5.71654 66.0994 9.18531 64.9432 13.8104 64.9432H41.1109C45.736 64.9432 49.2047 66.0994 51.5172 68.4119C53.8298 70.7245 54.986 74.2575 54.986 79.011V105.862C54.986 110.658 53.8298 114.191 51.5172 116.461C49.2047 118.773 45.736 119.93 41.1109 119.93H13.8104ZM13.6176 109.78H41.3036C42.4599 109.78 43.3378 109.481 43.9373 108.881C44.5369 108.281 44.8366 107.404 44.8366 106.247V78.6898C44.8366 77.4907 44.5369 76.5914 43.9373 75.9919C43.3378 75.3923 42.4599 75.0926 41.3036 75.0926H13.6176C12.4614 75.0926 11.5835 75.3923 10.9839 75.9919C10.4272 76.5914 10.1489 77.4907 10.1489 78.6898V106.247C10.1489 107.404 10.4272 108.281 10.9839 108.881C11.5835 109.481 12.4614 109.78 13.6176 109.78ZM21.7115 99.5667C20.8121 99.5667 20.3625 99.0314 20.3625 97.9608V86.8479C20.3625 85.8629 20.8121 85.3704 21.7115 85.3704H33.1456C34.0877 85.3704 34.5588 85.8629 34.5588 86.8479V97.9608C34.5588 99.0314 34.0877 99.5667 33.1456 99.5667H21.7115ZM69.5035 82.0943C68.6042 82.0943 68.1545 81.5805 68.1545 80.5527V69.4397C68.1545 68.4548 68.6042 67.9623 69.5035 67.9623H80.9376C81.8369 67.9623 82.2866 68.4548 82.2866 69.4397V80.5527C82.2866 81.5805 81.8369 82.0943 80.9376 82.0943H69.5035ZM103.87 82.0943C102.971 82.0943 102.521 81.5805 102.521 80.5527V69.4397C102.521 68.4548 102.971 67.9623 103.87 67.9623H115.304C116.204 67.9623 116.653 68.4548 116.653 69.4397V80.5527C116.653 81.5805 116.204 82.0943 115.304 82.0943H103.87ZM86.8474 99.374C85.9481 99.374 85.4984 98.8387 85.4984 97.7681V86.6551C85.4984 85.6702 85.9481 85.1777 86.8474 85.1777H98.2815C99.1808 85.1777 99.6305 85.6702 99.6305 86.6551V97.7681C99.6305 98.8387 99.1808 99.374 98.2815 99.374H86.8474ZM69.5035 116.525C68.6042 116.525 68.1545 116.011 68.1545 114.983V103.806C68.1545 102.821 68.6042 102.329 69.5035 102.329H80.9376C81.8369 102.329 82.2866 102.821 82.2866 103.806V114.983C82.2866 116.011 81.8369 116.525 80.9376 116.525H69.5035ZM103.87 116.525C102.971 116.525 102.521 116.011 102.521 114.983V103.806C102.521 102.821 102.971 102.329 103.87 102.329H115.304C116.204 102.329 116.653 102.821 116.653 103.806V114.983C116.653 116.011 116.204 116.525 115.304 116.525H103.87Z"
      fill="black"
      fill-opacity="0.3"
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
  <svg
    width="22"
    height="19"
    viewBox="0 0 22 19"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.4453 18.1641C11.0677 18.1641 10.752 18.0404 10.498 17.793C10.2507 17.5456 10.127 17.2363 10.127 16.8652V13.3398H9.88281C8.69141 13.3398 7.64323 13.4668 6.73828 13.7207C5.83333 13.9746 5.03906 14.388 4.35547 14.9609C3.67188 15.5339 3.07292 16.3021 2.55859 17.2656C2.36979 17.6172 2.1582 17.8483 1.92383 17.959C1.69596 18.0697 1.45508 18.125 1.20117 18.125C0.86263 18.125 0.576172 17.9688 0.341797 17.6562C0.113932 17.3503 0 16.8945 0 16.2891C0 14.5182 0.198568 12.9297 0.595703 11.5234C0.992839 10.1107 1.59505 8.90625 2.40234 7.91016C3.21615 6.91406 4.24154 6.1556 5.47852 5.63477C6.72201 5.10742 8.1901 4.84375 9.88281 4.84375H10.127V1.34766C10.127 0.976562 10.2507 0.660807 10.498 0.400391C10.752 0.133464 11.071 0 11.4551 0C11.7155 0 11.9499 0.0585938 12.1582 0.175781C12.373 0.286458 12.6204 0.47526 12.9004 0.742188L20.6348 7.94922C20.8236 8.125 20.957 8.3138 21.0352 8.51562C21.1198 8.71094 21.1621 8.89974 21.1621 9.08203C21.1621 9.25781 21.1198 9.44661 21.0352 9.64844C20.957 9.85026 20.8236 10.0391 20.6348 10.2148L12.9004 17.4805C12.6465 17.7214 12.4023 17.8939 12.168 17.998C11.9401 18.1087 11.6992 18.1641 11.4453 18.1641ZM12.0508 15.6738C12.1094 15.6738 12.1647 15.6478 12.2168 15.5957L18.916 9.26758C18.9551 9.22852 18.9811 9.19596 18.9941 9.16992C19.0072 9.13737 19.0137 9.10807 19.0137 9.08203C19.0137 9.02995 18.9811 8.97135 18.916 8.90625L12.2266 2.5C12.2005 2.48047 12.1712 2.46419 12.1387 2.45117C12.1126 2.43815 12.0866 2.43164 12.0605 2.43164C11.9564 2.43164 11.9043 2.48047 11.9043 2.57812V6.2793C11.9043 6.49414 11.8001 6.60156 11.5918 6.60156H10.332C9.06901 6.60156 7.96224 6.75781 7.01172 7.07031C6.0612 7.3763 5.25065 7.80924 4.58008 8.36914C3.91602 8.92904 3.3724 9.58333 2.94922 10.332C2.53255 11.0742 2.22005 11.8815 2.01172 12.7539C1.80339 13.6198 1.68294 14.515 1.65039 15.4395C1.65039 15.5111 1.67318 15.5469 1.71875 15.5469C1.74479 15.5469 1.76432 15.5404 1.77734 15.5273C1.79036 15.5078 1.80339 15.4818 1.81641 15.4492C2.39583 14.2318 3.39844 13.2845 4.82422 12.6074C6.25 11.9238 8.08594 11.582 10.332 11.582H11.5918C11.8001 11.582 11.9043 11.6862 11.9043 11.8945V15.5176C11.9043 15.6217 11.9531 15.6738 12.0508 15.6738Z"
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
  onOpenCard,
  onPreview,
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
  const SLIDER_PADDING = 12; // Должно соответствовать padding в CSS
  const calculateIndexFromPosition = (clientX: number) => {
    if (!sliderRef.current) return durationIndex;
    const rect = sliderRef.current.getBoundingClientRect();
    // Учитываем padding слайдера
    const trackWidth = rect.width - SLIDER_PADDING * 2;
    const x = clientX - rect.left - SLIDER_PADDING;
    const percentage = Math.max(0, Math.min(1, x / trackWidth));
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

  // Sync local cards with prop
  useEffect(() => {
    setLocalCards(cards);
  }, [cards]);

  // Set initial selection only once on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (initialSelectedIds.length > 0) {
      setSelectedCardIds(initialSelectedIds);
    } else {
      const primaryCards = cards.filter((c) => c.is_primary).map((c) => c.id);
      setSelectedCardIds(primaryCards);
    }
  }, []);

  const toggleCardSelection = (cardId: string) => {
    console.log("toggleCardSelection called with:", cardId);
    console.log("current selectedCardIds:", selectedCardIds);
    setSelectedCardIds((prev) => {
      const newValue = prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId];
      console.log("new selectedCardIds:", newValue);
      return newValue;
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
      // Получаем все выбранные визитки
      const selectedCards = localCards.filter((c) =>
        selectedCardIds.includes(c.id),
      );

      if (selectedCards.length > 0) {
        // Пока API поддерживает только одну визитку, используем первую
        // TODO: когда API будет поддерживать множественный выбор, обновить
        const qr = await businessCardApi.getQRCode(
          selectedCards[0].id,
          duration,
        );
        setQrCodeImage(qr.image_base64);

        // Формируем название из всех выбранных визиток
        const cardNames = selectedCards.map((c) =>
          c.is_primary ? "Личный" : c.title || "Визитка",
        );
        setQrCardName(cardNames.join(", "));
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
        <Tabs
          tabs={[
            { id: "settings", label: "Настройки" },
            { id: "preview", label: "Посмотреть" },
          ]}
          activeId={activeTab}
          onChange={(id) => {
            if (id === "preview" && onPreview && selectedCardIds.length > 0) {
              // Open full profile preview page
              onPreview(selectedCardIds[0]);
            } else {
              setActiveTab(id as "settings" | "preview");
            }
          }}
          className="share-contact-page__tabs"
        />

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
              <div className="share-contact-page__card-select">
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
              </div>
              <button
                type="button"
                className="share-contact-page__card-arrow"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCard?.(card);
                }}
                aria-label="Открыть визитку"
              >
                <ArrowIcon />
              </button>
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
