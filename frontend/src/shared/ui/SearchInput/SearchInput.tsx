import type { FC, InputHTMLAttributes } from "react";
import { useState, useRef } from "react";
import "./SearchInput.scss";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onSubmit"> {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Submit handler (on Enter) */
  onEnterPress?: (value: string) => void;
  /** Clear handler */
  onClear?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Show clear button */
  showClear?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Search input from Figma with icon and clear button
 */
export const SearchInput: FC<SearchInputProps> = ({
  value,
  onChange,
  onEnterPress,
  onClear,
  isLoading = false,
  showClear = true,
  placeholder = "Поиск...",
  className = "",
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange("");
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnterPress) {
      e.preventDefault();
      onEnterPress(value);
    }
  };

  return (
    <div
      className={`search-input ${isFocused ? "search-input--focused" : ""} ${className}`}
    >
      <div className="search-input__icon">
        {isLoading ? (
          <svg className="search-input__spinner" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle
              cx="9"
              cy="9"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M13.5 13.5L17 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      <input
        ref={inputRef}
        type="text"
        className="search-input__field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        {...props}
      />

      {showClear && value && !isLoading && (
        <button
          type="button"
          className="search-input__clear"
          onClick={handleClear}
          aria-label="Очистить"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 4L4 12M4 4L12 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
};
