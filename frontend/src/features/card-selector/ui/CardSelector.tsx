import { useState, useEffect, useCallback } from "react";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import { Button, Modal, Loader } from "@/shared";
import { useI18n } from "@/shared/config";
import "./CardSelector.scss";

interface CardSelectorProps {
  ownerId: string;
  selectedCardId: string | null;
  onCardSelect: (card: BusinessCard) => void;
  onCardCreate?: (card: BusinessCard) => void;
}

export function CardSelector({
  ownerId,
  selectedCardId,
  onCardSelect,
  onCardCreate,
}: CardSelectorProps) {
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const MAX_CARDS = 5;

  const loadCards = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await businessCardApi.getAll(ownerId);
      setCards(response.cards);

      // Если нет выбранной карточки - выбираем основную или первую
      if (!selectedCardId && response.cards.length > 0) {
        const primary =
          response.cards.find((c) => c.is_primary) || response.cards[0];
        onCardSelect(primary);
      }
    } catch {
      setError(t("cardSelector.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, selectedCardId, onCardSelect]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleCreateCard = async () => {
    if (!newCardTitle.trim()) return;

    try {
      setIsCreating(true);
      const newCard = await businessCardApi.create(ownerId, {
        title: newCardTitle.trim(),
      });
      setCards([...cards, newCard]);
      setNewCardTitle("");
      setIsModalOpen(false);
      onCardCreate?.(newCard);
      onCardSelect(newCard);
    } catch {
      setError(t("cardSelector.createError"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetPrimary = async (cardId: string) => {
    try {
      await businessCardApi.setPrimary(cardId, ownerId);
      setCards(
        cards.map((c) => ({
          ...c,
          is_primary: c.id === cardId,
        })),
      );
    } catch {
      setError(t("cardSelector.primaryError"));
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (cards.length <= 1) {
      setError(t("cardSelector.cantDeleteLast"));
      return;
    }

    if (!confirm(t("cardSelector.deleteConfirm"))) return;

    try {
      await businessCardApi.delete(cardId, ownerId);
      const newCards = cards.filter((c) => c.id !== cardId);
      setCards(newCards);

      // Если удалили выбранную карточку - выбираем первую из оставшихся
      if (selectedCardId === cardId && newCards.length > 0) {
        onCardSelect(newCards[0]);
      }
    } catch {
      setError(t("cardSelector.deleteError"));
    }
  };

  if (isLoading) {
    return (
      <div className="card-selector card-selector--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="card-selector">
      <div className="card-selector__tabs">
        {cards.map((card) => (
          <button
            key={card.id}
            className={`card-selector__tab ${
              selectedCardId === card.id ? "card-selector__tab--active" : ""
            }`}
            onClick={() => onCardSelect(card)}
          >
            <span className="card-selector__tab-title">
              {card.title}
              {card.is_primary && (
                <span className="card-selector__badge">★</span>
              )}
            </span>
            {selectedCardId === card.id && (
              <div className="card-selector__tab-actions">
                {!card.is_primary && (
                  <button
                    className="card-selector__action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetPrimary(card.id);
                    }}
                    title={t("cardSelector.makePrimary")}
                  >
                    ★
                  </button>
                )}
                {cards.length > 1 && (
                  <button
                    className="card-selector__action card-selector__action--delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCard(card.id);
                    }}
                    title={t("common.delete")}
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </button>
        ))}

        {cards.length < MAX_CARDS && (
          <button
            className="card-selector__tab card-selector__tab--add"
            onClick={() => setIsModalOpen(true)}
            title={t("cardSelector.addCard")}
          >
            +
          </button>
        )}
      </div>

      {error && (
        <div className="card-selector__error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("cardSelector.newCard")}
      >
        <div className="card-selector__modal-content">
          <p className="card-selector__modal-description">
            {t("cardSelector.newCardDescription")}
          </p>
          <input
            type="text"
            className="card-selector__input"
            placeholder={t("cardSelector.cardNamePlaceholder")}
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            maxLength={100}
            autoFocus
          />
          <div className="card-selector__modal-actions">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isCreating}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateCard}
              disabled={!newCardTitle.trim() || isCreating}
            >
              {isCreating ? t("common.creating") : t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
