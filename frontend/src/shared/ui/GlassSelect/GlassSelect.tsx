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
          width="11"
          height="16"
          viewBox="0 0 11 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.25879 -0.000644788C5.51495 -0.000644788 5.73344 0.104834 5.9444 0.300722L10.2313 4.41438C10.3971 4.58014 10.5101 4.79109 10.5101 5.05479C10.5101 5.55958 10.1108 5.92875 9.63615 5.92875C9.42519 5.92875 9.19917 5.86095 9.00328 5.67259L5.25879 2.00345L1.50677 5.67259C1.31088 5.86848 1.08485 5.92875 0.873897 5.92875C0.399243 5.92875 -6.83405e-05 5.55958 -6.83405e-05 5.05479C-6.83405e-05 4.79109 0.112944 4.58014 0.28623 4.41438L4.56564 0.300722C4.7766 0.104834 4.99509 -0.000644788 5.25879 -0.000644788ZM5.25879 15.0979C4.99509 15.0979 4.7766 14.9924 4.56564 14.789L0.28623 10.6828C0.112944 10.5171 -6.83405e-05 10.3061 -6.83405e-05 10.0424C-6.83405e-05 9.53763 0.399243 9.16845 0.873897 9.16845C1.08485 9.16845 1.31088 9.22873 1.50677 9.42461L5.25879 13.0862L9.00328 9.42461C9.19917 9.23626 9.42519 9.16845 9.63615 9.16845C10.1108 9.16845 10.5101 9.53763 10.5101 10.0424C10.5101 10.3061 10.3971 10.5171 10.2313 10.6828L5.9444 14.789C5.73344 14.9924 5.51495 15.0979 5.25879 15.0979Z"
            fill="currentColor"
            fill-opacity="0.3"
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
