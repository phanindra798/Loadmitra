/**
 * Thin client for the shared LoadMitra API (server/). The JWT is kept in
 * cookie-backed storage and sent as a Bearer token (the server also sets an
 * httpOnly cookie). Override the base URL per environment with VITE_API_URL.
 */
import { readStored, writeStored, removeStored } from "./storage";
import type { BookingMode, PriceBreakdown, TruckType } from "@/features/shipper/types";
import { restoreBooking, type BookingRecord } from "@/features/shipper/booking-record";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "lm-token";

export const getToken = () => readStored(TOKEN_KEY);
const sessionEvent = "loadmitra:session-changed";
const notifySession = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(sessionEvent)); };
export const setToken = (t: string) => { writeStored(TOKEN_KEY, t); notifySession(); };
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
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the API running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Something went wrong", data?.error);
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
  me: () => request<{ user: ApiUser }>("/api/auth/me"),
  updateMe: (payload: { name?: string; email?: string }) =>
    request<{ user: ApiUser }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(payload) }),
  // Pass the token explicitly: callers clear it locally before this request runs.
  logout: (token?: string | null) =>
    request<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
};

/**
 * Shipper domain endpoints (shared server). The pricing formula on the server
 * matches features/shipper/pricing.ts exactly, so a server estimate equals the
 * local compute — the screens fall back to local if the API is unreachable.
 */
export interface EstimateBody {
  truckTypeId: string;
  mode: BookingMode;
  distanceKm?: number;
  pickupCity?: string;
  dropCity?: string;
  loadWeightKg?: number;
}

export interface Place {
  label: string;
  address: string;
  city: string;
}

export interface CreateBookingBody {
  bookingId: string;
  mode: BookingMode;
  pickup: Place;
  drop: Place;
  distanceKm: number;
  truckTypeId: string;
  truckTypeName: string;
  loadWeightKg: number;
  goodsType: string;
  agreedPrice?: number;
  customerName?: string;
  createdLabel?: string;
}

export const shipperApi = {
  listBookings: (before?: string, signal?: AbortSignal) =>
    request<{ data: BookingRecord[]; nextCursor: string | null }>(
      `/api/bookings${before ? `?before=${encodeURIComponent(before)}` : ""}`, { signal, cache: "no-store" },
    ).then(r => ({ bookings: r.data.map(restoreBooking), nextCursor: r.nextCursor })),
  issueHandoverOtp: (id: string) =>
    request<{ data: { code: string; stage: "picked" | "delivered"; expiresAt: string } }>(
      `/api/bookings/${encodeURIComponent(id)}/handover-otp`, { method: "POST" },
    ).then((r) => r.data),
  cancelBooking: (id: string) => request<{ data: BookingRecord }>(`/api/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" }).then(r => restoreBooking(r.data)),
  trucks: () => request<{ data: TruckType[] }>("/api/trucks").then((r) => r.data),
  estimate: (body: EstimateBody) =>
    request<{ data: PriceBreakdown }>("/api/pricing/estimate", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),
  // Persist a booking before continuing to matching.
  createBooking: (body: CreateBookingBody) =>
    request<{ data: BookingRecord }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => restoreBooking(r.data)),
  // Poll a booking to learn when a captain accepted, and who. Drives the
  // shipper matching screen — the real captain replaces the local placeholder.
  getBooking: (id: string, signal?: AbortSignal) =>
    request<{ data: BookingRecord }>(`/api/bookings/${encodeURIComponent(id)}`, { signal, cache: "no-store" })
      .then(r => restoreBooking(r.data)),
};
