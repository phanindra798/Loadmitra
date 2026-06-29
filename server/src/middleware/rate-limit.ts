import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per key per window. */
  max: number;
  /** Derive the bucket key from a request. Defaults to client IP. */
  key?: (req: Request) => string;
}

/**
 * Tiny in-memory fixed-window rate limiter — no extra dependency. Sized for a
 * single-node deployment (Render/Railway/Fly). For multi-instance or serverless
 * hosting, back this with Redis instead, since each instance keeps its own Map.
 */
export function rateLimit({ windowMs, max, key }: RateLimitOptions) {
  const keyFn = key ?? ((req: Request) => req.ip ?? "unknown");
  const hits = new Map<string, Bucket>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();

    // Opportunistic sweep so the Map can't grow unbounded under churn.
    if (hits.size > 5000) {
      for (const [k, b] of hits) if (b.resetAt <= now) hits.delete(k);
    }

    const id = keyFn(req);
    const bucket = hits.get(id);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests — please slow down and try again." });
      return;
    }
    next();
  };
}
