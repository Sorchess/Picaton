import { useState } from "react";
import type { SkillWithEndorsements, EndorserInfo } from "@/api/endorsementApi";
import { Avatar } from "../Avatar";
import "./EndorsableSkill.scss";

interface EndorsableSkillProps {
  skill: SkillWithEndorsements;
  onToggleEndorse?: (tagId: string) => Promise<void>;
  canEndorse?: boolean;
  isLoading?: boolean;
}

export function EndorsableSkill({
  skill,
  onToggleEndorse,
  canEndorse = true,
  isLoading = false,
}: EndorsableSkillProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showEndorsers, setShowEndorsers] = useState(false);

  const handleClick = async () => {
    if (!canEndorse || !onToggleEndorse || isLoading) return;

    setIsAnimating(true);
    try {
      await onToggleEndorse(skill.tag_id);
    } finally {
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const isEndorsed = skill.endorsed_by_current_user;
  const count = skill.endorsement_count;

  return (
    <div className="endorsable-skill">
      <button
        type="button"
        className={`endorsable-skill__tag ${
          isEndorsed ? "endorsable-skill__tag--endorsed" : ""
        } ${isAnimating ? "endorsable-skill__tag--animating" : ""} ${
          !canEndorse ? "endorsable-skill__tag--disabled" : ""
        }`}
        onClick={handleClick}
        disabled={!canEndorse || isLoading}
        onMouseEnter={() => count > 0 && setShowEndorsers(true)}
        onMouseLeave={() => setShowEndorsers(false)}
      >
        <span className="endorsable-skill__name">{skill.tag_name}</span>

        {count > 0 && (
          <span className="endorsable-skill__count">
            <HeartIcon filled={isEndorsed} />
            {count}
          </span>
        )}

        {count === 0 && canEndorse && (
          <span className="endorsable-skill__endorse-hint">
            <HeartIcon filled={false} />
          </span>
        )}
      </button>

      {/* Tooltip с endorsers */}
      {showEndorsers && skill.endorsers.length > 0 && (
        <div className="endorsable-skill__tooltip">
          <div className="endorsable-skill__tooltip-title">
            Подтвердили навык:
          </div>
          <div className="endorsable-skill__endorsers">
            {skill.endorsers.slice(0, 5).map((endorser) => (
              <EndorserItem key={endorser.id} endorser={endorser} />
            ))}
            {count > 5 && (
              <div className="endorsable-skill__more">и ещё {count - 5}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EndorserItem({ endorser }: { endorser: EndorserInfo }) {
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="endorsable-skill__endorser">
      <Avatar
        src={endorser.avatar_url ?? undefined}
        alt={endorser.name}
        initials={getInitials(endorser.name)}
        size="sm"
      />
      <span className="endorsable-skill__endorser-name">{endorser.name}</span>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        className="endorsable-skill__heart endorsable-skill__heart--filled"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }

  return (
    <svg
      className="endorsable-skill__heart"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
