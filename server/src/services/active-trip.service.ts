import { Booking, ACTIVE_TRIP_INDEX_OPTIONS } from "../models/booking.model";

export const ACTIVE_TRIP_INDEX_NAME = ACTIVE_TRIP_INDEX_OPTIONS.name;

let ready: Promise<string> | undefined;
Booking.db.on("disconnected", () => { ready = undefined; });

/**
 * A database constraint, not a read-then-write check: competing API processes
 * cannot assign different active bookings to the same captain. Terminal status
 * changes remove the booking from this index in the same atomic write.
 * Explicit installation is required even when Mongoose autoIndex is disabled.
 */
export function ensureActiveTripIndex(): Promise<string> {
  if (!ready) {
    const attempt = Booking.collection.createIndex({ acceptedByCaptainId: 1 }, {
      ...ACTIVE_TRIP_INDEX_OPTIONS,
      maxTimeMS: 10000,
    });
    ready = attempt;
    // Permit retries after an index build failure without erasing a newer attempt.
    void attempt.catch(() => { if (ready === attempt) ready = undefined; });
  }
  return ready;
}

export function isActiveTripConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const duplicate = error as { code?: number; keyPattern?: Record<string, unknown> };
  return duplicate.code === 11000 && duplicate.keyPattern?.acceptedByCaptainId === 1;
}
