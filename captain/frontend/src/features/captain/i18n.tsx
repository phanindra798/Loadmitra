import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LangCode } from "./types";

/**
 * Lightweight i18n scaffold (shared shape with the shipper app).
 *
 * The full 6-language string catalog (English, Hindi, Telugu, Tamil, Kannada,
 * Malayalam) is a dedicated phase per the master spec. This provides the real
 * seam now: a persisted language preference, the `<html lang>` attribute, and a
 * context so screens can read/switch the language. Wiring i18next + the
 * translated catalog drops in here without touching call sites.
 */

export const LANGS: { code: LangCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
];

const STORAGE_KEY = "lm-captain-lang";

interface LangContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
}

const LanguageContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  // Hydrate the saved preference on mount (SSR-safe).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LangCode | null;
      if (saved && LANGS.some((l) => l.code === saved)) {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang: (code) => {
        setLangState(code);
        try {
          localStorage.setItem(STORAGE_KEY, code);
          document.documentElement.lang = code;
        } catch {
          /* ignore */
        }
      },
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
