import type { Trip } from "./types";

export const isActiveTrip = (trip: Trip) => trip.status !== "delivered" && trip.status !== "cancelled";
const stageOrder = { accepted: 0, enroute_pickup: 1, at_pickup: 2, picked: 3, enroute_drop: 4, delivered: 5, cancelled: 6 };

/** Resolve overlapping list/detail reads without undoing a confirmed transition. */
export function latestTrip(current: Trip | undefined, incoming: Trip): Trip {
  if (!current) return incoming;
  const oldTime = Date.parse(current.updatedAt ?? "");
  const newTime = Date.parse(incoming.updatedAt ?? "");
  if (Number.isFinite(oldTime) && Number.isFinite(newTime) && oldTime !== newTime) {
    return newTime > oldTime ? incoming : current;
  }
  return stageOrder[incoming.status] >= stageOrder[current.status] ? incoming : current;
}

export function mergeTrips(current: Trip[], incoming: Trip[]): Trip[] {
  const records = new Map(current.map(trip => [trip.id, trip]));
  for (const trip of incoming) records.set(trip.id, latestTrip(records.get(trip.id), trip));
  return [...records.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id));
}
