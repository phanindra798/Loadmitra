import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LangCode } from "./types";
import { readStored, writeStored } from "@/lib/storage";
import { translations, type TKey } from "./translations";

/**
 * App-wide internationalization. A persisted language preference (cookie-backed,
 * so SSR can read it), the `<html lang>` attribute, and a `t()` translator that
 * looks up a key in the active language, falls back to English, then to the key
 * itself, and fills `{token}` placeholders from `vars`.
 */

export const LANGS: { code: LangCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
];

const STORAGE_KEY = "lm-lang";

export type Translate = (key: TKey, vars?: Record<string, string | number>) => string;

interface LangContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: Translate;
}

function translate(lang: LangCode, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = translations[lang]?.[key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

const LanguageContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => String(key),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  // Hydrate the saved preference on mount (SSR-safe).
  useEffect(() => {
    const saved = readStored(STORAGE_KEY) as LangCode | null;
    if (saved && LANGS.some((l) => l.code === saved)) {
      setLangState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang: (code) => {
        setLangState(code);
        writeStored(STORAGE_KEY, code);
        if (typeof document !== "undefined") document.documentElement.lang = code;
      },
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Convenience hook for components that only need the translator. */
export function useT(): Translate {
  return useContext(LanguageContext).t;
}
