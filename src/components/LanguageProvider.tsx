"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getTranslation,
  isSupportedLanguage,
  type Language,
} from "@/lib/i18n";

type TranslationValues = Record<string, string | number>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (source: string, values?: TranslationValues) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  const applyLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    document.documentElement.lang = nextLanguage;
  }, []);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(savedLanguage)) applyLanguage(savedLanguage);

    const syncLanguage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY && isSupportedLanguage(event.newValue)) {
        applyLanguage(event.newValue);
      }
    };

    window.addEventListener("storage", syncLanguage);
    return () => window.removeEventListener("storage", syncLanguage);
  }, [applyLanguage]);

  const setLanguage = useCallback(
    (nextLanguage: Language) => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      applyLanguage(nextLanguage);
    },
    [applyLanguage],
  );

  const t = useCallback(
    (source: string, values?: TranslationValues) => getTranslation(language, source, values),
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
