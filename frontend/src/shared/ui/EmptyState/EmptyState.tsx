import type { FC, ReactNode } from "react";
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
export const EmptySearchState: FC = () => (
  <EmptyState
    emoji="🔍"
    title="Начните поиск"
    description="Введите запрос, чтобы найти специалистов по навыкам или имени"
  />
);

export const NoResultsState: FC<{ query?: string }> = ({ query }) => (
  <EmptyState
    emoji="😕"
    title="Ничего не найдено"
    description={query ? `По запросу "${query}" нет результатов` : "Попробуйте изменить параметры поиска"}
  />
);

export const EmptyContactsState: FC<{ onAdd?: () => void }> = () => (
  <EmptyState
    emoji="👥"
    title="Нет контактов"
    description="Сохраняйте интересных специалистов в контакты"
  />
);
