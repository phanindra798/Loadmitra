import type { Request, Response } from "express";
import { z } from "zod";
import { estimateDistanceKm, estimatePrice, truckById, MAX_DISTANCE_KM } from "../services/pricing.service";

const EstimateSchema = z
  .object({
    truckTypeId: z.string().min(1),
    mode: z.enum(["full", "shared", "return"]),
    distanceKm: z.number().positive().max(MAX_DISTANCE_KM).optional(),
    pickupCity: z.string().optional(),
    dropCity: z.string().optional(),
    loadWeightKg: z.number().positive().optional(),
  })
  .refine((b) => b.distanceKm != null || (b.pickupCity && b.dropCity), {
    message: "Provide distanceKm, or both pickupCity and dropCity.",
  });

/** POST /api/pricing/estimate — transparent, negotiable per-tonne estimate. */
export function postEstimate(req: Request, res: Response): void {
  const parsed = EstimateSchema.safeParse(req.body);
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
  const price = estimatePrice({ truck, distanceKm: km, mode, loadWeightKg });
  res.json({ data: price });
}
