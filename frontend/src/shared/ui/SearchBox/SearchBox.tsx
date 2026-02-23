import type { FormHTMLAttributes, ReactNode } from "react";
import { useI18n } from "@/shared/config";
import "./SearchBox.scss";

interface SearchBoxProps extends Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  onSearch?: (value: string) => void;
  buttonText?: string;
  icon?: ReactNode;
}

export function SearchBox(Props: SearchBoxProps) {
  const { t } = useI18n();
  const {
    value,
    onValueChange,
    placeholder,
    onSearch,
    buttonText,
    icon,
    className = "",
    ...props
  } = Props;
  const actualPlaceholder = placeholder ?? t("searchBox.placeholder");
  const actualButtonText = buttonText ?? t("searchBox.find");
  const classNames = ["search-box", className].filter(Boolean).join(" ");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(value || "");
  };

  return (
    <form className={classNames} onSubmit={handleSubmit} {...props}>
      <div className="search-box__icon">
        {icon || (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        )}
      </div>

      <input
        type="text"
        className="search-box__input"
        placeholder={actualPlaceholder}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      />

      <button type="submit" className="search-box__button">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        {actualButtonText}
      </button>
    </form>
  );
}
