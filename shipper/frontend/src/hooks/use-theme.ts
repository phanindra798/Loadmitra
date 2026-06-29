import { useCallback, useEffect, useState } from "react";
import { readStored, writeStored } from "@/lib/storage";

export type Theme = "light" | "dark";

const STORAGE_KEY = "lm-theme";

/**
 * Shared light/dark theme hook used by both the marketing landing page and the
 * shipper app. State is persisted in a cookie under `lm-theme` (so the server
 * can read it during SSR) and applied by toggling the `dark` class on <html>.
 *
 * SSR-safe: all `window` / `document` / storage access happens inside effects
 * (never during render) to avoid hydration mismatches under TanStack Start's
 * server rendering.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  // Mount: read the persisted (or system) preference and apply it once.
  useEffect(() => {
    let initial: Theme = "light";
    try {
      const saved = readStored(STORAGE_KEY) as Theme | null;
      initial =
        saved ??
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch {
      /* storage unavailable — fall back to light */
    }
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    setReady(true);
  }, []);

  // Persist + apply on every subsequent change (skip the first run).
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeStored(STORAGE_KEY, theme);
  }, [theme, ready]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggle };
}
