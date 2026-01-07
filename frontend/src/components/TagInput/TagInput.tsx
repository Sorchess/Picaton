import React, { useState, useCallback, useRef } from 'react';
import './TagInput.scss';

export interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  enableTextGeneration?: boolean;
  onGenerateFromText?: (text: string) => Promise<string[]>;
  isGenerating?: boolean;
  disabled?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onTagsChange,
  placeholder = 'Добавить тег...',
  maxTags = 20,
  enableTextGeneration = false,
  onGenerateFromText,
  isGenerating = false,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [generationText, setGenerationText] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [showGenerationPanel, setShowGenerationPanel] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizeTag = useCallback((tag: string): string => {
    return tag.trim().toLowerCase().replace(/\s+/g, '-');
  }, []);

  const addTag = useCallback((tag: string) => {
    const normalizedTag = normalizeTag(tag);
    if (
      normalizedTag &&
      normalizedTag.length >= 2 &&
      !tags.includes(normalizedTag) &&
      tags.length < maxTags
    ) {
      onTagsChange([...tags, normalizedTag]);
      return true;
    }
    return false;
  }, [tags, maxTags, onTagsChange, normalizeTag]);

  const removeTag = useCallback((tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  }, [tags, onTagsChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Разделяем по запятой сразу при вводе
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.slice(0, -1).forEach(part => addTag(part));
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (addTag(inputValue)) {
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleGenerateClick = async () => {
    if (!onGenerateFromText || !generationText.trim() || generationText.length < 10) {
      return;
    }

    setGenerationError(null);

    try {
      const suggestions = await onGenerateFromText(generationText.trim());
      const filteredSuggestions = suggestions
        .map(normalizeTag)
        .filter(tag => tag && !tags.includes(tag));
      setSuggestedTags(filteredSuggestions);
      
      if (filteredSuggestions.length === 0 && suggestions.length > 0) {
        setGenerationError('Все предложенные теги уже добавлены');
      }
    } catch (error) {
      console.error('Failed to generate tags:', error);
      setGenerationError('Не удалось сгенерировать теги. Попробуйте ещё раз.');
    }
  };

  const addSuggestedTag = (tag: string) => {
    if (addTag(tag)) {
      setSuggestedTags(prev => prev.filter(t => t !== tag));
    }
  };

  const addAllSuggested = () => {
    const availableSlots = maxTags - tags.length;
    const tagsToAdd = suggestedTags.slice(0, availableSlots);
    
    if (tagsToAdd.length > 0) {
      onTagsChange([...tags, ...tagsToAdd]);
      setSuggestedTags(prev => prev.slice(availableSlots));
    }
  };

  const clearSuggestions = () => {
    setSuggestedTags([]);
    setGenerationError(null);
  };

  const isMaxReached = tags.length >= maxTags;

  return (
    <div className={`tag-input-container ${disabled ? 'disabled' : ''}`}>
      <div 
        className={`tag-input-wrapper ${isMaxReached ? 'max-reached' : ''}`}
        onClick={handleContainerClick}
      >
        <div className="tags-list">
          {tags.map((tag) => (
            <span key={tag} className="tag">
              <span className="tag-text">{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  className="tag-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  aria-label={`Удалить тег ${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {!isMaxReached && !disabled && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={tags.length === 0 ? placeholder : ''}
              className="tag-input"
              disabled={disabled}
            />
          )}
        </div>
      </div>
      
      {isMaxReached && (
        <span className="tags-limit">Достигнут лимит в {maxTags} тегов</span>
      )}

      {enableTextGeneration && !disabled && (
        <div className="generation-section">
          <button
            type="button"
            className={`generation-toggle ${showGenerationPanel ? 'active' : ''}`}
            onClick={() => setShowGenerationPanel(!showGenerationPanel)}
          >
            <span className="toggle-icon">{showGenerationPanel ? '▼' : '▶'}</span>
            <span className="toggle-text">
              {showGenerationPanel ? 'Скрыть генерацию' : 'Сгенерировать теги из текста'}
            </span>
          </button>

          {showGenerationPanel && (
            <div className="generation-panel">
              <textarea
                value={generationText}
                onChange={(e) => setGenerationText(e.target.value)}
                placeholder="Опишите свои навыки и опыт свободным текстом. Например: «Занимаюсь веб-разработкой 5 лет, специализируюсь на React и TypeScript, есть опыт работы с Node.js и PostgreSQL...»"
                className="generation-textarea"
                rows={4}
                disabled={isGenerating}
                maxLength={1000}
              />
              
              <div className="generation-footer">
                <span className="char-counter">
                  {generationText.length}/1000
                </span>
                <button
                  type="button"
                  className="generate-button"
                  onClick={handleGenerateClick}
                  disabled={isGenerating || generationText.length < 10 || isMaxReached}
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner" />
                      Генерация...
                    </>
                  ) : (
                    'Сгенерировать теги'
                  )}
                </button>
              </div>

              {generationError && (
                <div className="generation-error">{generationError}</div>
              )}

              {suggestedTags.length > 0 && (
                <div className="suggested-tags">
                  <div className="suggested-header">
                    <span className="suggested-title">
                      Предложенные теги ({suggestedTags.length})
                    </span>
                    <div className="suggested-actions">
                      <button
                        type="button"
                        className="add-all-button"
                        onClick={addAllSuggested}
                        disabled={isMaxReached}
                      >
                        Добавить все
                      </button>
                      <button
                        type="button"
                        className="clear-button"
                        onClick={clearSuggestions}
                      >
                        Очистить
                      </button>
                    </div>
                  </div>
                  <div className="suggested-list">
                    {suggestedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="suggested-tag"
                        onClick={() => addSuggestedTag(tag)}
                        disabled={isMaxReached}
                      >
                        <span className="plus-icon">+</span>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagInput;
