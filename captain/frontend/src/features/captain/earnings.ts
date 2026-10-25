import type { LoadMode, Payout, TruckType } from "./types";

/**
 * Captain-side economics. The customer-facing fare is computed with the SAME
 * market-range formula as the shipper app and backend (so both sides agree),
 * then the captain payout is fare − platform commission + any incentive.
 *
 *   fare       = baseFare + distanceKm × truck.ratePerKm   (× mode)
 *   commission = fare × commissionPct
 *   incentive  = return/shared bonus (we reward filling empty trips)
 *   net        = fare − commission + incentive
 *
 * `surgeMultiplier` is a deliberate future hook (stays 1.0) so the formula
 * never changes when a dynamic-earnings layer is added later.
 */
export const EARNINGS_CONFIG = {
  returnDiscount: 0.25,
  shareDiscount: 0.2,
  commissionPct: 0.15, // platform take on a standard load
  returnIncentivePct: 0.06, // bonus the captain keeps for running a return load
  sharedIncentivePct: 0.04,
  surgeMultiplier: 1.0, // FUTURE HOOK — do not implement surge logic here yet
} as const;

export interface FareInput {
  truck: TruckType;
  distanceKm: number;
  mode: LoadMode;
  loadWeightKg?: number;
}

/** Customer-facing fare estimate for a load (point estimate, ₹). */
export function estimateFare({ truck, distanceKm, mode, loadWeightKg }: FareInput): number {
  const cfg = EARNINGS_CONFIG;
  const subtotal = (truck.baseFare + distanceKm * truck.ratePerKm) * cfg.surgeMultiplier;

  if (mode === "return") return Math.round(subtotal * (1 - cfg.returnDiscount));
  if (mode === "shared") {
    const weight = loadWeightKg ?? Math.round(truck.capacityKg * 0.4);
    const sharePct = Math.min(1, Math.max(0.1, weight / truck.capacityKg));
    return Math.round(sharePct * subtotal * (1 - cfg.shareDiscount));
  }
  return Math.round(subtotal);
}

/** Break a fare down into what the captain actually keeps. */
export function captainPayout(fare: number, mode: LoadMode, distanceKm: number): Payout {
  const cfg = EARNINGS_CONFIG;
  const commission = fare * cfg.commissionPct;
  const incentivePct =
    mode === "return" ? cfg.returnIncentivePct : mode === "shared" ? cfg.sharedIncentivePct : 0;
  const incentive = fare * incentivePct;
  const net = fare - commission + incentive;
  return {
    fare: Math.round(fare),
    commissionPct: cfg.commissionPct,
    commission: Math.round(commission),
    incentive: Math.round(incentive),
    net: Math.round(net),
    perKm: distanceKm > 0 ? Math.round((net / distanceKm) * 10) / 10 : 0,
  };
}

/** Convenience: fare + payout in one call for a truck/route/mode. */
export function quotePayout(input: FareInput): Payout {
  const fare = estimateFare(input);
  return captainPayout(fare, input.mode, input.distanceKm);
}

/** ₹ formatting in the Indian numbering system, no decimals. */
export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
