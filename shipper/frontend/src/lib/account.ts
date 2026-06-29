/**
 * Session + profile helpers backed by the API. The signed-in identity now lives
 * in the database (not the browser) — these wrap the auth endpoints and the JWT.
 */
import { api, getToken, clearToken } from "./api";

export interface Profile {
  name: string;
  email: string;
  phone: string;
}

export function isAuthed(): boolean {
  return Boolean(getToken());
}

/** The signed-in profile from the API (null if logged out or unreachable). */
export async function fetchProfile(): Promise<Profile | null> {
  if (!getToken()) return null;
  try {
    const { user } = await api.me();
    return { name: user.name, email: user.email, phone: user.phone };
  } catch {
    return null;
  }
}

/** Drop the token immediately; best-effort server-side logout in the background. */
export function clearSession(): void {
  clearToken();
  api.logout().catch(() => {});
}
