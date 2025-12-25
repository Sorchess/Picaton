import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import { Loader } from "../Loader";
import "./TagInput.scss";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
  onGenerateSuggestions?: () => void;
  isLoadingSuggestions?: boolean;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Добавьте тег...",
  maxTags = 15,
  suggestions = [],
  onGenerateSuggestions,
  isLoadingSuggestions = false,
  label,
  error,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed || value.includes(trimmed) || value.length >= maxTags) {
        return;
      }
      onChange([...value, trimmed]);
      setInputValue("");
    },
    [value, onChange, maxTags]
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  // Filter out already added tags from suggestions
  const filteredSuggestions = suggestions.filter(
    (s) => !value.includes(s.toLowerCase())
  );

  return (
    <div className={`tag-input ${error ? "tag-input--error" : ""}`}>
      {label && <label className="tag-input__label">{label}</label>}

      <div
        className={`tag-input__container ${disabled ? "tag-input__container--disabled" : ""}`}
        onClick={handleContainerClick}
      >
        {value.map((tag, index) => (
          <span key={tag} className="tag-input__tag">
            {tag}
            {!disabled && (
              <button
                type="button"
                className="tag-input__tag-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                aria-label={`Удалить ${tag}`}
              >
                &times;
              </button>
            )}
          </span>
        ))}

        {value.length < maxTags && !disabled && (
          <input
            ref={inputRef}
            type="text"
            className="tag-input__input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled}
          />
        )}
      </div>

      {error && <span className="tag-input__error">{error}</span>}

      {/* AI Suggestions */}
      {filteredSuggestions.length > 0 && (
        <div className="tag-input__suggestions">
          <span className="tag-input__suggestions-label">Предложения:</span>
          <div className="tag-input__suggestions-list">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="tag-input__suggestion"
                onClick={() => addTag(suggestion)}
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Generate button */}
      {onGenerateSuggestions && (
        <button
          type="button"
          className="tag-input__ai-btn"
          onClick={onGenerateSuggestions}
          disabled={isLoadingSuggestions || disabled}
        >
          {isLoadingSuggestions ? (
            <>
              <Loader />
              <span>Генерация...</span>
            </>
          ) : (
            <>
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
              <span>AI-подсказки</span>
            </>
          )}
        </button>
      )}

      <div className="tag-input__hint">
        {value.length}/{maxTags} тегов. Нажмите Enter или запятую для добавления.
      </div>
    </div>
  );
}
