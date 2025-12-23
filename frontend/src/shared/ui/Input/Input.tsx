import { forwardRef, type InputHTMLAttributes } from "react";
import "./Input.scss";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth = false, className = "", id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

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
        <input ref={ref} id={inputId} className="input__field" {...props} />
        {error && <span className="input__error">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
