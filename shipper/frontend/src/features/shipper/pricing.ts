import type { BookingMode, PriceBreakdown, TruckType } from "./types";

/**
 * Market-range pricing estimator (no payment processing).
 *
 * Mirrors the editable `PricingRule` concept from the spec: a regional rate
 * card plus per-vehicle factors. The displayed number is always an ESTIMATE
 * shown as a range — money is settled offline in this version.
 *
 *   fullEstimate    = baseFare + distanceKm × truck.ratePerKm
 *   returnEstimate  = fullEstimate × (1 − returnDiscount)
 *   sharedEstimate  = (loadWeightKg / capacityKg) × fullEstimate × (1 − shareDiscount)
 *
 * Per-km rates are realistic India market rates per vehicle class (mini ≈ ₹18,
 * LCV ≈ ₹24, medium ≈ ₹30, large ≈ ₹36, heavy ≈ ₹44 / km). `surgeMultiplier`
 * is a deliberate hook for future demand/time/fuel-based dynamic pricing — it
 * stays at 1.0 here so the formula never changes when a surge layer is added.
 */
export const PRICING_CONFIG = {
  region: "default",
  returnDiscount: 0.25, // 20–30% configurable
  shareDiscount: 0.2,
  rangeSpread: 0.08, // ±8% displayed range — freight pricing is negotiable
  surgeMultiplier: 1.0, // FUTURE HOOK — do not implement surge logic here yet
  co2PerKm: 0.85, // kg CO₂ avoided per empty km saved (illustrative)
} as const;

export interface EstimateInput {
  truck: TruckType;
  distanceKm: number;
  mode: BookingMode;
  loadWeightKg?: number;
}

export function estimatePrice({
  truck,
  distanceKm,
  mode,
  loadWeightKg,
}: EstimateInput): PriceBreakdown {
  const cfg = PRICING_CONFIG;

  const base = truck.baseFare;
  const distanceCharge = distanceKm * truck.ratePerKm;
  const subtotal = (base + distanceCharge) * cfg.surgeMultiplier;

  let estimate = subtotal;
  let discountPct = 0;
  let sharePct: number | undefined;
  let co2 = 0;

  if (mode === "return") {
    discountPct = cfg.returnDiscount;
    estimate = subtotal * (1 - discountPct);
    co2 = distanceKm * cfg.co2PerKm;
  } else if (mode === "shared") {
    const weight = loadWeightKg ?? Math.round(truck.capacityKg * 0.4);
    sharePct = Math.min(1, Math.max(0.1, weight / truck.capacityKg));
    discountPct = cfg.shareDiscount;
    estimate = sharePct * subtotal * (1 - discountPct);
    co2 = distanceKm * cfg.co2PerKm * (1 - sharePct);
  }

  const savings = mode === "full" ? 0 : Math.max(0, subtotal - estimate);
  const low = Math.round((estimate * (1 - cfg.rangeSpread)) / 10) * 10;
  const high = Math.round((estimate * (1 + cfg.rangeSpread)) / 10) * 10;

  // Per-tonne rate — freight in India is commonly quoted per tonne.
  const loadTons = Math.max(0.1, (loadWeightKg ?? truck.capacityKg) / 1000);
  const round10 = (n: number) => Math.round(n / 10) * 10;

  return {
    mode,
    distanceKm: Math.round(distanceKm),
    ratePerKm: truck.ratePerKm,
    base: Math.round(base),
    distanceCharge: Math.round(distanceCharge),
    surgeMultiplier: cfg.surgeMultiplier,
    subtotal: Math.round(subtotal),
    discountPct,
    discount: Math.round(subtotal - estimate),
    sharePct,
    estimate: Math.round(estimate),
    low,
    high,
    loadTons: Math.round(loadTons * 10) / 10,
    perTon: round10(estimate / loadTons),
    perTonLow: round10(low / loadTons),
    perTonHigh: round10(high / loadTons),
    savings: Math.round(savings),
    co2SavedKg: Math.round(co2 * 10) / 10,
  };
}

/** ₹ formatting in the Indian numbering system, no decimals. */
export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function priceRangeLabel(p: PriceBreakdown): string {
  return `${inr(p.low)} – ${inr(p.high)}`;
}

/**
 * Deterministic distance estimate between two place strings. Uses a small
 * intercity table for realism and a stable hash fallback otherwise. Stable
 * (no Date/Math.random) so server and client renders agree.
 *
 * Swap this for the Google Distance Matrix call when the backend lands.
 */
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

export function estimateDistanceKm(from?: string, to?: string): number {
  if (!from || !to) return 0;
  const a = cityKey(from);
  const b = cityKey(to);
  if (a && a === b) {
    // intra-city move — short, stable pseudo distance 8–32 km
    let h = 0;
    for (let i = 0; i < (from + to).length; i++) h = (h * 31 + (from + to).charCodeAt(i)) >>> 0;
    return 8 + (h % 24);
  }
  const direct = INTERCITY_KM[`${a}|${b}`] ?? INTERCITY_KM[`${b}|${a}`];
  if (direct) return direct;
  let h = 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 60 + (h % 560); // 60–620 km
}
