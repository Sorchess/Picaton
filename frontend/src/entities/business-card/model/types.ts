// Типы визитных карточек

export interface CardTagInfo {
  id: string;
  name: string;
  category: string;
  proficiency: number;
}

export interface CardContactInfo {
  type: string;
  value: string;
  is_primary: boolean;
  is_visible: boolean;
}

export interface BusinessCard {
  id: string;
  owner_id: string;
  title: string;
  is_primary: boolean;
  is_active: boolean;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  ai_generated_bio: string | null;
  tags: CardTagInfo[];
  search_tags: string[];
  contacts: CardContactInfo[];
  random_facts: string[];
  completeness: number;
  emojis: string[];
  position: string | null;
}

export interface BusinessCardPublic {
  id: string;
  owner_id: string;
  title: string;
  is_primary?: boolean;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  ai_generated_bio: string | null;
  tags: CardTagInfo[];
  search_tags: string[];
  contacts: CardContactInfo[];
  completeness: number;
  emojis: string[];
  position: string | null;
}

export interface BusinessCardCreate {
  title?: string;
  display_name?: string;
  is_primary?: boolean;
}

export interface BusinessCardUpdate {
  title?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_active?: boolean | null;
  position?: string | null;
}

export interface BusinessCardListResponse {
  cards: BusinessCard[];
  total: number;
}

export interface CardContactAdd {
  type: string;
  value: string;
  is_primary?: boolean;
  is_visible?: boolean;
}

export interface DocumentTranscribeResponse {
  /** Извлечённый текст из документа */
  text: string;
  /** Оригинальное имя файла */
  filename: string;
  /** Определённый формат (pdf, docx, txt, rtf) */
  format: string;
  /** Количество символов */
  char_count: number;
  /** Был ли текст обрезан */
  was_truncated: boolean;
}

export interface SpeechRecognitionResponse {
  /** Распознанный текст */
  text: string;
}
