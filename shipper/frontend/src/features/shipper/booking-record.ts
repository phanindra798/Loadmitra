import type { Booking, BookingMode, BookingStatus, Captain, PriceBreakdown } from "./types";

export interface BookingRecord {
  id: string;
  mode: BookingMode;
  pickup: { label: string; address: string; city: string };
  drop: { label: string; address: string; city: string };
  distanceKm: number;
  truckTypeId: string;
  truckTypeName: string;
  loadWeightKg: number;
  goodsType: string;
  agreedPrice: number;
  priceSnapshot: PriceBreakdown | null;
  status: "open" | "accepted" | "cancelled";
  tripStatus: Exclude<BookingStatus, "requested"> | null;
  captain: Captain | null;
  createdLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export function restoreBooking(record: BookingRecord): Booking {
  const fare = record.agreedPrice;
  // Legacy bookings have an agreed fare but no itemized snapshot. Do not reprice
  // them against today's catalogue; the UI hides the unavailable breakdown.
  const price: PriceBreakdown = record.priceSnapshot ?? {
    mode: record.mode, distanceKm: record.distanceKm, estimate: fare, low: fare, high: fare,
    base: 0, distanceCharge: 0, ratePerKm: 0, subtotal: fare, surgeMultiplier: 1,
    discountPct: 0, discount: 0, loadTons: record.loadWeightKg / 1000,
    perTon: 0, perTonLow: 0, perTonHigh: 0, savings: 0, co2SavedKg: 0,
  };
  return {
    id: record.id, mode: record.mode,
    pickup: { ...record.pickup, id: `${record.id}:pickup`, kind: "other" },
    drop: { ...record.drop, id: `${record.id}:drop`, kind: "other" },
    truckTypeId: record.truckTypeId, truckTypeName: record.truckTypeName,
    loadWeightKg: record.loadWeightKg, goodsType: record.goodsType,
    price, priceBreakdownAvailable: Boolean(record.priceSnapshot),
    agreedPrice: fare,
    status: record.status === "cancelled" ? "cancelled"
      : record.status === "open" ? "requested" : record.tripStatus ?? "accepted",
    captain: record.captain ?? undefined, createdLabel: record.createdLabel,
    createdAt: record.createdAt ?? undefined, updatedAt: record.updatedAt ?? undefined,
  };
}

const order: BookingStatus[] = ["requested", "accepted", "enroute_pickup", "at_pickup", "picked", "enroute_drop", "delivered", "cancelled"];

/** Merge pages and detail polls without duplicating records or undoing newer trip state. */
export function mergeBookings(current: Booking[], incoming: Booking[]): Booking[] {
  const byId = new Map(current.map(b => [b.id, b]));
  for (const next of incoming) {
    const previous = byId.get(next.id);
    if (previous) {
      const oldTime = Date.parse(previous.updatedAt ?? "") || 0;
      const newTime = Date.parse(next.updatedAt ?? "") || 0;
      if (oldTime > newTime || order.indexOf(previous.status) > order.indexOf(next.status)) continue;
    }
    byId.set(next.id, next);
  }
  return [...byId.values()].sort((a, b) =>
    (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0) || b.id.localeCompare(a.id));
}
