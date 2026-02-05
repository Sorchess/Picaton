import type { FC } from "react";
import { Avatar } from "@/shared";
import "./ProfileHeroBlock.scss";

interface ProfileHeroBlockProps {
  /** User name */
  name: string;
  avatarUrl?: string | null;
  roles: string[];
  skillsCount: number;
  likesCount: number;
  emojis?: string[];
  onSkillsClick?: () => void;
  onLikesClick?: () => void;
}

/**
 * Hero block for profile page (from Figma design)
 */
export const ProfileHeroBlock: FC<ProfileHeroBlockProps> = ({
  name,
  avatarUrl,
  roles,
  skillsCount,
  likesCount,
  emojis = [],
  onSkillsClick,
  onLikesClick,
}) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="profile-hero">
      {/* Floating emojis decoration */}
      <div className="profile-hero__emojis">
        {emojis.map((emoji, index) => (
          <span
            key={index}
            className={`profile-hero__emoji profile-hero__emoji--${index + 1}`}
          >
            <span className="profile-hero__emoji-blur">{emoji}</span>
            <span className="profile-hero__emoji-main">{emoji}</span>
          </span>
        ))}
      </div>

      {/* Avatar with glow */}
      <div className="profile-hero__avatar">
        <div className="profile-hero__avatar-glow" />
        <Avatar
          src={avatarUrl || undefined}
          initials={initials}
          size="lg"
          alt={name}
        />
      </div>

      {/* Name and roles */}
      <div className="profile-hero__info">
        <h1 className="profile-hero__name">{name}</h1>
        <div className="profile-hero__roles">
          {roles.map((role, index) => (
            <span key={index} className="profile-hero__role">
              {index > 0 && <span className="profile-hero__dot">•</span>}
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Stats badges */}
      <div className="profile-hero__stats">
        <button
          type="button"
          className="profile-hero__stat profile-hero__stat--skills"
          onClick={onSkillsClick}
        >
          {skillsCount} Навыков
        </button>
        <button
          type="button"
          className="profile-hero__stat profile-hero__stat--likes"
          onClick={onLikesClick}
        >
          {likesCount} Лайков
        </button>
      </div>
    </div>
  );
};
