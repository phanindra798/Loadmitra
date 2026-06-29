import type { Request, Response } from "express";
import { z } from "zod";
import { Booking } from "../models/booking.model";

const placeSchema = z.object({
  label: z.string().min(1),
  address: z.string().default(""),
  city: z.string().default(""),
});

const createBookingSchema = z.object({
  bookingId: z.string().min(3),
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
export async function createBooking(req: Request, res: Response): Promise<void> {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const d = parsed.data;
  const booking = await Booking.findOneAndUpdate(
    { bookingId: d.bookingId },
    {
      bookingId: d.bookingId,
      mode: d.mode,
      pickup: d.pickup,
      drop: d.drop,
      distanceKm: d.distanceKm,
      truckTypeId: d.truckTypeId,
      truckTypeName: d.truckTypeName,
      loadWeightKg: d.loadWeightKg,
      goodsType: d.goodsType,
      agreedPrice: d.agreedPrice ?? 0,
      customerName: d.customerName || "LoadMitra Shipper",
      createdLabel: d.createdLabel || "Just now",
      status: "open",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.status(201).json({ data: { id: booking.bookingId } });
}

/**
 * GET /api/bookings/:id — current state of a booking. The shipper's matching
 * screen polls this to learn when a captain has accepted and who it is.
 */
export async function getBooking(req: Request, res: Response): Promise<void> {
  const booking = await Booking.findOne({ bookingId: req.params.id });
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
