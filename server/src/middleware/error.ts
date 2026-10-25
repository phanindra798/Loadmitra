import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// Express identifies error handlers by their 4-argument signature.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) { _next(err); return; }
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
}
