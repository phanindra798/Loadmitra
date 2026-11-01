import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { openStream } from "../services/live-events.service";

/** GET /api/events — this session's live change signals (Server-Sent Events). */
export function streamEvents(req: AuthedRequest, res: Response): void {
  const result = openStream(res, { ...req.auth!, ...req.session! });
  if (result === "user_limit") {
    res.status(429).json({ error: "Too many live connections for this account. Close another tab and retry." });
  } else if (result === "server_limit") {
    res.status(503).json({ error: "Live updates are busy. The app will keep refreshing normally." });
  }
}
