import { useTheme } from "@/shared/config/theme";
import "./UserAvatar.scss";

type UserAvatarSize = "sm" | "md" | "lg" | "xl" | "xxl";

interface UserAvatarProps {
  /** URL светлого аватара */
  src?: string | null;
  /** URL темного аватара (опционально) */
  srcDark?: string | null;
  /** Имя пользователя для инициалов */
  firstName?: string;
  /** Фамилия пользователя для инициалов */
  lastName?: string;
  /** Alt текст */
  alt?: string;
  /** Размер */
  size?: UserAvatarSize;
  /** Онлайн статус */
  online?: boolean;
  /** Дополнительные классы */
  className?: string;
}

/**
 * Аватар пользователя с поддержкой темы.
 * Автоматически переключает изображение в зависимости от темы.
 */
export function UserAvatar({
  src,
  srcDark,
  firstName = "",
  lastName = "",
  alt = "User avatar",
  size = "md",
  online,
  className = "",
}: UserAvatarProps) {
  const { theme } = useTheme();

  // Выбираем изображение в зависимости от темы
  const imageSrc = theme === "dark" && srcDark ? srcDark : src;

  // Генерируем инициалы
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  // Генерируем цвет фона на основе имени (для консистентности)
  const getBackgroundColor = () => {
    const str = `${firstName}${lastName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Для темной темы - светлые цвета, для светлой - темные
    if (theme === "dark") {
      const hue = hash % 360;
      return `hsl(${hue}, 60%, 70%)`;
    } else {
      const hue = hash % 360;
      return `hsl(${hue}, 50%, 45%)`;
    }
  };

  const classNames = [
    "user-avatar",
    `user-avatar--${size}`,
    `user-avatar--${theme}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      <div className="user-avatar__inner">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={alt}
            className="user-avatar__image"
            loading="lazy"
          />
        ) : (
          <span
            className="user-avatar__initials"
            style={{ backgroundColor: getBackgroundColor() }}
          >
            {initials}
          </span>
        )}
        <div className="user-avatar__shine" />
      </div>

      {online !== undefined && (
        <span
          className={`user-avatar__status ${
            online
              ? "user-avatar__status--online"
              : "user-avatar__status--offline"
          }`}
        />
      )}
    </div>
  );
}
