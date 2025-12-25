import "./StatsCard.scss";

interface StatsCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatsCard({
  value,
  label,
  icon,
  className = "",
}: StatsCardProps) {
  const classNames = ["stats-card", className].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      {icon && <div className="stats-card__icon">{icon}</div>}
      <div className="stats-card__content">
        <div className="stats-card__value">{value}</div>
        <div className="stats-card__label">{label}</div>
      </div>
    </div>
  );
}
