import type { FC } from "react";
import "./SkillTag.scss";

interface SkillTagProps {
  /** Skill name */
  label: string;
  /** Selected state */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS class */
  className?: string;
}

/**
 * Skill tag for skills selection (from Figma)
 */
export const SkillTag: FC<SkillTagProps> = ({
  label,
  isSelected = false,
  onClick,
  disabled = false,
  size = "md",
  className = "",
}) => {
  return (
    <button
      type="button"
      className={`skill-tag skill-tag--${size} ${
        isSelected ? "skill-tag--selected" : ""
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
      {isSelected && (
        <svg className="skill-tag__check" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M11.5 4L5.5 10L2.5 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};

interface SkillTagListProps {
  /** Available skills */
  skills: string[];
  /** Selected skill IDs/names */
  selectedSkills: string[];
  /** Selection change handler */
  onChange: (selectedSkills: string[]) => void;
  /** Maximum selections */
  maxSelections?: number;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS class */
  className?: string;
}

/**
 * Grid of selectable skill tags (from Figma)
 */
export const SkillTagList: FC<SkillTagListProps> = ({
  skills,
  selectedSkills,
  onChange,
  maxSelections,
  size = "md",
  className = "",
}) => {
  const handleToggle = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      onChange(selectedSkills.filter((s) => s !== skill));
    } else {
      if (maxSelections && selectedSkills.length >= maxSelections) {
        return;
      }
      onChange([...selectedSkills, skill]);
    }
  };

  const isMaxReached = Boolean(maxSelections && selectedSkills.length >= maxSelections);

  return (
    <div className={`skill-tag-list ${className}`}>
      {skills.map((skill) => {
        const isSelected = selectedSkills.includes(skill);
        return (
          <SkillTag
            key={skill}
            label={skill}
            isSelected={isSelected}
            onClick={() => handleToggle(skill)}
            disabled={!isSelected && isMaxReached}
            size={size}
          />
        );
      })}
    </div>
  );
};

// Default skills from Figma design
export const defaultSkills = [
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Go",
  "Rust",
  "Machine Learning",
  "Data Science",
  "DevOps",
  "UI/UX Design",
  "Product Management",
  "Marketing",
  "Sales",
  "Finance",
  "HR",
  "Legal",
];
