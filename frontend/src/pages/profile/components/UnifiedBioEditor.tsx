/**
 * Объединенный редактор биографии с AI-улучшением.
 *
 * Заменяет шаги 1 и 2 в CardEditor:
 * - Единый textarea для ввода и редактирования
 * - Кнопка "Улучшить с AI" для streaming генерации
 * - Undo/Redo стек с горячими клавишами
 * - Эффект "печатной машинки" при генерации
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useUndoRedo, useDebouncedCallback } from "@/shared/hooks";
import { aiWebSocket, type WSMessage } from "@/shared/api";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import "./UnifiedBioEditor.scss";

export interface UnifiedBioEditorProps {
  /** Карточка для редактирования */
  card: BusinessCard;
  /** ID владельца */
  userId: string;
  /** Активен ли редактор (текущий шаг) */
  isActive: boolean;
  /** Callback при обновлении карточки */
  onCardUpdate: (updatedCard: BusinessCard) => void;
  /** Callback для отображения ошибок */
  onError: Dispatch<SetStateAction<string | null>>;
  /** Callback при обновлении предложенных тегов */
  onTagsUpdate?: (tags: string[]) => void;
  /** Callback при изменении статуса загрузки тегов */
  onTagsLoading?: (isLoading: boolean) => void;
  /** Минимальная длина bio для активации AI */
  minLength?: number;
  /** Максимальная длина bio */
  maxLength?: number;
}

