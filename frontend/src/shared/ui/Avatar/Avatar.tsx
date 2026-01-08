import type { HTMLAttributes } from "react";
import "./Avatar.scss";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  /** Инициалы пользователя (если нет изображения) */
  initials?: string;
  /** URL изображения аватара */
  src?: string;
  /** Alt текст для изображения */
  alt?: string;
  /** Размер аватара */
  size?: AvatarSize;
  /** Показать индикатор онлайн */
  online?: boolean;
  /** Показать бейдж верификации */
  verified?: boolean;
}

export function Avatar({
  initials,
  src,
  alt = "Avatar",
  size = "md",
  online,
  className = "",
  ...props
}: AvatarProps) {
  const classNames = ["avatar", `avatar--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...props}>
      <div className="avatar__inner">
        {src ? (
          <img src={src} alt={alt} className="avatar__image" />
        ) : (
          <span className="avatar__initials">{initials}</span>
        )}
        <div className="avatar__shine" />
      </div>

      {online && <span className="avatar__status avatar__status--online" />}
    </div>
  );
}

export type { AvatarSize };
