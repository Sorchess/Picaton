import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./IconButton.scss";

export type IconButtonVariant = "default" | "ghost" | "elevated" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: ReactNode;
}

export function IconButton({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...props
}: IconButtonProps) {
  const classNames = [
    "icon-button",
    `icon-button--${variant}`,
    `icon-button--${size}`,
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
