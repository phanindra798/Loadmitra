import type { Request, Response } from "express";
import { z } from "zod";
import { LOAD_REQUESTS, SAMPLE_TRIPS } from "../data/captain";
import { Booking, bookingToTrip } from "../models/booking.model";
import type { Trip } from "../types";

/** GET /api/captain/trips — the captain's trip history. */
export function listTrips(_req: Request, res: Response): void {
  res.json({ data: SAMPLE_TRIPS });
}

const acceptCaptainSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    vehicleNumber: z.string().optional(),
    truckTypeId: z.string().optional(),
    rating: z.number().optional(),
    trips: z.number().optional(),
    phoneMasked: z.string().optional(),
    etaMins: z.number().optional(),
    hue: z.number().optional(),
    badges: z.array(z.string()).optional(),
  })
  .optional();

/** POST /api/captain/requests/:id/accept — accept an offer, returns the started trip. */
export async function acceptRequest(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  // The captain portal sends a snapshot of itself so the shipper can show who accepted.
  const captain = acceptCaptainSchema.safeParse((req.body as { captain?: unknown })?.captain).data;

  // A real shipper booking? Mark it accepted so it leaves the open job board.
  const booking = await Booking.findOne({ bookingId: id });
  if (booking) {
    if (booking.status === "open") {
      booking.status = "accepted";
      if (captain) {
        booking.set("captain", captain);
        if (captain.id) booking.acceptedByCaptainId = captain.id;
      }
      await booking.save();
    }
    res.status(201).json({ data: bookingToTrip(booking, "accepted") });
    return;
  }

  // Fall back to the demo seed.
  const request = LOAD_REQUESTS.find((r) => r.id === id);
  if (!request) {
    res.status(404).json({ error: `Unknown request: ${id}` });
    return;
  }
  const trip: Trip = {
    id: request.id,
    mode: request.mode,
    pickup: request.pickup,
    drop: request.drop,
    distanceKm: request.distanceKm,
    truckTypeId: request.truckTypeId,
    truckTypeName: request.truckTypeName,
    loadWeightKg: request.loadWeightKg,
    goodsType: request.goodsType,
    payout: request.payout,
    customerName: request.customerName,
    customerRating: request.customerRating,
    status: "accepted",
    createdLabel: request.createdLabel,
  };
  res.status(201).json({ data: trip });
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
  otp: z.string().regex(/^\d{4}$/).optional(),
});

/** POST /api/captain/trips/:id/status — advance a trip through its lifecycle. */
export async function updateTripStatus(req: Request, res: Response): Promise<void> {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  // OTP-gated transitions in a real build verify against the booking; here we
  // just require a 4-digit code to move into "picked" / "delivered".
  const otpRequired = parsed.data.status === "picked" || parsed.data.status === "delivered";
  if (otpRequired && !parsed.data.otp) {
    res.status(400).json({ error: "OTP required for this transition" });
    return;
  }

  // Persist the lifecycle onto the shipper's booking so their track screen can
  // mirror it — the shipper only sees "delivered" once the captain delivers.
  const booking = await Booking.findOne({ bookingId: req.params.id });
  if (booking) {
    booking.tripStatus = parsed.data.status;
    if (parsed.data.status === "cancelled") booking.status = "cancelled";
    await booking.save();
  }
  res.json({ data: { id: req.params.id, status: parsed.data.status } });
}
