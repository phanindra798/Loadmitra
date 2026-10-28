import type { AuthedRequest } from "../middleware/auth";
import { truckById } from "../data/trucks";
import { User } from "../models/user.model";
import type { Response } from "express";
import { z } from "zod";
import { Booking, bookingToTrip, ACTIVE_TRIP_INDEX_OPTIONS } from "../models/booking.model";
import { ensureActiveTripIndex, isActiveTripConflict } from "../services/active-trip.service";
import { captainPayout } from "../services/earnings.service";
import { logger } from "../utils/logger";
import { HANDOVER_OTP_MAX_ATTEMPTS, matchesHandoverOtp } from "../services/handover-otp.service";

/** GET /api/captain/trips — the captain's trip history. */
export async function listTrips(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const captainId = req.auth!.userId;
  const [bookings, active] = await Promise.all([
    Booking.find({ acceptedByCaptainId: captainId }).sort({ createdAt: -1, _id: -1 }).limit(100),
    Booking.findOne({ ...ACTIVE_TRIP_INDEX_OPTIONS.partialFilterExpression, acceptedByCaptainId: captainId })
      .sort({ updatedAt: -1 }),
  ]);
  res.json({ data: bookings.map(b => bookingToTrip(b, b.tripStatus ?? "accepted")),
    activeTrip: active ? bookingToTrip(active, active.tripStatus ?? "accepted") : null });
}

/** Recover an owned trip directly, even when it is outside the history window. */
export async function getTrip(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const booking = await Booking.findOne({ bookingId: req.params.id, acceptedByCaptainId: req.auth!.userId });
  if (!booking) { res.status(404).json({ error: "Trip not found" }); return; }
  res.json({ data: bookingToTrip(booking, booking.tripStatus ?? "accepted") });
}

/** Claim an open booking atomically; client-supplied captain identity is ignored. */
export async function acceptRequest(req: AuthedRequest, res: Response): Promise<void> {
  const user = await User.findById(req.auth!.userId);
  if (!user) { res.status(401).json({ error: "Account not found" }); return; }
  const vehicle = user.vehicle;
  const truck = vehicle && truckById(vehicle.truckTypeId);
  if (!vehicle?.vehicleNumber || !truck) {
    res.status(409).json({ code: "VEHICLE_REQUIRED", error: "Register your vehicle in Account before accepting a load." }); return;
  }
  // Never accept without the database guard, including during startup/index builds.
  try {
    await ensureActiveTripIndex();
  } catch {
    logger.error("Captain acceptance unavailable: verify the active-trip index, MongoDB version and conflicting active bookings");
    res.status(503).json({ error: "Load acceptance is temporarily unavailable. Please try again later." });
    return;
  }
  try {
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.id, status: "open", shipperId: { $exists: true },
        truckTypeId: truck.id, loadWeightKg: { $gt: 0, $lte: truck.capacityKg } },
      { $set: { status: "accepted", tripStatus: "accepted", acceptedByCaptainId: req.auth!.userId,
        captain: { id: req.auth!.userId, name: user.name, rating: 0, trips: 0, badges: [],
          vehicleNumber: vehicle.vehicleNumber, truckTypeId: truck.id, phoneMasked: user.phone.replace(/.(?=.{4})/g, "•"), etaMins: 0 } } },
      { new: true, runValidators: true },
    );
    if (!booking) { res.status(409).json({ error: "This load is unavailable or does not match your registered vehicle." }); return; }
    res.status(201).json({ data: bookingToTrip(booking, "accepted") });
  } catch (error) {
    if (isActiveTripConflict(error)) {
      res.status(409).json({ code: "ACTIVE_TRIP_EXISTS", error: "You already have an active trip. Finish or cancel it before accepting another load." });
      return;
    }
    throw error;
  }
}

