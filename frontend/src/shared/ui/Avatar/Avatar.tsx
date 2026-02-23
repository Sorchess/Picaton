import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type HTMLAttributes,
} from "react";
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
  /** Персональный градиент аватарки ["#color1", "#color2"] */
  gradientColors?: string[] | null;
}

// Кэш доминантных цветов по URL, чтобы не перевычислять
const colorCache = new Map<string, string>();

/** Конвертировать hex цвет в формат "r, g, b" для CSS rgba() */
function hexToRgb(hex: string): string | undefined {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return undefined;
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function getDominantColor(img: HTMLImageElement): string {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";

    // Маленький размер для быстрого анализа
    const size = 16;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);

    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0,
      g = 0,
      b = 0,
      count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      // Пропускаем прозрачные и почти чёрные/белые пиксели
      if (alpha < 128) continue;
      const pr = data[i],
        pg = data[i + 1],
        pb = data[i + 2];
      if (pr + pg + pb < 30 || pr + pg + pb > 720) continue;
      r += pr;
      g += pg;
      b += pb;
      count++;
    }

    if (count === 0) return "";

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    return `${r}, ${g}, ${b}`;
  } catch {
    return "";
  }
}

export function Avatar({
  initials,
  src,
  alt = "Avatar",
  size = "md",
  online,
  className = "",
  gradientColors,
  ...props
}: AvatarProps) {
  const [glowColor, setGlowColor] = useState<string | undefined>(
    src ? colorCache.get(src) : undefined,
  );
  const imgRef = useRef<HTMLImageElement>(null);

  const extractColor = useCallback(() => {
    const img = imgRef.current;
    if (!img || !src) return;

    if (colorCache.has(src)) {
      setGlowColor(colorCache.get(src));
      return;
    }

    const color = getDominantColor(img);
    if (color) {
      colorCache.set(src, color);
      setGlowColor(color);
    }
  }, [src]);

  // Сбрасываем цвет при смене src
  useEffect(() => {
    if (src && colorCache.has(src)) {
      setGlowColor(colorCache.get(src));
    } else {
      setGlowColor(undefined);
    }
  }, [src]);

  const classNames = ["avatar", `avatar--${size}`, className]
    .filter(Boolean)
    .join(" ");

  // Вычисляем glow цвет на основе градиента пользователя
  const gradientGlowColor =
    gradientColors && gradientColors.length >= 1
      ? hexToRgb(gradientColors[0])
      : undefined;

  const resolvedGlowColor =
    glowColor ??
    gradientGlowColor ??
    (!src ? "var(--color-accent-rgb)" : undefined);

  const hasCustomGradient =
    !src && gradientColors && gradientColors.length >= 2;

  const style: React.CSSProperties = {
    ...(resolvedGlowColor ? { "--avatar-glow-color": resolvedGlowColor } : {}),
    ...(hasCustomGradient
      ? {
          "--avatar-gradient-from": gradientColors![0],
          "--avatar-gradient-to": gradientColors![1],
        }
      : {}),
  } as React.CSSProperties;

  return (
    <div className={classNames} style={style} {...props}>
      {resolvedGlowColor && (
        <div className="avatar__glow avatar__glow--dynamic" />
      )}
      <div
        className={[
          "avatar__inner",
          hasCustomGradient ? "avatar__inner--custom-gradient" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="avatar__image"
            crossOrigin="anonymous"
            onLoad={extractColor}
          />
        ) : (
          <span className="avatar__initials">{initials}</span>
        )}
      </div>

      {online && <span className="avatar__status avatar__status--online" />}
    </div>
  );
}

export type { AvatarSize };
