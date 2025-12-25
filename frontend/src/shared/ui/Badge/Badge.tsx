import type { HTMLAttributes, ReactNode } from "react";
import "./Badge.scss";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  dot?: boolean;
  dotColor?: "success" | "error" | "warning" | "default";
  children: ReactNode;
}

export function Badge({
  dot = false,
  dotColor = "success",
  className = "",
  children,
  ...props
}: BadgeProps) {
  const classNames = ["badge", className].filter(Boolean).join(" ");

  return (
    <div className={classNames} {...props}>
      {dot && <span className={`badge__dot badge__dot--${dotColor}`} />}
      {children}
    </div>
  );
}
