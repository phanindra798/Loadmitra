import type { AuthedRequest } from "../middleware/auth";
import { User } from "../models/user.model";
import type { Request, Response } from "express";
import { z } from "zod";
import { Booking, bookingToTrip } from "../models/booking.model";

/** GET /api/captain/trips — the captain's trip history. */
export async function listTrips(req: AuthedRequest, res: Response): Promise<void> {
  const bookings = await Booking.find({ acceptedByCaptainId: req.auth!.userId }).sort({ createdAt: -1 }).limit(100);
  res.json({ data: bookings.map(b => bookingToTrip(b, b.tripStatus ?? "accepted")) });
}

/** Claim an open booking atomically; client-supplied captain identity is ignored. */
export async function acceptRequest(req: AuthedRequest, res: Response): Promise<void> {
  const user = await User.findById(req.auth!.userId);
  if (!user) { res.status(401).json({ error: "Account not found" }); return; }
  const booking = await Booking.findOneAndUpdate(
    { bookingId: req.params.id, status: "open", shipperId: { $exists: true } },
    { $set: { status: "accepted", tripStatus: "accepted", acceptedByCaptainId: req.auth!.userId,
      captain: { id: req.auth!.userId, name: user.name, rating: 0, trips: 0, badges: [],
        vehicleNumber: "Not registered", truckTypeId: "", phoneMasked: "", etaMins: 0 } } },
    { new: true, runValidators: true },
  );
  if (!booking) { res.status(409).json({ error: "This load is no longer available" }); return; }
  res.status(201).json({ data: bookingToTrip(booking, "accepted") });
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
export async function updateTripStatus(req: AuthedRequest, res: Response): Promise<void> {
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
  const updated = await Booking.findOneAndUpdate({
    bookingId: booking.bookingId, acceptedByCaptainId: req.auth!.userId,
    status: "accepted", tripStatus: booking.tripStatus,
  }, { $set: { tripStatus: parsed.data.status, ...(parsed.data.status === "cancelled" ? { status: "cancelled" } : {}) } }, { new: true });
  if (!updated) { res.status(409).json({ error: "Trip changed; refresh and retry" }); return; }
  res.json({ data: { id: req.params.id, status: parsed.data.status } });
}
