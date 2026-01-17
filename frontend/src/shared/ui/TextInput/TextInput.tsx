import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useState } from "react";
import "./TextInput.scss";

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Label text */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Left icon */
  leftIcon?: ReactNode;
  /** Right icon */
  rightIcon?: ReactNode;
  /** Input size */
  size?: "sm" | "md" | "lg";
  /** Full width */
  fullWidth?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Text input with label and validation (from Figma)
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      size = "md",
      fullWidth = true,
      className = "",
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div
        className={`text-input text-input--${size} ${fullWidth ? "text-input--full-width" : ""} ${
          error ? "text-input--error" : ""
        } ${disabled ? "text-input--disabled" : ""} ${className}`}
      >
        {label && (
          <label htmlFor={inputId} className="text-input__label">
            {label}
          </label>
        )}

        <div
          className={`text-input__wrapper ${isFocused ? "text-input__wrapper--focused" : ""}`}
        >
          {leftIcon && <span className="text-input__icon text-input__icon--left">{leftIcon}</span>}

          <input
            ref={ref}
            id={inputId}
            className="text-input__field"
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {rightIcon && (
            <span className="text-input__icon text-input__icon--right">{rightIcon}</span>
          )}
        </div>

        {(helperText || error) && (
          <span className={`text-input__helper ${error ? "text-input__helper--error" : ""}`}>
            {error || helperText}
          </span>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";
