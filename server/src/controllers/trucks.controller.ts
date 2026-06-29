import type { Request, Response } from "express";
import { TRUCK_TYPES } from "../data/trucks";

/** GET /api/trucks — the available truck catalogue (shared by both portals). */
export function listTrucks(_req: Request, res: Response): void {
  res.json({ data: TRUCK_TYPES });
}
