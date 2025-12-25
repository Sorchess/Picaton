import type { AnchorHTMLAttributes, ReactNode } from "react";
import "./SocialLink.scss";

interface SocialLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

export function SocialLink({
  className = "",
  children,
  ...props
}: SocialLinkProps) {
  const classNames = ["social-link", className].filter(Boolean).join(" ");

  return (
    <a className={classNames} {...props}>
      {children}
    </a>
  );
}
