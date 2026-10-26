import { createHash } from "node:crypto";
import type { AuthedRequest } from "../middleware/auth";
import { User } from "../models/user.model";
import { estimatePrice, truckById } from "../services/pricing.service";
import type { Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Booking } from "../models/booking.model";
import { createHandoverOtp, HANDOVER_OTP_COOLDOWN_MS } from "../services/handover-otp.service";
import { shipperBookingView } from "../services/booking-view.service";

const placeSchema = z.object({
  label: z.string().min(1),
  address: z.string().default(""),
  city: z.string().default(""),
});

const createBookingSchema = z.object({
  bookingId: z.string().regex(/^LM-[A-Za-z0-9-]{6,64}$/),
  mode: z.enum(["full", "shared", "return"]),
  pickup: placeSchema,
  drop: placeSchema,
  distanceKm: z.number().positive(),
  truckTypeId: z.string().min(1),
  truckTypeName: z.string().min(1),
  loadWeightKg: z.number().positive(),
  goodsType: z.string().default("General goods"),
  agreedPrice: z.number().nonnegative().optional(),
  customerName: z.string().optional(),
  createdLabel: z.string().optional(),
});

/**
 * POST /api/bookings — a shipper books a load. Persisted so the captain job
 * board can read it back. Upsert on bookingId so a client retry is idempotent.
 */
export async function createBooking(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const d = parsed.data;
  const truck = truckById(d.truckTypeId);
  if (!truck || d.loadWeightKg > truck.capacityKg) {
    res.status(400).json({ error: "Invalid truck or load exceeds vehicle capacity" }); return;
  }
  const shipper = await User.findById(req.auth!.userId);
  if (!shipper) { res.status(401).json({ error: "Account not found" }); return; }
  const priceSnapshot = estimatePrice({ truck, distanceKm: d.distanceKm, mode: d.mode, loadWeightKg: d.loadWeightKg });
  const agreedPrice = priceSnapshot.estimate;
  const fingerprint = createHash("sha256").update(JSON.stringify({
    mode: d.mode, pickup: d.pickup, drop: d.drop, distanceKm: d.distanceKm,
    truckTypeId: d.truckTypeId, loadWeightKg: d.loadWeightKg, goodsType: d.goodsType,
  })).digest("hex");
  try {
    const booking = await Booking.findOneAndUpdate(
      { bookingId: d.bookingId, shipperId: req.auth!.userId, requestFingerprint: fingerprint },
      { $setOnInsert: { ...d, shipperId: req.auth!.userId, requestFingerprint: fingerprint,
        agreedPrice, priceSnapshot, truckTypeName: truck.name, customerName: shipper.name, status: "open" } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({ data: shipperBookingView(booking) });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ error: "Booking ID already belongs to another request" }); return;
    }
    throw error;
  }
}

/**
 * GET /api/bookings/:id — current state of a booking. The shipper's matching
 * screen polls this to learn when a captain has accepted and who it is.
 */
export async function getBooking(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const booking = await Booking.findOne({ bookingId: req.params.id, shipperId: req.auth!.userId });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json({ data: shipperBookingView(booking) });
}

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
});

/** Newest-first, bounded history. Every page is scoped to the authenticated shipper. */
export async function listBookings(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const parsed = historyQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid history cursor or page size" }); return; }
  const { limit, before } = parsed.data;
  const rows = await Booking.find({
    shipperId: req.auth!.userId,
    ...(before ? { _id: { $lt: new Types.ObjectId(before) } } : {}),
  }).sort({ _id: -1 }).limit(limit + 1);
  const page = rows.slice(0, limit);
  res.json({ data: page.map(shipperBookingView),
    nextCursor: rows.length > limit ? page[page.length - 1]._id.toString() : null });
}

/** Cancel only an owned booking before goods have been picked up. */
export async function cancelBooking(req: AuthedRequest, res: Response): Promise<void> {
  const booking = await Booking.findOneAndUpdate({
    bookingId: req.params.id, shipperId: req.auth!.userId,
    status: { $in: ["open", "accepted"] },
    $or: [{ tripStatus: { $exists: false } }, { tripStatus: { $in: ["accepted", "enroute_pickup", "at_pickup"] } }],
  }, { $set: { status: "cancelled", tripStatus: "cancelled" }, $unset: { handoverOtp: 1 } }, { new: true });
  if (!booking) { res.status(409).json({ error: "Booking cannot be cancelled" }); return; }
  res.setHeader("Cache-Control", "no-store");
  res.json({ data: shipperBookingView(booking) });
}

/** Generate a short-lived handover code only for the booking's owner and current stage. */
export async function issueHandoverOtp(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const booking = await Booking.findOne({ bookingId: req.params.id, shipperId: req.auth!.userId });
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  const stage = booking.tripStatus === "at_pickup" ? "picked"
    : booking.tripStatus === "enroute_drop" ? "delivered" : null;
  if (booking.status !== "accepted" || !stage) {
    res.status(409).json({ error: "A handover code is not available at this trip stage" }); return;
  }
  const { code, challenge } = createHandoverOtp(booking.bookingId, stage);
  const updated = await Booking.findOneAndUpdate({
    bookingId: booking.bookingId, shipperId: req.auth!.userId,
    status: "accepted", tripStatus: booking.tripStatus,
    $or: [
      { "handoverOtp.issuedAt": { $exists: false } },
      { "handoverOtp.issuedAt": { $lte: new Date(Date.now() - HANDOVER_OTP_COOLDOWN_MS) } },
    ],
  }, { $set: { handoverOtp: challenge } }, { new: true, runValidators: true });
  if (!updated) {
    res.status(409).json({ error: "Trip changed or a code was just generated. Wait 30 seconds, then refresh and retry." }); return;
  }
  res.json({ data: { code, stage, expiresAt: challenge.expiresAt.toISOString() } });
}
