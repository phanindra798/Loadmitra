import type { Request, Response } from "express";
import { z } from "zod";
import { EARNINGS } from "../data/captain";
import { estimateDistanceKm, quotePayout, truckById } from "../services/earnings.service";

/** GET /api/captain/earnings — earnings summary + ledger. */
export function getEarnings(_req: Request, res: Response): void {
  res.json({ data: EARNINGS });
}

const QuoteSchema = z
  .object({
    truckTypeId: z.string().min(1),
    mode: z.enum(["full", "shared", "return"]),
    distanceKm: z.number().positive().optional(),
    pickupCity: z.string().optional(),
    dropCity: z.string().optional(),
    loadWeightKg: z.number().positive().optional(),
  })
  .refine((b) => b.distanceKm != null || (b.pickupCity && b.dropCity), {
    message: "Provide distanceKm, or both pickupCity and dropCity.",
  });

/** POST /api/captain/earnings/quote — what a captain would earn on a load. */
export function postQuote(req: Request, res: Response): void {
  const parsed = QuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { truckTypeId, mode, distanceKm, pickupCity, dropCity, loadWeightKg } = parsed.data;
  const truck = truckById(truckTypeId);
  if (!truck) {
    res.status(404).json({ error: `Unknown truck type: ${truckTypeId}` });
    return;
  }

  const km = distanceKm ?? estimateDistanceKm(pickupCity, dropCity);
  const payout = quotePayout({ truck, distanceKm: km, mode, loadWeightKg });
  res.json({ data: { distanceKm: Math.round(km), payout } });
}
