import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// Express identifies error handlers by their 4-argument signature.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
}
