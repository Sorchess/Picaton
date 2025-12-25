import { useState, useEffect, type ReactNode } from "react";
import "./Modal.scss";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
  className = "",
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Сначала рендерим элемент (isVisible)
      setIsVisible(true);
      // Затем на следующем кадре добавляем класс анимации
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      document.body.style.overflow = "hidden";
    } else {
      // Сначала убираем класс анимации
      setIsAnimating(false);
      // Затем после завершения анимации убираем элемент
      const timer = setTimeout(() => setIsVisible(false), 500);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  const overlayClassNames = [
    "modal-overlay",
    isAnimating && "modal-overlay--active",
  ]
    .filter(Boolean)
    .join(" ");

  const modalClassNames = ["modal", `modal--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={overlayClassNames} onClick={onClose}>
      <div className={modalClassNames} onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Закрыть">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {title && <h2 className="modal__title">{title}</h2>}

        <div className="modal__content">{children}</div>
      </div>
    </div>
  );
}
