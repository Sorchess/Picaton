import { useState, useRef, useEffect, type ReactNode } from "react";
import "./GlassSelect.scss";

export interface GlassSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface GlassSelectProps {
  options: GlassSelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function GlassSelect({
  options,
  value,
  onChange,
  className = "",
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`glass-select ${className}`} ref={ref}>
      <button
        className="glass-select__trigger"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="glass-select__value">{selected?.label}</span>
        <svg
          className={`glass-select__arrows ${open ? "glass-select__arrows--open" : ""}`}
          width="10"
          height="16"
          viewBox="0 0 12 20"
          fill="none"
        >
          <path
            d="M6 2C6.25 2 6.47 2.1 6.68 2.3L10.97 6.41C11.13 6.58 11.25 6.79 11.25 7.05C11.25 7.55 10.85 7.92 10.38 7.92C10.17 7.92 9.94 7.85 9.74 7.66L6 3.99L2.25 7.66C2.05 7.86 1.83 7.92 1.62 7.92C1.14 7.92 0.74 7.55 0.74 7.05C0.74 6.79 0.86 6.58 1.03 6.41L5.31 2.3C5.52 2.1 5.74 2 6 2ZM6 18C5.74 18 5.52 17.9 5.31 17.7L1.03 13.59C0.86 13.42 0.74 13.21 0.74 12.95C0.74 12.45 1.14 12.08 1.62 12.08C1.83 12.08 2.05 12.14 2.25 12.34L6 16L9.74 12.34C9.94 12.15 10.17 12.08 10.38 12.08C10.85 12.08 11.25 12.45 11.25 12.95C11.25 13.21 11.13 13.42 10.97 13.59L6.68 17.7C6.47 17.9 6.25 18 6 18Z"
            fill="currentColor"
            fillOpacity="0.3"
          />
        </svg>
      </button>

      {open && (
        <div className="glass-select__dropdown">
          {options.map((option) => (
            <button
              key={option.value}
              className={`glass-select__option ${option.value === value ? "glass-select__option--active" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              type="button"
            >
              {option.icon && (
                <span className="glass-select__option-icon">{option.icon}</span>
              )}
              <span className="glass-select__option-label">{option.label}</span>
              {option.value === value && (
                <svg
                  className="glass-select__check"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
