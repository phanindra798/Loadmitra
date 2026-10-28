/**
 * Domain types for the shared LoadMitra API. Mirrors the shipper + captain
 * frontend types so estimates and payloads match byte-for-byte on both sides.
 */

export type BookingMode = "full" | "shared" | "return";
/** Captain-side alias — same three modes, named for the driver's view of a load. */
export type LoadMode = BookingMode;

export interface TruckType {
  id: string;
  name: string;
  desc: string;
  capacityKg: number;
  capacityCFT: number;
  vehicleFactor: number; // retained for catalogue compatibility
  ratePerKm: number; // ₹/km for this vehicle — drives shipper pricing
  baseFare: number;
  etaMins: number;
  rating: number;
  trips: number;
  emoji: string;
}

export interface PriceBreakdown {
  mode: BookingMode;
  distanceKm: number;
  ratePerKm: number; // ₹/km used for this estimate (the vehicle's market rate)
  base: number;
  distanceCharge: number;
  surgeMultiplier: number;
  subtotal: number;
  discountPct: number;
  discount: number;
  sharePct?: number;
  estimate: number;
  low: number;
  high: number;
  loadTons: number;
  perTon: number;
  perTonLow: number;
  perTonHigh: number;
  savings: number;
  co2SavedKg: number;
}

export interface Place {
  label: string;
  address: string;
  city: string;
}

export interface Payout {
  fare: number;
  commissionPct: number;
  commission: number;
  incentive: number;
  net: number;
  perKm: number;
}

export interface CaptainProfile {
  id: string;
  name: string;
  phoneMasked: string;
  vehicleNumber: string;
  truckTypeId: string;
  rating: number;
  trips: number;
  joinedLabel: string;
  hue: number;
  kycVerified: boolean;
  city: string;
}

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
  etaToPickupMins: number;
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
  ratingGiven?: number;
}

export interface EarningEntry {
  id: string;
  label: string;
  mode: LoadMode;
  dateLabel: string;
  net: number;
  legacyEstimate?: boolean;
}

export interface EarningsSummary {
  today: number;
  week: number;
  month: number;
  tripsToday: number;
  onlineHoursToday: number | null;
  incentiveThisWeek: number;
  acceptanceRate: number | null;
  ledger: EarningEntry[];
  timeZone?: string;
  weekly?: { date: string; day: string; net: number }[];
  unknownCompletionTrips?: number;
}
