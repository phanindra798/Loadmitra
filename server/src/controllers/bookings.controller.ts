import { createHash } from "node:crypto";
import type { AuthedRequest } from "../middleware/auth";
import { User } from "../models/user.model";
import { estimatePrice, truckById } from "../services/pricing.service";
import type { Response } from "express";
import { z } from "zod";
import { Booking } from "../models/booking.model";

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
  const agreedPrice = estimatePrice({ truck, distanceKm: d.distanceKm, mode: d.mode, loadWeightKg: d.loadWeightKg }).estimate;
  const fingerprint = createHash("sha256").update(JSON.stringify({
    mode: d.mode, pickup: d.pickup, drop: d.drop, distanceKm: d.distanceKm,
    truckTypeId: d.truckTypeId, loadWeightKg: d.loadWeightKg, goodsType: d.goodsType,
  })).digest("hex");
  try {
    const booking = await Booking.findOneAndUpdate(
      { bookingId: d.bookingId, shipperId: req.auth!.userId, requestFingerprint: fingerprint },
      { $setOnInsert: { ...d, shipperId: req.auth!.userId, requestFingerprint: fingerprint,
        agreedPrice, truckTypeName: truck.name, customerName: shipper.name, status: "open" } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
    res.status(201).json({ data: { id: booking.bookingId, agreedPrice: booking.agreedPrice } });
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
  const booking = await Booking.findOne({ bookingId: req.params.id, shipperId: req.auth!.userId });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json({
    data: {
      id: booking.bookingId,
      status: booking.status,
      tripStatus: booking.tripStatus ?? null,
      captain: booking.captain ?? null,
    },
  });
}

/** Cancel only an owned booking before goods have been picked up. */
export async function cancelBooking(req: AuthedRequest, res: Response): Promise<void> {
  const booking = await Booking.findOneAndUpdate({
    bookingId: req.params.id, shipperId: req.auth!.userId,
    status: { $in: ["open", "accepted"] },
    $or: [{ tripStatus: { $exists: false } }, { tripStatus: { $in: ["accepted", "enroute_pickup", "at_pickup"] } }],
  }, { $set: { status: "cancelled", tripStatus: "cancelled" } }, { new: true });
  if (!booking) { res.status(409).json({ error: "Booking cannot be cancelled" }); return; }
  res.json({ data: { id: booking.bookingId, status: "cancelled" } });
}
