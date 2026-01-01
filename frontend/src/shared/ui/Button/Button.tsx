import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.scss";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button(Props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth = false,
    className = "",
    children,
    ...props
  } = Props;
  const classNames = [
    "button",
    `button--${variant}`,
    `button--${size}`,
    fullWidth && "button--full-width",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  );
}
