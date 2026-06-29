import type { Request, Response } from "express";
import { CAPTAIN } from "../data/captain";

/** GET /api/captain/me — the logged-in captain's profile. */
export function getMe(_req: Request, res: Response): void {
  res.json({ data: CAPTAIN });
}
