import type { ReactNode, HTMLAttributes } from "react";
import "./Card.scss";

export type CardVariant = "default" | "interactive";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

export function CardDivider() {
  return <div className="section-divider" />;
}

export function Card(Props: CardProps) {
  const {
    variant = "default",
    padding = "lg",
    className = "",
    children,
    ...props
  } = Props;
  const classNames = [
    "card",
    `card--${variant}`,
    `card--padding-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...props}>
      <div className="card__content">{children}</div>
    </div>
  );
}
