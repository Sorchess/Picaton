import type { ReactNode } from "react";
import "./ProcessStep.scss";

interface ProcessStepProps {
  step: number;
  title: string;
  description: string;
  icon?: ReactNode;
  isLast?: boolean;
  className?: string;
}

export function ProcessStep({
  step,
  title,
  description,
  icon,
  isLast = false,
  className = "",
}: ProcessStepProps) {
  const classNames = ["process-step", isLast && "process-step--last", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      <div className="process-step__indicator">
        <div className="process-step__number">
          {icon || <span>{step}</span>}
        </div>
        {!isLast && <div className="process-step__line" />}
      </div>

      <div className="process-step__content">
        <h3 className="process-step__title">{title}</h3>
        <p className="process-step__description">{description}</p>
      </div>
    </div>
  );
}
