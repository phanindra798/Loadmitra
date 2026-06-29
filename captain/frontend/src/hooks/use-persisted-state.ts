import { useEffect, useRef, useState } from "react";
import { readJSON, writeJSON } from "@/lib/storage";

/**
 * Like useState, but hydrated from cookie-backed storage on mount and persisted
 * on every change. During SSR / first paint it returns `initial` (so server and
 * client markup match), then swaps in the stored value once mounted.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    setValue(readJSON<T>(key, initial));
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    writeJSON(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
