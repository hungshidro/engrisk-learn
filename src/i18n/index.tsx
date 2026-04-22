"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import vi from "./vi.json";
import en from "./en.json";

type Locale = "vi" | "en";
type Translations = typeof vi;

const translations: Record<Locale, Translations> = { vi, en };

interface I18nContextType {
  locale: Locale;
  t: Translations["app"];
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("locale") as Locale | null;
      if (local === "vi" || local === "en") return local;

      const cookieMatch = document.cookie.match(/(?:^|;\s*)locale=(vi|en)(?:;|$)/);
      if (cookieMatch?.[1] === "vi" || cookieMatch?.[1] === "en") {
        return cookieMatch[1];
      }
    }
    return "vi";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", newLocale);
      document.cookie = `locale=${newLocale}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);

  const t = translations[locale].app;

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export type { Locale };
