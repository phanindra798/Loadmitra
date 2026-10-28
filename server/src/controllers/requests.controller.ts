import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { Booking, bookingToRequest } from "../models/booking.model";
import { User } from "../models/user.model";
import { truckById } from "../data/trucks";

/** Only offer open loads matching the registered vehicle and its capacity. */
export async function listRequests(req: AuthedRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const user = await User.findById(req.auth!.userId);
  if (!user) { res.status(401).json({ error: "Account not found" }); return; }
  const truck = user.vehicle && truckById(user.vehicle.truckTypeId);
  if (!user.vehicle?.vehicleNumber || !truck) { res.json({ data: [] }); return; }
  const open = await Booking.find({ status: "open", shipperId: { $exists: true },
    truckTypeId: truck.id, loadWeightKg: { $gt: 0, $lte: truck.capacityKg } }).sort({ createdAt: -1 }).limit(50);
  res.json({ data: open.map(bookingToRequest) });
}