const StatusSchema = z.object({
  status: z.enum([
    "accepted",
    "enroute_pickup",
    "at_pickup",
    "picked",
    "enroute_drop",
    "delivered",
    "cancelled",
  ]),
  otp: z.string().regex(/^\d{6}$/).optional(),
});

/** POST /api/captain/trips/:id/status — advance a trip through its lifecycle. */
export async function updateTripStatus(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const otpRequired = parsed.data.status === "picked" || parsed.data.status === "delivered";
  if (otpRequired && !parsed.data.otp) {
    res.status(400).json({ error: "OTP required for this transition" });
    return;
  }

  // Persist the lifecycle onto the shipper's booking so their track screen can
  // mirror it — the shipper only sees "delivered" once the captain delivers.
  const booking = await Booking.findOne({ bookingId: req.params.id, acceptedByCaptainId: req.auth!.userId });
  if (!booking) { res.status(404).json({ error: "Trip not found" }); return; }
  const current = booking.tripStatus ?? "accepted";
  const transitions: Record<string, string[]> = {
    accepted: ["enroute_pickup", "cancelled"], enroute_pickup: ["at_pickup", "cancelled"],
    at_pickup: ["picked", "cancelled"], picked: ["enroute_drop"], enroute_drop: ["delivered"],
  };
  if (booking.status !== "accepted" || !transitions[current]?.includes(parsed.data.status)) {
    res.status(409).json({ error: "Invalid trip transition" }); return;
  }
  const transitionFilter = {
    bookingId: booking.bookingId, acceptedByCaptainId: req.auth!.userId,
    status: "accepted", tripStatus: booking.tripStatus,
  };
  const next = parsed.data.status;
  if (next === "picked" || next === "delivered") {
    // Reserve an attempt atomically, including for incorrect codes. The final
    // transition also checks this challenge so regeneration/replay cannot win a race.
    const attempted = await Booking.findOneAndUpdate({
      ...transitionFilter,
      "handoverOtp.stage": next,
      "handoverOtp.expiresAt": { $gt: new Date() },
      "handoverOtp.attempts": { $lt: HANDOVER_OTP_MAX_ATTEMPTS },
    }, { $inc: { "handoverOtp.attempts": 1 } }, { new: true });
    const challenge = attempted?.handoverOtp;
    if (!challenge) {
      res.status(409).json({ error: "Code unavailable, expired, or locked. Ask the shipper to generate a new code." }); return;
    }
    if (!matchesHandoverOtp(booking.bookingId, next, parsed.data.otp!, challenge.codeHash)) {
      res.status(400).json({ error: "Incorrect handover code" }); return;
    }
    const verified = await Booking.findOneAndUpdate({
      ...transitionFilter,
      "handoverOtp.stage": next, "handoverOtp.codeHash": challenge.codeHash,
      "handoverOtp.issuedAt": challenge.issuedAt,
      "handoverOtp.expiresAt": { $gt: new Date() },
      "handoverOtp.attempts": { $lte: HANDOVER_OTP_MAX_ATTEMPTS },
    }, { $set: { tripStatus: next, ...(next === "delivered" ? {
      completedAt: new Date(),
      payoutSnapshot: booking.payoutSnapshot ?? captainPayout(booking.agreedPrice, booking.mode, booking.distanceKm),
    } : {}) }, $unset: { handoverOtp: 1 } }, { new: true });
    if (!verified) { res.status(409).json({ error: "Trip or code changed; refresh and retry" }); return; }
    res.json({ data: bookingToTrip(verified, next) });
    return;
  }
  const updated = await Booking.findOneAndUpdate(transitionFilter, {
    $set: { tripStatus: next, ...(next === "cancelled" ? { status: "cancelled" } : {}) },
    ...(next === "cancelled" ? { $unset: { handoverOtp: 1 } } : {}),
  }, { new: true });
  if (!updated) { res.status(409).json({ error: "Trip changed; refresh and retry" }); return; }
  res.json({ data: bookingToTrip(updated, next) });
}
