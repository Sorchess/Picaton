import type { HTMLAttributes, ReactNode } from "react";
import "./Container.scss";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Container({
  className = "",
  children,
  ...props
}: ContainerProps) {
  const classNames = ["container", className].filter(Boolean).join(" ");

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}
