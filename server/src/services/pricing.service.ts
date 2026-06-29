import { PRICING_CONFIG } from "../data/trucks";
import { estimateDistanceKm, truckById } from "../data/trucks";
import type { BookingMode, PriceBreakdown, TruckType } from "../types";

// Re-exported so controllers have a single import surface for pricing.
export { estimateDistanceKm, truckById };

/**
 * Market-range pricing estimator. Kept byte-for-byte equivalent to the shipper
 * frontend `pricing.ts` so estimates match on both sides.
 */
export function estimatePrice(opts: {
  truck: TruckType;
  distanceKm: number;
  mode: BookingMode;
  loadWeightKg?: number;
}): PriceBreakdown {
  const { truck, distanceKm, mode, loadWeightKg } = opts;
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
