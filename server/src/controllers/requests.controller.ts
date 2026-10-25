import type { Request, Response } from "express";
import { Booking, bookingToRequest } from "../models/booking.model";

/** Return persisted, owned open loads; sample offers are never actionable. */
export async function listRequests(_req: Request, res: Response): Promise<void> {
  const open = await Booking.find({ status: "open", shipperId: { $exists: true } }).sort({ createdAt: -1 }).limit(50);
  const real = open.map(bookingToRequest);
  res.json({ data: real });
}
