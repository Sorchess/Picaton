import type { BusinessCard } from "@/entities/business-card";
import "./CardPreview.scss";

interface CardPreviewProps {
  card: BusinessCard;
  onClick: () => void;
}

export function CardPreview({ card, onClick }: CardPreviewProps) {
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

  return (
    <button className="card-preview" onClick={onClick}>
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
    </button>
  );
}
