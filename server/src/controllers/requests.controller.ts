import type { Request, Response } from "express";
import { LOAD_REQUESTS } from "../data/captain";
import { Booking, bookingToRequest } from "../models/booking.model";

/**
 * GET /api/captain/requests — load offers shown to the captain. Real shipper
 * bookings (status "open", newest first) come first, followed by the demo seed
 * so the board is never empty. A booking a shipper just made appears here on the
 * captain's next load/refresh.
 */
export async function listRequests(_req: Request, res: Response): Promise<void> {
  const open = await Booking.find({ status: "open" }).sort({ createdAt: -1 }).limit(50);
  const real = open.map(bookingToRequest);
  res.json({ data: [...real, ...LOAD_REQUESTS] });
}
