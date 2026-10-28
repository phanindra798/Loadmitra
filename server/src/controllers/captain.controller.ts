import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { User, type UserDoc } from "../models/user.model";
import { Booking } from "../models/booking.model";
import { truckById } from "../data/trucks";

// Format checks only: self-reported registration is not document verification.
const VehicleSchema = z.object({
  vehicleNumber: z.string().max(30).transform(value => value.toUpperCase().replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6,15}$/)),
  truckTypeId: z.string().refine(id => Boolean(truckById(id)), "Choose a supported truck type"),
  city: z.string().trim().min(2).max(80),
}).strict();

async function profile(user: UserDoc & { _id: unknown }) {
  const id = String(user._id);
  const trips = await Booking.countDocuments({ acceptedByCaptainId: id, status: "accepted", tripStatus: "delivered" });
  return { id, name: user.name, phoneMasked: user.phone.replace(/.(?=.{4})/g, "•"),
    vehicleNumber: user.vehicle?.vehicleNumber ?? "Not registered", truckTypeId: user.vehicle?.truckTypeId ?? "",
    city: user.vehicle?.city ?? "", rating: 0, trips, hue: 211, kycVerified: false,
    joinedLabel: `Joined ${user.createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}` };
}

export async function getMe(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const user = await User.findOne({ _id: req.auth!.userId, role: "captain" });
  if (!user) { res.status(401).json({ error: "Account not found" }); return; }
  res.json({ data: await profile(user) });
}

/** Updates affect future assignments; existing bookings keep their vehicle snapshot. */
export async function updateVehicle(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const parsed = VehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid vehicle number, truck type and operating city", details: parsed.error.flatten() }); return;
  }
  const user = await User.findOneAndUpdate({ _id: req.auth!.userId, role: "captain" },
    { $set: { vehicle: parsed.data } }, { new: true, runValidators: true });
  if (!user) { res.status(401).json({ error: "Account not found" }); return; }
  res.json({ data: await profile(user) });
}
