import { useState, useRef, useEffect, type FC } from "react";
import { useI18n } from "@/shared/config";
import "./EmojiPicker.scss";

// Популярные эмодзи для быстрого выбора
const EMOJI_CATEGORIES = {
  smileys: {
    label: "emojiPicker.smileys",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "🥲",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "😮‍💨",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
    ],
  },
  gestures: {
    label: "emojiPicker.gestures",
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "✍️",
      "💪",
      "🦾",
      "🦿",
      "🫶",
      "🫱",
      "🫲",
      "🫳",
      "🫴",
    ],
  },
  hearts: {
    label: "emojiPicker.hearts",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❤️‍🔥",
      "❤️‍🩹",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
    ],
  },
  activities: {
    label: "emojiPicker.activities",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🪃",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛼",
      "🛷",
      "⛸️",
      "🥌",
      "🎿",
      "⛷️",
      "🏂",
      "🪂",
      "🏋️",
      "🤼",
      "🤸",
      "⛹️",
    ],
  },
  music: {
    label: "emojiPicker.music",
    emojis: [
      "🎵",
      "🎶",
      "🎼",
      "🎤",
      "🎧",
      "🎷",
      "🎸",
      "🎹",
      "🎺",
      "🎻",
      "🪕",
      "🥁",
      "🪘",
      "🪗",
      "🎬",
      "🎭",
      "🎨",
      "🎪",
      "🎫",
      "🎰",
    ],
  },
  tech: {
    label: "emojiPicker.technology",
    emojis: [
      "💻",
      "🖥️",
      "🖨️",
      "⌨️",
      "🖱️",
      "🖲️",
      "💽",
      "💾",
      "💿",
      "📀",
      "📱",
      "📲",
      "☎️",
      "📞",
      "📟",
      "📠",
      "📺",
      "📻",
      "🎙️",
      "🎚️",
      "🎛️",
      "🧭",
      "⏱️",
      "⏲️",
      "⏰",
      "🕰️",
      "⌛",
      "⏳",
      "📡",
      "🔋",
    ],
  },
  nature: {
    label: "emojiPicker.nature",
    emojis: [
      "🌸",
      "💮",
      "🏵️",
      "🌹",
      "🥀",
      "🌺",
      "🌻",
      "🌼",
      "🌷",
      "🌱",
      "🪴",
      "🌲",
      "🌳",
      "🌴",
      "🌵",
      "🌾",
      "🌿",
      "☘️",
      "🍀",
      "🍁",
      "🍂",
      "🍃",
      "🪹",
      "🪺",
      "🍇",
      "🍈",
      "🍉",
      "🍊",
      "🍋",
      "🍌",
    ],
  },
  objects: {
    label: "emojiPicker.objects",
    emojis: [
      "🎁",
      "🎈",
      "🎀",
      "🪄",
      "🔮",
      "🧿",
      "🎮",
      "🕹️",
      "🎲",
      "🧩",
      "🧸",
      "🪆",
      "🎴",
      "🃏",
      "👓",
      "🕶️",
      "🥽",
      "🧳",
      "👜",
      "👛",
      "👝",
      "💼",
      "🎒",
      "🧵",
      "🪡",
      "🧶",
      "👑",
      "👒",
      "🎩",
      "🎓",
    ],
  },
  symbols: {
    label: "emojiPicker.symbols",
    emojis: [
      "⭐",
      "🌟",
      "✨",
      "💫",
      "🔥",
      "💥",
      "💢",
      "💦",
      "💨",
      "🕳️",
      "💣",
      "💬",
      "👁️‍🗨️",
      "🗨️",
      "🗯️",
      "💭",
      "💤",
      "🔴",
      "🟠",
      "🟡",
      "🟢",
      "🔵",
      "🟣",
      "🟤",
      "⚫",
      "⚪",
      "🟥",
      "🟧",
      "🟨",
      "🟩",
      "🟦",
      "🟪",
      "🟫",
      "⬛",
      "⬜",
      "◼️",
      "◻️",
      "🔶",
      "🔷",
      "🔸",
    ],
  },
  travel: {
    label: "emojiPicker.transport",
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎️",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🛻",
      "🚚",
      "🚛",
      "🚜",
      "🏍️",
      "🛵",
      "🚲",
      "🛴",
      "🛹",
      "🛼",
      "✈️",
      "🛫",
      "🛬",
      "🛩️",
      "🚀",
      "🛸",
      "🚁",
      "🛶",
      "⛵",
      "🚤",
    ],
  },
};

