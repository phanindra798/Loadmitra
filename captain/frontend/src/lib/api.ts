/**
 * Thin client for the shared LoadMitra API (server/). The JWT is kept in
 * cookie-backed storage and sent as a Bearer token (the server also sets an
 * httpOnly cookie). Override the base URL per environment with VITE_API_URL.
 */
import { readStored, writeStored, removeStored } from "./storage";
import { mergeTrips } from "@/features/captain/trip-record";
import type {
  CaptainProfile,
  EarningsSummary,
  LoadRequest,
  Trip,
  TripStatus,
} from "@/features/captain/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "lm-captain-token";

export const getToken = () => readStored(TOKEN_KEY);
const sessionEvent = "loadmitra:captain-session-changed";
const notifySession = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(sessionEvent)); };
export const setToken = (token: string) => { writeStored(TOKEN_KEY, token); notifySession(); };
export const clearToken = () => { removeStored(TOKEN_KEY); notifySession(); };
export function subscribeSession(onChange: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === TOKEN_KEY || event.key === null) onChange();
  };
  window.addEventListener(sessionEvent, onChange);
  window.addEventListener("storage", storageChanged);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(sessionEvent, onChange);
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener("focus", onChange);
  };
}

export interface ApiUser {
  id: string;
  role: "shipper" | "captain";
  name: string;
  email: string;
  phone: string;
  dialCode: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(BASE_URL + path, { ...init, headers, credentials: "include" });
  } catch (error) {
    if (init.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ApiError(0, "Can't reach the server. Is the API running?");
  }
  const data = await res.json().catch((error: unknown) => {
    if (init.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    return {};
  });
  // A delayed response from an old account must never enter the new session's UI.
  if (token && getToken() !== token) throw new DOMException("Session changed", "AbortError");
  if (!res.ok) {
    if (token && (res.status === 401 || res.status === 403) &&
        (path.startsWith("/api/captain/") || path === "/api/auth/me")) clearToken();
    throw new ApiError(res.status, data?.error ?? "Something went wrong", data?.code ?? data?.error);
  }
  return data as T;
}

type Role = "shipper" | "captain";

export const api = {
  sendOtp: (phone: string, role: Role) =>
    request<{ sent: boolean; devOtp?: string }>("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone, role }),
    }),
  verifyOtp: (payload: {
    phone: string;
    role: Role;
    otp: string;
    name?: string;
    email?: string;
    dialCode?: string;
  }) =>
    request<{ token: string; user: ApiUser }>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: (signal?: AbortSignal) => request<{ user: ApiUser }>("/api/auth/me", { signal, cache: "no-store" }),
  updateMe: (payload: { name?: string; email?: string }) =>
    request<{ user: ApiUser }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
};

/**
 * Captain domain endpoints (shared server, /api/captain/*). All responses are
 * wrapped as `{ data }`; these unwrap to the bare payload. Shapes match
 * features/captain/types exactly, so server data is a drop-in for the mock seed.
 */
export const captainApi = {
  profile: (signal?: AbortSignal) => request<{ data: CaptainProfile }>("/api/captain/me", { signal, cache: "no-store" }).then(r => r.data),
  requests: (signal?: AbortSignal) => request<{ data: LoadRequest[] }>("/api/captain/requests", { signal, cache: "no-store" }).then(r => r.data),
  trips: (signal?: AbortSignal) => request<{ data: Trip[]; activeTrip?: Trip | null }>("/api/captain/trips", { signal, cache: "no-store" })
    .then(r => r.activeTrip ? mergeTrips(r.data, [r.activeTrip]) : r.data),
  trip: (id: string, signal?: AbortSignal) => request<{ data: Trip }>(`/api/captain/trips/${encodeURIComponent(id)}`, { signal, cache: "no-store" }).then(r => r.data),
  earnings: (signal?: AbortSignal) => request<{ data: EarningsSummary }>("/api/captain/earnings", { signal, cache: "no-store" }).then(r => r.data),
  accept: (id: string, signal?: AbortSignal) =>
    request<{ data: Trip }>(`/api/captain/requests/${encodeURIComponent(id)}/accept`, {
      method: "POST", body: "{}", signal,
    }).then(r => r.data),
  updateStatus: (id: string, status: TripStatus, otp?: string, signal?: AbortSignal) =>
    request<{ data: Trip }>(`/api/captain/trips/${encodeURIComponent(id)}/status`, {
      method: "POST", signal, body: JSON.stringify({ status, ...(otp ? { otp } : {}) }),
    }).then(r => r.data),
};
