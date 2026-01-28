import { useState, useEffect, type ReactNode } from "react";
import "./Modal.scss";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
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
      // Lock scroll on iOS Safari
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
    } else if (isVisible) {
      // Сначала убираем класс анимации
      hideTimer = setTimeout(() => {
        setIsAnimating(false);
        // Затем после завершения анимации убираем элемент
        setTimeout(() => setIsVisible(false), 500);
      }, 0);
      // Restore scroll
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      // Ensure scroll is restored when component unmounts
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
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

  const modalClassNames = ["modal", className]
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