// Экспортируем категории для использования в других компонентах
export { EMOJI_CATEGORIES };

// Дефолтные эмодзи для профиля
export const DEFAULT_PROFILE_EMOJIS = ["🥁", "📈", "🎸", "🧭", "😍", "🫶"];

interface EmojiPickerProps {
  /** Выбранные эмодзи (массив из 6) */
  selectedEmojis: string[];
  /** Callback при изменении эмодзи */
  onChange: (emojis: string[]) => void;
  /** Максимальное количество эмодзи */
  maxEmojis?: number;
  /** Отключить редактирование */
  disabled?: boolean;
}

export const EmojiPicker: FC<EmojiPickerProps> = ({
  selectedEmojis,
  onChange,
  maxEmojis = 6,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("smileys");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setEditingIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Обработка выбора эмодзи
  const handleEmojiSelect = (emoji: string) => {
    if (editingIndex !== null) {
      // Заменяем эмодзи в указанной позиции
      const newEmojis = [...selectedEmojis];
      newEmojis[editingIndex] = emoji;
      onChange(newEmojis);
      setEditingIndex(null);
      setIsOpen(false);
    }
  };

  // Открытие пикера для редактирования конкретной позиции
  const handleEmojiClick = (index: number) => {
    if (disabled) return;
    setEditingIndex(index);
    setIsOpen(true);
  };

  // Сброс к дефолтным
  const handleReset = () => {
    onChange([...DEFAULT_PROFILE_EMOJIS]);
    setIsOpen(false);
    setEditingIndex(null);
  };

  return (
    <div className="emoji-picker" ref={pickerRef}>
      {/* Отображение выбранных эмодзи */}
      <div className="emoji-picker__selected">
        <span className="emoji-picker__label">
          {t("emojiPicker.profileEmoji")}
        </span>
        <div className="emoji-picker__emojis">
          {selectedEmojis.slice(0, maxEmojis).map((emoji, index) => (
            <button
              key={index}
              type="button"
              className={`emoji-picker__emoji-btn ${editingIndex === index ? "emoji-picker__emoji-btn--active" : ""}`}
              onClick={() => handleEmojiClick(index)}
              disabled={disabled}
              title={t("emojiPicker.changeEmoji", { n: String(index + 1) })}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Выпадающий пикер */}
      {isOpen && (
        <div className="emoji-picker__dropdown">
          {/* Заголовок с кнопкой сброса */}
          <div className="emoji-picker__header">
            <span className="emoji-picker__title">
              {editingIndex !== null
                ? t("emojiPicker.selectEmojiN", { n: String(editingIndex + 1) })
                : t("emojiPicker.selectEmoji")}
            </span>
            <button
              type="button"
              className="emoji-picker__reset-btn"
              onClick={handleReset}
            >
              {t("emojiPicker.reset")}
            </button>
          </div>

          {/* Табы категорий */}
          <div className="emoji-picker__categories">
            {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
              <button
                key={key}
                type="button"
                className={`emoji-picker__category-btn ${activeCategory === key ? "emoji-picker__category-btn--active" : ""}`}
                onClick={() => setActiveCategory(key)}
              >
                {category.emojis[0]}
              </button>
            ))}
          </div>

          {/* Список эмодзи */}
          <div className="emoji-picker__grid">
            {EMOJI_CATEGORIES[
              activeCategory as keyof typeof EMOJI_CATEGORIES
            ]?.emojis.map((emoji, index) => (
              <button
                key={index}
                type="button"
                className={`emoji-picker__grid-emoji ${selectedEmojis.includes(emoji) ? "emoji-picker__grid-emoji--selected" : ""}`}
                onClick={() => handleEmojiSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
