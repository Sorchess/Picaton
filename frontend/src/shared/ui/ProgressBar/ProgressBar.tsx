import type { FC } from "react";
import "./ProgressBar.scss";

interface ProgressBarProps {
  /** Current step (1-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Show step numbers */
  showSteps?: boolean;
  /** Show percentage */
  showPercentage?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Progress bar for onboarding (from Figma)
 */
export const ProgressBar: FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  showSteps = true,
  showPercentage = false,
  className = "",
}) => {
  const progress = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <div className={`progress-bar ${className}`}>
      {(showSteps || showPercentage) && (
        <div className="progress-bar__info">
          {showSteps && (
            <span className="progress-bar__steps">
              Шаг {currentStep} из {totalSteps}
            </span>
          )}
          {showPercentage && (
            <span className="progress-bar__percentage">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
      <div className="progress-bar__track">
        <div
          className="progress-bar__fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

interface ProgressDotsProps {
  /** Current step (1-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Click handler for dots */
  onDotClick?: (step: number) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Progress dots indicator (alternative style from Figma)
 */
export const ProgressDots: FC<ProgressDotsProps> = ({
  currentStep,
  totalSteps,
  onDotClick,
  className = "",
}) => {
  return (
    <div className={`progress-dots ${className}`}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <button
            key={step}
            type="button"
            className={`progress-dots__dot ${
              isActive ? "progress-dots__dot--active" : ""
            } ${isCompleted ? "progress-dots__dot--completed" : ""}`}
            onClick={() => onDotClick?.(step)}
            disabled={!onDotClick}
            aria-label={`Шаг ${step}`}
          />
        );
      })}
    </div>
  );
};
