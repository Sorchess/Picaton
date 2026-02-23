import type { FC } from "react";
import type { I18nContextType } from "@/shared/config";
import "./FeatureCard.scss";

interface FeatureCardProps {
  /** Emoji icon */
  emoji: string;
  /** Feature title */
  title: string;
  /** Feature description */
  description: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Feature card for onboarding welcome screen (from Figma)
 */
export const FeatureCard: FC<FeatureCardProps> = ({
  emoji,
  title,
  description,
  className = "",
}) => {
  return (
    <div className={`feature-card ${className}`}>
      <div className="feature-card__emoji">{emoji}</div>
      <div className="feature-card__content">
        <h3 className="feature-card__title">{title}</h3>
        <p className="feature-card__description">{description}</p>
      </div>
    </div>
  );
};

interface FeatureCardListProps {
  /** Feature cards data */
  features: Array<{
    emoji: string;
    title: string;
    description: string;
  }>;
  /** Additional CSS class */
  className?: string;
}

/**
 * List of feature cards for welcome screen
 */
export const FeatureCardList: FC<FeatureCardListProps> = ({
  features,
  className = "",
}) => {
  return (
    <div className={`feature-card-list ${className}`}>
      {features.map((feature, index) => (
        <FeatureCard
          key={index}
          emoji={feature.emoji}
          title={feature.title}
          description={feature.description}
        />
      ))}
    </div>
  );
};

// Default features from Figma design
export const getDefaultFeatures = (t: I18nContextType["t"]) => [
  {
    emoji: "🤝",
    title: t("featureCard.findExperts"),
    description: t("featureCard.findExpertsDesc"),
  },
  {
    emoji: "💼",
    title: t("featureCard.shareCard"),
    description: t("featureCard.shareCardDesc"),
  },
  {
    emoji: "📱",
    title: t("featureCard.qrCode"),
    description: t("featureCard.qrCodeDesc"),
  },
];
