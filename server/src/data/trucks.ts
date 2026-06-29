import type { TruckType } from "../types";

/**
 * Editable rate card + truck catalogue, shared by shipper pricing and captain
 * payouts. In the DB phase this becomes the `PricingRule` collection (per region
 * + vehicle type) that Admin edits at runtime — the shape stays the same.
 */
export const PRICING_CONFIG = {
  region: "default",
  ratePerKm: 13, // ₹/km regional baseline — captain payouts (earnings.service) scale this by vehicleFactor
  returnDiscount: 0.25,
  shareDiscount: 0.2,
  rangeSpread: 0.08,
  surgeMultiplier: 1.0, // FUTURE HOOK — dynamic pricing layers in here
  co2PerKm: 0.85,
};

// Shipper pricing uses each truck's ratePerKm (market rate per vehicle class);
// captain payouts use vehicleFactor × PRICING_CONFIG.ratePerKm. Both kept in sync
// with the respective frontends (shipper pricing.ts / captain earnings.ts).
export const TRUCK_TYPES: TruckType[] = [
  { id: "ace", name: "Tata Ace", desc: "Up to 750 kg • 7 ft open", capacityKg: 750, capacityCFT: 180, vehicleFactor: 1.0, ratePerKm: 18, baseFare: 250, etaMins: 6, rating: 4.8, trips: 1240, emoji: "🛻" },
  { id: "pickup8", name: "Pickup 8 ft", desc: "Up to 1,200 kg • 8 ft", capacityKg: 1200, capacityCFT: 260, vehicleFactor: 1.25, ratePerKm: 24, baseFare: 320, etaMins: 9, rating: 4.7, trips: 980, emoji: "🚐" },
  { id: "tata407", name: "Tata 407", desc: "Up to 2,500 kg • 9 ft", capacityKg: 2500, capacityCFT: 420, vehicleFactor: 1.7, ratePerKm: 30, baseFare: 480, etaMins: 12, rating: 4.8, trips: 1530, emoji: "🚚" },
  { id: "truck14", name: "14 ft Truck", desc: "Up to 3,500 kg • 14 ft", capacityKg: 3500, capacityCFT: 720, vehicleFactor: 2.1, ratePerKm: 36, baseFare: 650, etaMins: 18, rating: 4.6, trips: 870, emoji: "🚛" },
  { id: "truck17", name: "17 ft Truck", desc: "Up to 5,000 kg • 17 ft", capacityKg: 5000, capacityCFT: 980, vehicleFactor: 2.6, ratePerKm: 44, baseFare: 850, etaMins: 24, rating: 4.7, trips: 640, emoji: "🚛" },
];

export function truckById(id: string): TruckType | undefined {
  return TRUCK_TYPES.find((t) => t.id === id);
}

const INTERCITY_KM: Record<string, number> = {
  "hyderabad|bengaluru": 575,
  "hyderabad|chennai": 627,
  "hyderabad|vijayawada": 275,
  "hyderabad|visakhapatnam": 618,
  "hyderabad|warangal": 145,
  "hyderabad|guntur": 290,
  "hyderabad|pune": 560,
  "hyderabad|mumbai": 710,
  "hyderabad|nagpur": 500,
  "bengaluru|chennai": 350,
  "bengaluru|mumbai": 985,
  "vijayawada|visakhapatnam": 350,
  "chennai|coimbatore": 510,
};

function cityKey(s: string): string {
  return s
    .toLowerCase()
    .split(",")[0]
    .replace(/bangalore/, "bengaluru")
    .replace(/vizag/, "visakhapatnam")
    .replace(/[^a-z]/g, "")
    .trim();
}

/**
 * Deterministic distance fallback until real geocoding lands (Phase 3). Known
 * intercity pairs use a lookup; same-city and unknown pairs hash to a stable
 * pseudo-distance so estimates never jump between calls.
 */
export function estimateDistanceKm(from?: string, to?: string): number {
  if (!from || !to) return 0;
  const a = cityKey(from);
  const b = cityKey(to);
  if (a && a === b) {
    let h = 0;
    const s = from + to;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 8 + (h % 24);
  }
  const direct = INTERCITY_KM[`${a}|${b}`] ?? INTERCITY_KM[`${b}|${a}`];
  if (direct) return direct;
  let h = 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 60 + (h % 560);
}
