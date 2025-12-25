import type { ReactNode } from "react";
import "./Navbar.scss";

interface NavItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  isActive?: boolean;
}

interface NavBarProps {
  logo?: ReactNode;
  items?: NavItem[];
  actions?: ReactNode;
  className?: string;
}

export function NavBar({
  logo,
  items = [],
  actions,
  className = "",
}: NavBarProps) {
  const classNames = ["navbar", className].filter(Boolean).join(" ");

  return (
    <nav className={classNames}>
      <div className="navbar__container">
        {logo && <div className="navbar__logo">{logo}</div>}

        {items.length > 0 && (
          <ul className="navbar__menu">
            {items.map((item, index) => (
              <li key={index} className="navbar__menu-item">
                <a
                  href={item.href || "#"}
                  className={`navbar__link ${
                    item.isActive ? "navbar__link--active" : ""
                  }`}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                >
                  {item.icon && (
                    <span className="navbar__link-icon">{item.icon}</span>
                  )}
                  <span className="navbar__link-text">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {actions && <div className="navbar__actions">{actions}</div>}
      </div>
    </nav>
  );
}
