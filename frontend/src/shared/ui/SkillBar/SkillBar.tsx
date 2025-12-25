import type { HTMLAttributes } from "react";
import "./SkillBar.scss";

interface SkillBarProps extends HTMLAttributes<HTMLDivElement> {
  progress: number; // 0-100
  animated?: boolean;
}

export function SkillBar({
  progress,
  animated = true,
  className = "",
  ...props
}: SkillBarProps) {
  const classNames = ["skill-bar", animated && "skill-bar--animated", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...props}>
      <div
        className="skill-bar__progress"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
