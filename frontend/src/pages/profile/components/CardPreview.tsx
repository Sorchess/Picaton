import type { BusinessCard } from "@/entities/business-card";
import "./CardPreview.scss";

interface CardPreviewProps {
  card: BusinessCard;
  onClick: () => void;
  onShare?: (card: BusinessCard) => void;
}

export function CardPreview({ card, onClick, onShare }: CardPreviewProps) {
  // Расчёт прогресса
  const getProgress = () => {
    let progress = 0;
    if (card.bio && card.bio.length >= 20) progress += 25;
    if (card.ai_generated_bio) progress += 25;
    if (card.search_tags && card.search_tags.length > 0) progress += 25;
    if (card.contacts && card.contacts.length > 0) progress += 25;
    return progress;
  };

  const progress = getProgress();
  const isComplete = progress === 100;

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare?.(card);
  };

  return (
    <div className="card-preview" onClick={onClick}>
      <div className="card-preview__content">
        <div className="card-preview__header">
          <div className="card-preview__info">
            <h3 className="card-preview__title">
              {card.title}
              {card.is_primary && (
                <span className="card-preview__badge">★</span>
              )}
            </h3>
            {card.ai_generated_bio ? (
              <p className="card-preview__bio">{card.ai_generated_bio}</p>
            ) : (
              <p className="card-preview__bio card-preview__bio--empty">
                Нажмите, чтобы заполнить карточку
              </p>
            )}
          </div>
          {onShare && (
            <button
              className="card-preview__share-btn"
              onClick={handleShareClick}
              title="Поделиться"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="4" height="4" rx="0.5" />
                <rect x="17" y="17" width="4" height="4" rx="0.5" />
                <rect x="14" y="17" width="2" height="2" rx="0.25" />
                <rect x="17" y="14" width="2" height="2" rx="0.25" />
              </svg>
            </button>
          )}
        </div>

        <div className="card-preview__footer">
          <div className="card-preview__progress">
            <div className="card-preview__progress-bar">
              <div
                className="card-preview__progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="card-preview__progress-text">
              {isComplete ? "✓" : `${progress}%`}
            </span>
          </div>

          <div className="card-preview__stats">
            {card.search_tags && card.search_tags.length > 0 && (
              <span className="card-preview__stat">
                {card.search_tags.length} тегов
              </span>
            )}
            {card.contacts && card.contacts.length > 0 && (
              <span className="card-preview__stat">
                {card.contacts.length} контактов
              </span>
            )}
          </div>

          <span className="card-preview__arrow">→</span>
        </div>
      </div>
    </div>
  );
}
