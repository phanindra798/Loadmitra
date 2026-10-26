/**
 * Domain types for the shipper-facing booking flow.
 *
 * These mirror the backend data model described in the LoadMitra master spec
 * (Load / Booking / CaptainProfile / PricingRule) but are trimmed to what the
 * frontend needs. Keeping them here gives us one source of truth as the API is
 * wired in later — the mock data and the eventual real responses both conform
 * to these shapes.
 */

export type BookingMode = "full" | "shared" | "return";

export type LangCode = "en" | "hi" | "te" | "ta" | "kn" | "ml";

export type PlaceKind = "home" | "work" | "recent" | "saved" | "other";

export interface Place {
  id: string;
  label: string; // short label, e.g. "Home", "HITEC City warehouse"
  address: string; // full address line
  city: string;
  kind: PlaceKind;
}

export interface TruckType {
  id: string;
  name: string;
  desc: string; // "Up to 750 kg • 6×4 ft open"
  capacityKg: number;
  capacityCFT: number;
  vehicleFactor: number; // legacy multiplier (kept for compatibility; ratePerKm now drives pricing)
  ratePerKm: number; // ₹/km for this vehicle (realistic India market rate)
  baseFare: number; // ₹
  etaMins: number; // typical ETA to pickup
  rating: number;
  trips: number;
  emoji: string; // lightweight glyph for the vehicle
}

export interface PriceBreakdown {
  mode: BookingMode;
  distanceKm: number;
  ratePerKm: number; // ₹/km used for this estimate (the vehicle's market rate)
  base: number;
  distanceCharge: number;
  surgeMultiplier: number; // future dynamic-pricing hook (always 1.0 for now)
  subtotal: number; // full-truck price after surge, before any discount
  discountPct: number; // 0..1
  discount: number; // ₹ amount removed from subtotal
  sharePct?: number; // for shared loads: fraction of the truck this load uses
  estimate: number; // point estimate after discount / share
  low: number; // displayed range low (estimate − spread)
  high: number; // displayed range high (estimate + spread)
  loadTons: number; // tonnage used for the per-tonne rate
  perTon: number; // ₹ per tonne (estimate / loadTons)
  perTonLow: number; // per-tonne range low
  perTonHigh: number; // per-tonne range high
  savings: number; // ₹ saved vs a full-truck booking
  co2SavedKg: number;
}

export type BookingStatus =
  | "requested"
  | "accepted"
  | "enroute_pickup"
  | "at_pickup"
  | "picked"
  | "enroute_drop"
  | "delivered"
  | "cancelled";

export interface Captain {
  id: string;
  name: string;
  vehicleNumber: string;
  truckTypeId: string;
  rating: number;
  trips: number;
  phoneMasked: string;
  etaMins: number;
  hue: number; // avatar accent hue (0-360)
  badges: Array<"verified" | "return" | "shared">;
}

export interface Booking {
  id: string;
  mode: BookingMode;
  pickup: Place;
  drop: Place;
  truckTypeId: string;
  truckTypeName: string;
  loadWeightKg: number;
  goodsType: string;
  price: PriceBreakdown;
  agreedPrice?: number;
  status: BookingStatus;
  captain?: Captain;
  createdLabel: string;
  scheduledLabel?: string;
  createdAt?: string;
  updatedAt?: string;
  priceBreakdownAvailable?: boolean;
}

/** The in-progress booking the user is assembling across the flow. */
export interface BookingDraft {
  mode: BookingMode;
  pickup?: Place;
  drop?: Place;
  truckTypeId?: string;
  loadWeightKg: number;
  goodsType: string;
}

export interface Offer {
  id: string;
  title: string;
  desc: string;
  code: string;
  tone: "savings" | "cyan" | "primary" | "success";
  icon: "return" | "share" | "first" | "refer";
}
