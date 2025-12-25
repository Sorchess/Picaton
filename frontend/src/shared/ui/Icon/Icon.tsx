import type { HTMLAttributes, ReactNode } from "react";
import "./Icon.scss";

interface IconProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Icon({
  size = "md",
  className = "",
  children,
  ...props
}: IconProps) {
  const classNames = ["icon", `icon--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}
