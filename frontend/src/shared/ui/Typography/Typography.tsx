import type { HTMLAttributes, ElementType, ReactNode } from "react";
import "./Typography.scss";

type TypographyVariant =
  | "hero"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "subtitle"
  | "body"
  | "small"
  | "tag";

type TypographyColor = "primary" | "secondary" | "muted" | "inherit";

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant;
  color?: TypographyColor;
  as?: ElementType;
  gradient?: boolean;
  children: ReactNode;
}

const variantMapping: Record<TypographyVariant, ElementType> = {
  hero: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  subtitle: "p",
  body: "p",
  small: "span",
  tag: "span",
};

export function Typography({
  variant = "body",
  color = "primary",
  as,
  gradient = false,
  className = "",
  children,
  ...props
}: TypographyProps) {
  const Component = as || variantMapping[variant];

  const classNames = [
    "typography",
    `typography--${variant}`,
    `typography--${color}`,
    gradient && "typography--gradient",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classNames} {...props}>
      {children}
    </Component>
  );
}
