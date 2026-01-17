import type { FC, ButtonHTMLAttributes, ReactNode } from "react";
import "./PrimaryButton.scss";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Button variant */
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** Left icon */
  leftIcon?: ReactNode;
  /** Right icon */
  rightIcon?: ReactNode;
}

/**
 * Primary gradient button from Figma design
 * Features: gradient background, shadow, hover effects
 */
export const PrimaryButton: FC<PrimaryButtonProps> = ({
  children,
  fullWidth = false,
  isLoading = false,
  size = "md",
  variant = "primary",
  leftIcon,
  rightIcon,
  disabled,
  className = "",
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      className={`
        primary-button
        primary-button--${size}
        primary-button--${variant}
        ${fullWidth ? "primary-button--full-width" : ""}
        ${isLoading ? "primary-button--loading" : ""}
        ${className}
      `.trim().replace(/\s+/g, " ")}
      disabled={isDisabled}
      {...props}
    >
      {isLoading && (
        <span className="primary-button__loader">
          <svg className="primary-button__spinner" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="3"
              stroke="currentColor"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
            />
          </svg>
        </span>
      )}
      
      {!isLoading && leftIcon && (
        <span className="primary-button__icon primary-button__icon--left">
          {leftIcon}
        </span>
      )}
      
      <span className="primary-button__text">{children}</span>
      
      {!isLoading && rightIcon && (
        <span className="primary-button__icon primary-button__icon--right">
          {rightIcon}
        </span>
      )}
    </button>
  );
};
