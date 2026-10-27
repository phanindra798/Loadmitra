/**
 * Domain types for the captain-facing (driver/owner) app.
 *
 * These mirror the backend data model from the LoadMitra master spec
 * (Load / Booking / CaptainProfile / Trip / PricingRule) but from the supply
 * side: a captain receives Load *requests*, accepts one to start a Trip, drives
 * it through the status lifecycle, and earns a payout (fare minus commission).
 *
 * Statuses are kept identical to the shipper app so the same trip lifecycle and
 * timeline render consistently on both sides as the API is wired in later.
 */

export type LoadMode = "full" | "shared" | "return";

export type LangCode = "en" | "hi" | "te" | "ta" | "kn" | "ml";

export interface Place {
  label: string; // short label, e.g. "HITEC City warehouse"
  address: string; // full address line
  city: string;
}

export interface TruckType {
  id: string;
  name: string;
  desc: string;
  capacityKg: number;
  capacityCFT: number;
  vehicleFactor: number;
  ratePerKm: number;
  baseFare: number;
  emoji: string;
}

/** The logged-in captain (driver/owner). */
export interface CaptainProfile {
  id: string;
  name: string;
  phoneMasked: string;
  vehicleNumber: string;
  truckTypeId: string;
  rating: number;
  trips: number;
  joinedLabel: string;
  hue: number; // avatar accent hue (0-360)
  kycVerified: boolean;
  city: string;
}

/**
 * Captain earnings on a load = customer fare minus the platform commission,
 * plus any return-load / shared incentive. No money moves through the app in
 * this version — these are transparent estimates settled offline.
 */
export interface Payout {
  fare: number; // customer-facing estimate (₹)
  commissionPct: number; // 0..1 platform take
  commission: number; // ₹ removed
  incentive: number; // ₹ added (return-load / surge bonus)
  net: number; // ₹ the captain keeps
  perKm: number; // ₹/km earned
}

/** An incoming job offer broadcast to nearby captains. */
export interface LoadRequest {
  id: string;
  mode: LoadMode;
  pickup: Place;
  drop: Place;
  distanceKm: number;
  truckTypeId: string;
  truckTypeName: string;
  loadWeightKg: number;
  goodsType: string;
  payout: Payout;
  etaToPickupMins: number; // how far the pickup is from the captain
  customerName: string;
  customerRating: number;
  createdLabel: string;
}

export type TripStatus =
  | "accepted"
  | "enroute_pickup"
  | "at_pickup"
  | "picked"
  | "enroute_drop"
  | "delivered"
  | "cancelled";

/** An accepted load the captain is (or was) running. */
export interface Trip {
  id: string;
  mode: LoadMode;
  pickup: Place;
  drop: Place;
  distanceKm: number;
  truckTypeId: string;
  truckTypeName: string;
  loadWeightKg: number;
  goodsType: string;
  payout: Payout;
  customerName: string;
  customerRating: number;
  status: TripStatus;
  createdLabel: string;
  createdAt?: string;
  updatedAt?: string;
  ratingGiven?: number; // stars the captain gave the customer
}

/** One row in the earnings ledger. */
export interface EarningEntry {
  id: string;
  label: string; // route, e.g. "Gachibowli → Vijayawada"
  mode: LoadMode;
  dateLabel: string;
  net: number;
}

export interface EarningsSummary {
  today: number;
  week: number;
  month: number;
  tripsToday: number;
  onlineHoursToday: number;
  incentiveThisWeek: number;
  acceptanceRate: number; // 0..1
  ledger: EarningEntry[];
}
