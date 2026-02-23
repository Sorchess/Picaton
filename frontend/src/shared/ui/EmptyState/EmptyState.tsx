import type { FC, ReactNode } from "react";
import { useI18n } from "@/shared/config";
import "./EmptyState.scss";

interface EmptyStateProps {
  /** Illustration or icon */
  icon?: ReactNode;
  /** Emoji illustration */
  emoji?: string;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Action button */
  action?: ReactNode;
  /** Additional CSS class */
  className?: string;
}

/**
 * Empty state placeholder (from Figma)
 * Used when lists are empty or no results found
 */
export const EmptyState: FC<EmptyStateProps> = ({
  icon,
  emoji,
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div className={`empty-state ${className}`}>
      {(icon || emoji) && (
        <div className="empty-state__illustration">
          {icon || <span className="empty-state__emoji">{emoji}</span>}
        </div>
      )}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
};

// Preset empty states from Figma
export const EmptySearchState: FC = () => {
  const { t } = useI18n();
  return (
    <EmptyState
      emoji="🔍"
      title={t("emptyState.startSearch")}
      description={t("emptyState.startSearchDesc")}
    />
  );
};

export const NoResultsState: FC<{ query?: string }> = ({ query }) => {
  const { t } = useI18n();
  return (
    <EmptyState
      emoji="😕"
      title={t("emptyState.nothingFound")}
      description={
        query
          ? t("emptyState.nothingFoundDesc", { query })
          : t("emptyState.tryChangeParams")
      }
    />
  );
};

export const EmptyContactsState: FC<{ onAdd?: () => void }> = () => {
  const { t } = useI18n();
  return (
    <EmptyState
      emoji="👥"
      title={t("emptyState.noContacts")}
      description={t("emptyState.noContactsDesc")}
    />
  );
};