export function UnifiedBioEditor({
  card,
  userId,
  isActive,
  onCardUpdate,
  onError,
  onTagsUpdate,
  onTagsLoading,
  minLength = 20,
  maxLength = 2000,
}: UnifiedBioEditorProps) {
  const cardId = card.id;
  const ownerId = userId;
  const initialBio = card.bio || "";
  // isActive is kept for potential styling but editing is always enabled
  // Undo/Redo state
  const {
    value: bio,
    setValue: setBio,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  } = useUndoRedo(initialBio, {
    maxHistoryLength: 30,
    enableKeyboardShortcuts: true,
  });

  // Local state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preGenerationBioRef = useRef<string>("");
  const requestTagsRef = useRef<(text: string) => void>(() => {});
  const onTagsLoadingRef = useRef(onTagsLoading);
  
  // Keep onTagsLoading ref updated
  useEffect(() => {
    onTagsLoadingRef.current = onTagsLoading;
  }, [onTagsLoading]);

  // Function to request tags for given text
  const requestTags = useCallback(
    (text: string) => {
      if (text.trim().length >= minLength && wsConnected) {
        console.log(
          "[BioEditor] Requesting tags for text:",
          text.slice(0, 50) + "..."
        );
        onTagsLoadingRef.current?.(true);
        const sent = aiWebSocket.send("suggest_tags", { bio_text: text });
        console.log("[BioEditor] Tags request sent:", sent);
        if (!sent) {
          onTagsLoadingRef.current?.(false);
        }
      } else {
        console.log(
          "[BioEditor] Cannot request tags - wsConnected:",
          wsConnected,
          "textLength:",
          text.trim().length
        );
      }
    },
    [wsConnected, minLength]
  );

  // Keep requestTags ref updated
  useEffect(() => {
    requestTagsRef.current = requestTags;
  }, [requestTags]);

  // Connect to WebSocket
  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        await aiWebSocket.connect(cardId, ownerId);
        if (mounted) setWsConnected(true);
      } catch (e) {
        console.error("WebSocket connection failed:", e);
        if (mounted) setWsConnected(false);
      }
    };

    connect();

    // Subscribe to messages
    const unsubChunk = aiWebSocket.on("chunk", (data: WSMessage) => {
      if (!mounted) return;
      setStreamedText((prev) => prev + (data.content || ""));
    });

    const unsubComplete = aiWebSocket.on("complete", (data: WSMessage) => {
      if (!mounted) return;
      setIsGenerating(false);
      if (data.full_bio) {
        // Save the generated bio to undo stack
        setBio(data.full_bio);
        setStreamedText("");
        // Request tags for the new bio
        const newBio = data.full_bio;
        setTimeout(() => {
          requestTagsRef.current(newBio);
        }, 500);
      }
    });

    const unsubError = aiWebSocket.on("error", (data: WSMessage) => {
      if (!mounted) return;
      setIsGenerating(false);
      setError(data.message || "Произошла ошибка");

      // Restore previous bio on error
      if (preGenerationBioRef.current) {
        setBio(preGenerationBioRef.current, false);
        setStreamedText("");
      }
    });

    const unsubTags = aiWebSocket.on("tags_update", (data: WSMessage) => {
      console.log("[BioEditor] Received tags_update:", data);
      if (!mounted) return;
      onTagsLoading?.(false);
      if (!data.tags) return;
      // Extract tag names and call callback
      const tagNames = data.tags.map((t) => t.name);
      console.log("[BioEditor] Tag names extracted:", tagNames);
      if (onTagsUpdate) {
        onTagsUpdate(tagNames);
      }
    });

    return () => {
      mounted = false;
      unsubChunk();
      unsubComplete();
      unsubError();
      unsubTags();
      aiWebSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are handled via refs to avoid reconnecting WebSocket
  }, [cardId, ownerId, setBio]);

  // Sync with external changes
  useEffect(() => {
    if (initialBio !== bio && !isGenerating) {
      reset(initialBio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when initialBio changes
  }, [initialBio]);

  // Debounced tag update
  const debouncedTagUpdate = useDebouncedCallback(requestTags, 1500);

  // Handle bio changes
  const handleBioChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        setBio(newValue);
        debouncedTagUpdate(newValue);
        setError(null);
      }
    },
    [setBio, debouncedTagUpdate, maxLength]
  );

  // AI Improve - saves current bio first, then generates
  const handleAIImprove = useCallback(async () => {
    if (bio.trim().length < minLength) {
      setError(`Минимум ${minLength} символов для AI-улучшения`);
      return;
    }

    if (!wsConnected) {
      setError("Нет соединения с сервером");
      return;
    }

    // Save current bio for potential rollback
    preGenerationBioRef.current = bio;
    setError(null);

    // First save the current bio so AI generates from fresh data
    if (bio !== initialBio) {
      setIsSaving(true);
      try {
        const updatedCard = await businessCardApi.update(cardId, ownerId, {
          bio,
        });
        onCardUpdate(updatedCard);
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Ошибка сохранения";
        setError(errorMessage);
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    // Now start AI generation
    setIsGenerating(true);
    setStreamedText("");

    aiWebSocket.send("generate_bio");
  }, [bio, initialBio, wsConnected, minLength, cardId, ownerId, onCardUpdate]);

  // Cancel generation
  const handleCancelGeneration = useCallback(() => {
    setIsGenerating(false);
    setStreamedText("");

    // Restore previous bio
    if (preGenerationBioRef.current) {
      setBio(preGenerationBioRef.current, false);
    }
  }, [setBio]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (isSaving || isGenerating) return;

    setIsSaving(true);
    setError(null);

    try {
      const updatedCard = await businessCardApi.update(cardId, ownerId, {
        bio,
      });
      onCardUpdate(updatedCard);
      // Request tags after successful save
      requestTags(bio);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Ошибка сохранения";
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    bio,
    cardId,
    ownerId,
    onCardUpdate,
    onError,
    isSaving,
    isGenerating,
    requestTags,
  ]);

  // Display text: streaming or current bio
  const displayText = isGenerating ? streamedText : bio;
  const charCount = isGenerating ? streamedText.length : bio.length;
  const canImprove =
    bio.trim().length >= minLength && !isGenerating && !isSaving && wsConnected;
  const hasUnsavedChanges = bio !== initialBio;

  // Mark isActive as used for potential future styling
  void isActive;

  return (
    <div
      className={`unified-bio-editor ${
        isGenerating ? "unified-bio-editor--generating" : ""
      }`}
    >
      {/* Header */}
      <div className="unified-bio-editor__header">
        <div className="unified-bio-editor__title">
          <h2>О себе</h2>
          {!wsConnected && (
            <span className="unified-bio-editor__status unified-bio-editor__status--offline">
              Офлайн
            </span>
          )}
        </div>

        <div className="unified-bio-editor__history">
          <button
            type="button"
            className="unified-bio-editor__history-btn"
            onClick={undo}
            disabled={!canUndo || isGenerating}
            title="Отменить (Ctrl+Z)"
            aria-label="Отменить"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 10h10a5 5 0 0 1 5 5v2M3 10l5-5M3 10l5 5" />
            </svg>
          </button>
          <button
            type="button"
            className="unified-bio-editor__history-btn"
            onClick={redo}
            disabled={!canRedo || isGenerating}
            title="Повторить (Ctrl+Y)"
            aria-label="Повторить"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-5-5M21 10l-5 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="unified-bio-editor__error"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {/* Textarea */}
      <div className="unified-bio-editor__input-wrapper">
        <textarea
          ref={textareaRef}
          className={`unified-bio-editor__textarea ${
            isGenerating ? "unified-bio-editor__textarea--streaming" : ""
          }`}
          value={displayText}
          onChange={handleBioChange}
          placeholder="Расскажите о своем опыте, навыках и достижениях..."
          rows={6}
          disabled={isGenerating}
          aria-label="Описание о себе"
        />

        {/* Typing indicator during generation */}
        {isGenerating && (
          <span className="unified-bio-editor__cursor" aria-hidden="true" />
        )}
      </div>

      {/* Footer */}
      <div className="unified-bio-editor__footer">
        <div className="unified-bio-editor__meta">
          <span className="unified-bio-editor__char-count">
            {charCount} / {maxLength}
            {charCount > 0 && charCount < minLength && (
              <span className="unified-bio-editor__hint">
                {" "}
                (минимум {minLength})
              </span>
            )}
          </span>
          {hasUnsavedChanges && !isGenerating && (
            <span className="unified-bio-editor__unsaved">Не сохранено</span>
          )}
        </div>

        <div className="unified-bio-editor__actions">
          {isGenerating ? (
            <button
              type="button"
              className="unified-bio-editor__btn unified-bio-editor__btn--cancel"
              onClick={handleCancelGeneration}
            >
              Отмена
            </button>
          ) : (
            <>
              <button
                type="button"
                className="unified-bio-editor__btn unified-bio-editor__btn--ai"
                onClick={handleAIImprove}
                disabled={!canImprove}
                title={
                  !wsConnected
                    ? "Нет соединения"
                    : bio.length < minLength
                    ? `Минимум ${minLength} символов`
                    : undefined
                }
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Улучшить с AI
              </button>

              <button
                type="button"
                className="unified-bio-editor__btn unified-bio-editor__btn--save"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Generation progress */}
      {isGenerating && (
        <div className="unified-bio-editor__progress">
          <div className="unified-bio-editor__progress-bar">
            <div className="unified-bio-editor__progress-fill" />
          </div>
          <span className="unified-bio-editor__progress-text">
            AI генерирует текст...
          </span>
        </div>
      )}
    </div>
  );
}

export default UnifiedBioEditor;
