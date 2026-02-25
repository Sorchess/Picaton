/**
 * Объединенный редактор биографии с AI-улучшением и транскрибацией документов.
 *
 * Заменяет шаги 1 и 2 в CardEditor:
 * - Единый textarea для ввода и редактирования
 * - Кнопка "Улучшить с AI" для streaming генерации
 * - Загрузка документов (PDF, DOCX, TXT, RTF) с drag-and-drop
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
  type DragEvent,
} from "react";
import { useUndoRedo, useDebouncedCallback } from "@/shared/hooks";
import { useI18n } from "@/shared/config";
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
  /** Callback при изменении текста bio (для быстрого извлечения тегов) */
  onBioTextChange?: (text: string) => void;
  /** Минимальная длина bio для активации AI */
  minLength?: number;
  /** Максимальная длина bio */
  maxLength?: number;
  /** Показывать заголовок секции (default: true) */
  showTitle?: boolean;
}

export function UnifiedBioEditor({
  card,
  userId,
  isActive,
  onCardUpdate,
  onError,
  onTagsUpdate,
  onTagsLoading,
  onBioTextChange,
  minLength = 20,
  maxLength = 2000,
  showTitle = true,
}: UnifiedBioEditorProps) {
  const { t } = useI18n();

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

  // Document upload state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [transcribeSuccess, setTranscribeSuccess] = useState<string | null>(
    null,
  );

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preGenerationBioRef = useRef<string>("");
  const requestTagsRef = useRef<(text: string) => void>(() => {});
  const onTagsLoadingRef = useRef(onTagsLoading);
  const dragCounterRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
          text.slice(0, 50) + "...",
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
          text.trim().length,
        );
      }
    },
    [wsConnected, minLength],
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
      setError(data.message || t("bio.errorOccurred"));

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

  // Notify parent about current bio text (for quick tag extraction)
  useEffect(() => {
    onBioTextChange?.(bio);
  }, [bio, onBioTextChange]);

  // Debounced tag update
  const debouncedTagUpdate = useDebouncedCallback(requestTags, 1500);

  // ── Auto-save ──────────────────────────────────────────────
  const bioRef = useRef(initialBio);
  bioRef.current = bio;

  const autoSave = useCallback(
    async (text: string) => {
      // Don't save during generation or if nothing changed
      if (isGenerating || text === initialBio) return;
      setIsSaving(true);
      setError(null);
      try {
        const updatedCard = await businessCardApi.update(cardId, ownerId, {
          bio: text,
        });
        onCardUpdate(updatedCard);
        requestTagsRef.current(text);
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : t("bio.saveError");
        setError(errorMessage);
        onError(errorMessage);
      } finally {
        setIsSaving(false);
      }
    },
    [cardId, ownerId, initialBio, isGenerating, onCardUpdate, onError],
  );

  const debouncedAutoSave = useDebouncedCallback(autoSave, 1500);

  // Handle bio changes
  const handleBioChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        setBio(newValue);
        debouncedTagUpdate(newValue);
        debouncedAutoSave(newValue);
        setError(null);
        // Notify parent about bio text change for quick tag extraction
        onBioTextChange?.(newValue);
      }
    },
    [setBio, debouncedTagUpdate, debouncedAutoSave, maxLength, onBioTextChange],
  );

  // ── Document Upload Handlers ──────────────────────────────────

  const ACCEPTED_FORMATS = ".pdf,.docx,.doc,.txt,.rtf";
  const ACCEPTED_MIME_TYPES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/rtf",
    "application/rtf",
  ]);

  const isValidFile = useCallback((file: File): boolean => {
    // Check by MIME type
    if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
    // Fallback: check extension
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return ["pdf", "docx", "doc", "txt", "rtf"].includes(ext);
  }, []);

  const handleFileTranscribe = useCallback(
    async (file: File) => {
      if (!isValidFile(file)) {
        setError(t("bio.unsupportedFormat"));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError(t("bio.fileTooLarge"));
        return;
      }

      setIsTranscribing(true);
      setError(null);
      setTranscribeSuccess(null);

      try {
        const result = await businessCardApi.transcribeDocument(file);

        // Append text to existing bio (or replace if empty)
        const currentBio = bio.trim();
        const newBio = currentBio
          ? `${currentBio}\n\n${result.text}`
          : result.text;

        // Respect max length
        const trimmedBio = newBio.slice(0, maxLength);
        setBio(trimmedBio);
        onBioTextChange?.(trimmedBio);
        debouncedTagUpdate(trimmedBio);

        const truncNote = result.was_truncated
          ? ` (${t("bio.textTruncated")})`
          : "";
        setTranscribeSuccess(
          t("bio.textExtracted", { filename: result.filename }) + truncNote,
        );

        // Auto-hide success message
        setTimeout(() => setTranscribeSuccess(null), 5000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("bio.extractFailed");
        // Try to parse API error detail
        try {
          const parsed = JSON.parse(
            (e as { data?: { detail?: string } })?.data?.detail ?? "{}",
          );
          setError(parsed.detail || msg);
        } catch {
          setError(msg);
        }
      } finally {
        setIsTranscribing(false);
      }
    },
    [bio, maxLength, setBio, debouncedTagUpdate, onBioTextChange, isValidFile],
  );

  // Click to upload
  const handleUploadClick = useCallback(() => {
    if (isGenerating || isTranscribing) return;
    fileInputRef.current?.click();
  }, [isGenerating, isTranscribing]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileTranscribe(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [handleFileTranscribe],
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (
        e.dataTransfer.types.includes("Files") &&
        !isGenerating &&
        !isTranscribing
      ) {
        setIsDragOver(true);
      }
    },
    [isGenerating, isTranscribing],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounterRef.current = 0;

      if (isGenerating || isTranscribing) return;

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileTranscribe(file);
      }
    },
    [isGenerating, isTranscribing, handleFileTranscribe],
  );

  // ── Voice Recording Handlers ──────────────────────────────────

  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        if (audioBlob.size === 0) {
          setError(t("bio.recordFailed"));
          return;
        }

        // Send to backend for recognition
        setIsRecognizing(true);
        setError(null);

        try {
          const result = await businessCardApi.recognizeSpeech(audioBlob);
          const recognized = result.text.trim();
          if (!recognized) {
            setError(t("bio.speechNotRecognized"));
            return;
          }

          // Append recognized text to bio
          const currentBio = bio.trim();
          const newBio = currentBio
            ? `${currentBio} ${recognized}`
            : recognized;
          const trimmedBio = newBio.slice(0, maxLength);
          setBio(trimmedBio);
          onBioTextChange?.(trimmedBio);
          debouncedTagUpdate(trimmedBio);

          setTranscribeSuccess(
            t("bio.voiceRecognized", {
              text: `${recognized.slice(0, 60)}${recognized.length > 60 ? "..." : ""}`,
            }),
          );
          setTimeout(() => setTranscribeSuccess(null), 5000);
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : t("bio.speechRecognitionError");
          setError(msg);
        } finally {
          setIsRecognizing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      // Auto-stop after 30 seconds (Yandex SpeechKit limit)
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError(t("bio.microphoneDenied"));
      } else {
        setError(t("bio.microphoneFailed"));
      }
    }
  }, [
    isRecording,
    bio,
    maxLength,
    setBio,
    onBioTextChange,
    debouncedTagUpdate,
  ]);

  // Cleanup: stop recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // AI Improve - saves current bio first, then generates
  const handleAIImprove = useCallback(async () => {
    if (bio.trim().length < minLength) {
      setError(t("bio.minCharsForAi", { n: String(minLength) }));
      return;
    }

    if (!wsConnected) {
      setError(t("bio.noServerConnection"));
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
          e instanceof Error ? e.message : t("bio.saveError");
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

  // Display text: streaming or current bio
  const displayText = isGenerating ? streamedText : bio;
  const charCount = isGenerating ? streamedText.length : bio.length;
  const canImprove =
    bio.trim().length >= minLength && !isGenerating && !isSaving && wsConnected;
  const isBusy = isGenerating || isTranscribing || isRecognizing;

  // Mark isActive as used for potential future styling
  void isActive;

  return (
    <div
      className={`unified-bio-editor ${
        isGenerating ? "unified-bio-editor--generating" : ""
      } ${isTranscribing ? "unified-bio-editor--transcribing" : ""}`}
    >
      {/* Header */}
      <div className="unified-bio-editor__header">
        <div className="unified-bio-editor__title">
          {showTitle && <h2>{t("bio.title")}</h2>}
          {!wsConnected && (
            <span className="unified-bio-editor__status unified-bio-editor__status--offline">
              {t("common.offline")}
            </span>
          )}
        </div>

        <div className="unified-bio-editor__header-actions">
          {/* Voice input button */}
          <button
            type="button"
            className={`unified-bio-editor__voice-btn ${
              isRecording ? "unified-bio-editor__voice-btn--recording" : ""
            }`}
            onClick={handleVoiceToggle}
            disabled={isBusy && !isRecording}
            title={isRecording ? t("bio.stopRecording") : t("bio.voiceInput")}
            aria-label={
              isRecording ? t("bio.stopRecording") : t("bio.voiceInput")
            }
          >
            {isRecognizing ? (
              <div className="unified-bio-editor__voice-spinner" />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isRecording ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Upload document button */}
          <button
            type="button"
            className="unified-bio-editor__upload-btn"
            onClick={handleUploadClick}
            disabled={isBusy}
            title={t("bio.uploadDocument")}
            aria-label={t("bio.uploadDocument")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <div className="unified-bio-editor__history">
            <button
              type="button"
              className="unified-bio-editor__history-btn"
              onClick={undo}
              disabled={!canUndo || isBusy}
              title={t("bio.undoShortcut")}
              aria-label={t("bio.undo")}
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
              disabled={!canRedo || isBusy}
              title={t("bio.redoShortcut")}
              aria-label={t("bio.redo")}
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

      {/* Transcribe success message */}
      {transcribeSuccess && (
        <div
          className="unified-bio-editor__success"
          onClick={() => setTranscribeSuccess(null)}
        >
          {transcribeSuccess}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        onChange={handleFileInputChange}
        className="unified-bio-editor__file-input"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Textarea with drag-and-drop zone */}
      <div
        className={`unified-bio-editor__input-wrapper ${
          isDragOver ? "unified-bio-editor__input-wrapper--drag-over" : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <textarea
          ref={textareaRef}
          className={`unified-bio-editor__textarea ${
            isGenerating ? "unified-bio-editor__textarea--streaming" : ""
          }`}
          value={displayText}
          onChange={handleBioChange}
          placeholder={t("bio.placeholder")}
          rows={6}
          disabled={isBusy}
          aria-label={t("bio.ariaLabel")}
        />

        {/* Drag overlay */}
        {isDragOver && (
          <div className="unified-bio-editor__drag-overlay">
            <div className="unified-bio-editor__drag-overlay-content">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
              <span>{t("bio.dropFile")}</span>
            </div>
          </div>
        )}

        {/* Transcribing indicator */}
        {isTranscribing && (
          <div className="unified-bio-editor__transcribe-overlay">
            <div className="unified-bio-editor__transcribe-spinner" />
            <span>{t("bio.extractingText")}</span>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="unified-bio-editor__recording-overlay">
            <div className="unified-bio-editor__recording-pulse" />
            <span>{t("bio.speak")}</span>
            <button
              type="button"
              className="unified-bio-editor__recording-stop"
              onClick={handleVoiceToggle}
            >
              {t("bio.stop")}
            </button>
          </div>
        )}

        {/* Recognizing indicator */}
        {isRecognizing && (
          <div className="unified-bio-editor__transcribe-overlay">
            <div className="unified-bio-editor__transcribe-spinner" />
            <span>{t("bio.recognizing")}</span>
          </div>
        )}

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
                {t("bio.minimum", { n: String(minLength) })}
              </span>
            )}
          </span>
          {isSaving && (
            <span className="unified-bio-editor__saving">
              {t("common.saving")}
            </span>
          )}
        </div>

        <div className="unified-bio-editor__actions">
          {isGenerating ? (
            <button
              type="button"
              className="unified-bio-editor__btn unified-bio-editor__btn--cancel"
              onClick={handleCancelGeneration}
            >
              {t("common.cancel")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="unified-bio-editor__btn unified-bio-editor__btn--ai"
                onClick={handleAIImprove}
                disabled={!canImprove || isTranscribing}
                title={
                  !wsConnected
                    ? t("bio.noConnection")
                    : bio.length < minLength
                      ? t("bio.minChars", { n: String(minLength) })
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
                {t("bio.improveWithAi")}
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
            {t("bio.aiGenerating")}
          </span>
        </div>
      )}
    </div>
  );
}

export default UnifiedBioEditor;
