import type { HTMLAttributes, ReactNode } from "react";
import "./Tag.scss";

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline";
  size?: "sm" | "md";
  children: ReactNode;
}

export function Tag({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...props
}: TagProps) {
  const classNames = ["tag", `tag--${variant}`, `tag--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} {...props}>
      {children}
    </span>
  );
}
