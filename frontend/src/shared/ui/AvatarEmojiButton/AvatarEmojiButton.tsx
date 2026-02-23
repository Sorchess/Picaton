import { useState, useRef, useEffect, type FC } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/shared/config";
import "./AvatarEmojiButton.scss";

// Популярные эмодзи для быстрого выбора
export const EMOJI_CATEGORIES = {
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

export const DEFAULT_PROFILE_EMOJIS = ["🥁", "📈", "🎸", "🧭", "😍", "🫶"];

interface AvatarEmojiButtonProps {
  /** Выбранные эмодзи (массив из 6) */
  selectedEmojis: string[];
  /** Callback при изменении эмодзи */
  onChange: (emojis: string[]) => void;
  /** Максимальное количество эмодзи */
  maxEmojis?: number;
  /** Отключить редактирование */
  disabled?: boolean;
  /** Показать надпись "Сохранение" */
  isSaving?: boolean;
}

export const AvatarEmojiButton: FC<AvatarEmojiButtonProps> = ({
  selectedEmojis,
  onChange,
  maxEmojis = 6,
  disabled = false,
  isSaving = false,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("smileys");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  // Локальный стейт для мгновенного отображения изменений
  const [localEmojis, setLocalEmojis] = useState<string[]>(selectedEmojis);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Синхронизируем локальный стейт с пропсами
  useEffect(() => {
    setLocalEmojis(selectedEmojis);
  }, [selectedEmojis]);

  // Вычисление позиции dropdown
  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = 360; // должно совпадать с SCSS
      const dropdownHeight = 400; // примерная высота dropdown

      // Вычисляем позицию - открываем вниз от кнопки
      let top = rect.bottom + 8;
      let left = rect.left;

      // Проверяем, помещается ли dropdown вниз
      if (top + dropdownHeight > window.innerHeight) {
        // Если не помещается вниз, открываем вверх
        top = rect.top - dropdownHeight - 8;
      }

      // Проверяем, не выходит ли за правый край
      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 16;
      }

      // Проверяем, не выходит ли за левый край
      if (left < 16) {
        left = 16;
      }

      // Проверяем, не выходит ли за верхний край
      if (top < 16) {
        top = 16;
      }

      setDropdownPosition({ top, left });
    }
  };

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setEditingIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Обновляем позицию при открытии и при скролле
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener("scroll", updateDropdownPosition, true);
      window.addEventListener("resize", updateDropdownPosition);
      return () => {
        window.removeEventListener("scroll", updateDropdownPosition, true);
        window.removeEventListener("resize", updateDropdownPosition);
      };
    }
  }, [isOpen]);

  // Обработка выбора эмодзи
  const handleEmojiSelect = (emoji: string) => {
    if (editingIndex !== null) {
      // Создаём массив нужной длины
      const newEmojis = Array.from(
        { length: maxEmojis },
        (_, i) => localEmojis[i] || "",
      );

      // Проверяем, есть ли этот эмодзи уже в каком-то слоте
      const existingIndex = localEmojis.findIndex((e) => e === emoji);
      if (existingIndex !== -1) {
        // Эмодзи уже есть - удаляем его и переключаемся на тот слот
        newEmojis[existingIndex] = "";
        setLocalEmojis(newEmojis);
        setEditingIndex(existingIndex);

        // Убираем пустые строки с конца для сохранения
        const trimmed = [...newEmojis];
        while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
          trimmed.pop();
        }
        onChange(trimmed);
        return;
      }

      // Добавляем эмодзи в текущий слот
      newEmojis[editingIndex] = emoji;

      // Обновляем локальный стейт сразу для мгновенного отображения
      setLocalEmojis(newEmojis);

      // Убираем пустые строки с конца для сохранения
      const emojisToSave = [...newEmojis];
      while (
        emojisToSave.length > 0 &&
        emojisToSave[emojisToSave.length - 1] === ""
      ) {
        emojisToSave.pop();
      }
      onChange(emojisToSave);

      // Переходим к следующему слоту
      const nextIndex = editingIndex + 1;
      if (nextIndex < maxEmojis) {
        setEditingIndex(nextIndex);
      } else {
        // Если дошли до конца, ищем первый пустой слот
        const firstEmptyIndex = newEmojis.findIndex((e) => !e);
        if (firstEmptyIndex !== -1) {
          setEditingIndex(firstEmptyIndex);
        } else {
          // Все слоты заполнены
          setEditingIndex(null);
        }
      }
    }
  };

  // Выбор позиции для редактирования
  const handleSlotClick = (index: number) => {
    setEditingIndex(index);
  };

  // Очистка эмодзи
  const handleClear = () => {
    setLocalEmojis([]);
    onChange([]);
    setEditingIndex(0); // Начинаем с первого слота после очистки
  };

  // Открытие/закрытие попапа
  const togglePicker = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setEditingIndex(0); // По умолчанию выбираем первый слот
    } else {
      setEditingIndex(null);
    }
  };

  return (
    <div className="avatar-emoji-button" ref={pickerRef}>
      {/* Кнопка "+" */}
      <button
        type="button"
        ref={triggerRef}
        className="avatar-emoji-button__trigger"
        onClick={togglePicker}
        disabled={disabled || isSaving}
        title={t("avatarEmoji.changeEmoji")}
      >
        {isSaving ? (
          <span className="avatar-emoji-button__spinner" />
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 1V11M1 6H11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* Выпадающий пикер через портал */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="avatar-emoji-button__dropdown"
            style={{
              position: "fixed",
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок */}
            <div className="avatar-emoji-button__header">
              <span className="avatar-emoji-button__title">
                {t("avatarEmoji.profileEmoji")}
              </span>
              <button
                type="button"
                className="avatar-emoji-button__reset-btn"
                onClick={handleClear}
              >
                {t("avatarEmoji.clear")}
              </button>
            </div>

            {/* Выбранные эмодзи */}
            <div className="avatar-emoji-button__selected">
              {Array.from({ length: maxEmojis }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`avatar-emoji-button__slot ${editingIndex === index ? "avatar-emoji-button__slot--active" : ""} ${!localEmojis[index] ? "avatar-emoji-button__slot--empty" : ""}`}
                  onClick={() => handleSlotClick(index)}
                >
                  {localEmojis[index] || "+"}
                </button>
              ))}
            </div>

            {/* Табы категорий */}
            <div className="avatar-emoji-button__categories">
              {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
                <button
                  key={key}
                  type="button"
                  className={`avatar-emoji-button__category-btn ${activeCategory === key ? "avatar-emoji-button__category-btn--active" : ""}`}
                  onClick={() => setActiveCategory(key)}
                >
                  {category.emojis[0]}
                </button>
              ))}
            </div>

            {/* Список эмодзи */}
            <div className="avatar-emoji-button__grid">
              {EMOJI_CATEGORIES[
                activeCategory as keyof typeof EMOJI_CATEGORIES
              ]?.emojis.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  className={`avatar-emoji-button__grid-emoji ${selectedEmojis.includes(emoji) ? "avatar-emoji-button__grid-emoji--selected" : ""}`}
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
