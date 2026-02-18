import { forwardRef, useId, type InputHTMLAttributes } from "react";
import "./Input.scss";

export type InputVariant = "default" | "transparent";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  variant?: InputVariant;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      variant = "default",
      fullWidth = false,
      className = "",
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const classNames = [
      "input",
      fullWidth && "input--full-width",
      error && "input--error",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={classNames}>
        {label && (
          <label className="input__label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input__field ${variant ? `input__field--${variant}` : ""}`}
          {...props}
        />
        {error && <span className="input__error">{error}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";
