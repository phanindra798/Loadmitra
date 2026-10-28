import { estimatePrice } from "./pricing.service";
import { estimateDistanceKm, truckById } from "../data/trucks";
import type { LoadMode, Payout, TruckType } from "../types";

// Re-exported so captain controllers have a single import surface.
export { estimateDistanceKm, truckById };

/**
 * Captain-side economics. The customer fare uses the SAME market-range formula
 * as the shipper estimate (shared rate card in data/trucks), then the captain
 * payout is fare − platform commission + any return/shared incentive.
 */
const COMMISSION_PCT = 0.15;
const RETURN_INCENTIVE_PCT = 0.06;
const SHARED_INCENTIVE_PCT = 0.04;

export function estimateFare(opts: {
  truck: TruckType;
  distanceKm: number;
  mode: LoadMode;
  loadWeightKg?: number;
}): number {
  return estimatePrice(opts).estimate;
}

export function captainPayout(fare: number, mode: LoadMode, distanceKm: number): Payout {
  const roundedFare = Math.round(fare);
  const commission = Math.round(roundedFare * COMMISSION_PCT);
  const incentivePct =
    mode === "return" ? RETURN_INCENTIVE_PCT : mode === "shared" ? SHARED_INCENTIVE_PCT : 0;
  const incentive = Math.round(roundedFare * incentivePct);
  const net = roundedFare - commission + incentive;
  return {
    fare: Math.round(fare),
    commissionPct: COMMISSION_PCT,
    commission: Math.round(commission),
    incentive: Math.round(incentive),
    net: Math.round(net),
    perKm: distanceKm > 0 ? Math.round((net / distanceKm) * 10) / 10 : 0,
  };
}

export function quotePayout(opts: {
  truck: TruckType;
  distanceKm: number;
  mode: LoadMode;
  loadWeightKg?: number;
}): Payout {
  const fare = estimateFare(opts);
  return captainPayout(fare, opts.mode, opts.distanceKm);
}
