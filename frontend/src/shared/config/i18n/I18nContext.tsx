import { useState, useCallback, useMemo, type ReactNode } from "react";
import type { Language, TranslationDict } from "./types";
import { I18nContext } from "./context";
import { ru } from "./translations/ru";
import { en } from "./translations/en";

const LANGUAGE_STORAGE_KEY = "picaton-language";

const translations: Record<Language, TranslationDict> = { ru, en };

function getInitialLanguage(userLanguage?: string): Language {
  // 1. Check user's saved language from backend
  if (userLanguage === "ru" || userLanguage === "en") {
    return userLanguage;
  }
  // 2. Check localStorage
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(
      LANGUAGE_STORAGE_KEY,
    ) as Language | null;
    if (stored === "ru" || stored === "en") {
      return stored;
    }
  }
  // 3. Default to Russian
  return "ru";
}

interface I18nProviderProps {
  children: ReactNode;
  userLanguage?: string;
}

export function I18nProvider({ children, userLanguage }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() =>
    getInitialLanguage(userLanguage),
  );

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = translations[language][key] ?? translations["ru"][key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return text;
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
