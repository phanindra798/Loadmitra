/**
 * Cookie-backed key/value storage for small client preferences.
 *
 * Why cookies over localStorage for LoadMitra: this app is server-rendered
 * (TanStack Start), and cookies travel with every request — so the server can
 * read the user's auth/lang/theme during SSR (no flash, no hydration mismatch),
 * which localStorage can't do. We still mirror writes to localStorage as a
 * belt-and-braces fallback for any context where cookies are blocked.
 *
 * Use this for *small* values only (prefs, language, a lightweight auth flag,
 * a compact profile) — never for anything large or sensitive, since cookies
 * are sent on every request.
 *
 * All access is SSR-safe: reads return null on the server, writes are no-ops.
 */

const ONE_YEAR = 60 * 60 * 24 * 365;

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Read a stored string. Cookie first, then localStorage. */
export function readStored(key: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + escapeForRegExp(encodeURIComponent(key)) + "=([^;]*)"),
  );
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Persist a string to a cookie (and mirror to localStorage). */
export function writeStored(key: string, value: string, maxAgeSeconds = ONE_YEAR): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie =
      `${encodeURIComponent(key)}=${encodeURIComponent(value)}` +
      `; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Remove a stored value from both the cookie jar and localStorage. */
export function removeStored(key: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; samesite=lax`;
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Read + parse a JSON value, or return `fallback` if missing/corrupt. */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Serialize + persist a JSON value. */
export function writeJSON<T>(key: string, value: T): void {
  try {
    writeStored(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
