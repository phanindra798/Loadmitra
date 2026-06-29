/**
 * Thin client for the shared LoadMitra API (server/). The JWT is kept in
 * cookie-backed storage and sent as a Bearer token (the server also sets an
 * httpOnly cookie). Override the base URL per environment with VITE_API_URL.
 */
import { readStored, writeStored, removeStored } from "./storage";
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
export const setToken = (t: string) => writeStored(TOKEN_KEY, t);
export const clearToken = () => removeStored(TOKEN_KEY);

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
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
};

/**
 * Captain domain endpoints (shared server, /api/captain/*). All responses are
 * wrapped as `{ data }`; these unwrap to the bare payload. Shapes match
 * features/captain/types exactly, so server data is a drop-in for the mock seed.
 */
/** Captain snapshot sent on accept, so the shipper can show who accepted. */
export interface AcceptCaptain {
  id: string;
  name: string;
  vehicleNumber: string;
  truckTypeId: string;
  rating: number;
  trips: number;
  phoneMasked: string;
  etaMins: number;
  hue: number;
  badges: string[];
}

export const captainApi = {
  profile: () => request<{ data: CaptainProfile }>("/api/captain/me").then((r) => r.data),
  requests: () => request<{ data: LoadRequest[] }>("/api/captain/requests").then((r) => r.data),
  trips: () => request<{ data: Trip[] }>("/api/captain/trips").then((r) => r.data),
  earnings: () => request<{ data: EarningsSummary }>("/api/captain/earnings").then((r) => r.data),
  accept: (id: string, captain?: AcceptCaptain) =>
    request<{ data: Trip }>(`/api/captain/requests/${id}/accept`, {
      method: "POST",
      body: JSON.stringify(captain ? { captain } : {}),
    }).then((r) => r.data),
  updateStatus: (id: string, status: TripStatus, otp?: string) =>
    request<{ data: { id: string; status: TripStatus } }>(`/api/captain/trips/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, ...(otp ? { otp } : {}) }),
    }).then((r) => r.data),
};
