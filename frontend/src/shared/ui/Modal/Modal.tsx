import { useState, useEffect, type ReactNode } from "react";
import "./Modal.scss";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
  className?: string;
  /** Закрывать при клике на overlay (по умолчанию true) */
  closeOnOverlayClick?: boolean;
  /** Закрывать при нажатии Escape (по умолчанию true) */
  closeOnEscape?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  children,
  size = "md",
  className = "",
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Управляем видимостью и анимацией через отдельные эффекты
  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout>;
    let animationFrame: number;
    let hideTimer: ReturnType<typeof setTimeout>;

    if (isOpen) {
      // Сначала рендерим элемент (isVisible)
      showTimer = setTimeout(() => {
        setIsVisible(true);
        // Затем на следующем кадре добавляем класс анимации
        animationFrame = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAnimating(true);
          });
        });
      }, 0);
      document.body.style.overflow = "hidden";
    } else if (isVisible) {
      // Сначала убираем класс анимации
      hideTimer = setTimeout(() => {
        setIsAnimating(false);
        // Затем после завершения анимации убираем элемент
        setTimeout(() => setIsVisible(false), 500);
      }, 0);
      document.body.style.overflow = "";
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isOpen, isVisible]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose, closeOnEscape]);

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

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div className={overlayClassNames} onClick={handleOverlayClick}>
      <div className={modalClassNames} onClick={(e) => e.stopPropagation()}>
        <div className="modal__content">{children}</div>
      </div>
    </div>
  );
}
