export type Language = "ru" | "en";

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export type TranslationDict = Record<string, string>;
