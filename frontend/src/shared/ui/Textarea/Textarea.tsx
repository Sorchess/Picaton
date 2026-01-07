import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import "./Textarea.scss";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, fullWidth = false, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    const classNames = [
      "textarea",
      fullWidth && "textarea--full-width",
      error && "textarea--error",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={classNames}>
        {label && (
          <label className="textarea__label" htmlFor={textareaId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className="textarea__field"
          {...props}
        />
        {error && <span className="textarea__error">{error}</span>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
