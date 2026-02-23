import type { FC, ReactNode } from "react";
import { useI18n } from "@/shared/config";
import "./PageHeader.scss";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Subtitle */
  subtitle?: string;
  /** Show back button */
  showBack?: boolean;
  /** Back button handler */
  onBack?: () => void;
  /** Right side action */
  rightAction?: ReactNode;
  /** Transparent background */
  transparent?: boolean;
  /** Sticky header */
  sticky?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Page header with title and navigation (from Figma)
 */
export const PageHeader: FC<PageHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  transparent = false,
  sticky = false,
  className = "",
}) => {
  const { t } = useI18n();

  return (
    <header
      className={`page-header ${transparent ? "page-header--transparent" : ""} ${
        sticky ? "page-header--sticky" : ""
      } ${className}`}
    >
      <div className="page-header__left">
        {showBack && onBack && (
          <button
            type="button"
            className="page-header__back"
            onClick={onBack}
            aria-label={t("pageHeader.back")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="page-header__center">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>

      <div className="page-header__right">{rightAction}</div>
    </header>
  );
};

interface OnboardingHeaderProps {
  /** Current step (1-based) */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Show skip button */
  showSkip?: boolean;
  /** Skip handler */
  onSkip?: () => void;
  /** Back handler */
  onBack?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Onboarding header with progress (from Figma)
 */
export const OnboardingHeader: FC<OnboardingHeaderProps> = ({
  currentStep,
  totalSteps,
  showSkip = true,
  onSkip,
  onBack,
  className = "",
}) => {
  const { t } = useI18n();

  return (
    <header className={`onboarding-header ${className}`}>
      <div className="onboarding-header__left">
        {currentStep > 1 && onBack && (
          <button
            type="button"
            className="onboarding-header__back"
            onClick={onBack}
            aria-label={t("pageHeader.back")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="onboarding-header__progress">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`onboarding-header__step ${
              i < currentStep ? "onboarding-header__step--completed" : ""
            } ${i === currentStep - 1 ? "onboarding-header__step--active" : ""}`}
          />
        ))}
      </div>

      <div className="onboarding-header__right">
        {showSkip && onSkip && (
          <button
            type="button"
            className="onboarding-header__skip"
            onClick={onSkip}
          >
            {t("pageHeader.skip")}
          </button>
        )}
      </div>
    </header>
  );
};
