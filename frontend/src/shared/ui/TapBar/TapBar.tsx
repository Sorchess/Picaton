import { useState, useRef, useEffect, type ReactNode } from "react";
import "./TapBar.scss";

export interface TapBarOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

interface TapBarProps {
  options: TapBarOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TapBar(Props: TapBarProps) {
  const {
    options,
    value,
    defaultValue,
    onChange,
    size = "md",
    className = "",
  } = Props;
  const [internalValue, setInternalValue] = useState(
    defaultValue || options[0]?.value,
  );
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevLeftRef = useRef<number | null>(null);
  const isInitialRender = useRef(true);

  const activeValue = value !== undefined ? value : internalValue;

  useEffect(() => {
    const activeButton = optionRefs.current.get(activeValue);
    const container = containerRef.current;

    if (!activeButton || !container) {
      // No matching option — hide the indicator
      setIndicatorStyle({ width: 0, opacity: 0 });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const newLeft = buttonRect.left - containerRect.left;

    // При первом рендере только запоминаем позицию без анимации
    if (isInitialRender.current) {
      isInitialRender.current = false;
      prevLeftRef.current = newLeft;
      setIndicatorStyle({
        width: buttonRect.width,
        left: newLeft,
      });
      return;
    }

    // Определяем направление движения только если позиция изменилась
    if (prevLeftRef.current !== null && prevLeftRef.current !== newLeft) {
      const newDirection = newLeft > prevLeftRef.current ? "right" : "left";
      setDirection(newDirection);
      setIsAnimating(true);

      // Сбрасываем анимацию после завершения
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 500);

      prevLeftRef.current = newLeft;

      setIndicatorStyle({
        width: buttonRect.width,
        left: newLeft,
      });

      return () => clearTimeout(timer);
    }

    prevLeftRef.current = newLeft;
    setIndicatorStyle({
      width: buttonRect.width,
      left: newLeft,
    });
  }, [activeValue, options]);

  const handleOptionClick = (optionValue: string) => {
    if (value === undefined) {
      setInternalValue(optionValue);
    }
    onChange?.(optionValue);
  };

  const classNames = ["tapbar", `tapbar--${size}`, className]
    .filter(Boolean)
    .join(" ");

  const indicatorClassNames = [
    "tapbar__indicator",
    isAnimating && direction === "right" && "tapbar__indicator--bounce-right",
    isAnimating && direction === "left" && "tapbar__indicator--bounce-left",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} ref={containerRef}>
      <div className={indicatorClassNames} style={indicatorStyle}>
        <div className="tapbar__indicator-blob" />
      </div>
      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            if (el) {
              optionRefs.current.set(option.value, el);
            }
          }}
          className={`tapbar__option ${
            activeValue === option.value ? "tapbar__option--active" : ""
          }`}
          onClick={() => handleOptionClick(option.value)}
          type="button"
        >
          {option.icon && (
            <span className="tapbar__option-icon">{option.icon}</span>
          )}
          <span className="tapbar__option-label">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
