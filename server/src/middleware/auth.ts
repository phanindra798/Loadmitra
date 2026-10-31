import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { RevokedToken } from "../models/revoked-token.model";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export type Role = "shipper" | "captain";
export interface AuthPayload {
  userId: string;
  role: Role;
}

export interface AuthedRequest extends Request {
  auth?: AuthPayload;
}

const COOKIE = "lm_token";

export function signToken(payload: AuthPayload): string {
  // A unique id per login lets logout revoke this one session.
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "30d", jwtid: randomUUID() });
}

/** Read the bearer token from the Authorization header or the auth cookie. */
export function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[COOKIE] ?? null;
}

export interface VerifiedToken extends AuthPayload {
  jti: string;
  exp: number;
}

/** Signature, algorithm and claim checks only; revocation is checked separately. */
export function verifyToken(token: string): VerifiedToken | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.userId !== "string" ||
        !payload.userId.trim() || payload.userId.length > 128 ||
        (payload.role !== "shipper" && payload.role !== "captain") ||
        typeof payload.exp !== "number" || !Number.isFinite(payload.exp) ||
        // Tokens issued before revocation existed carry no id and cannot be revoked.
        typeof payload.jti !== "string" || !payload.jti || payload.jti.length > 64) {
      return null;
    }
    return { userId: payload.userId, role: payload.role, jti: payload.jti, exp: payload.exp };
  } catch {
    return null;
  }
}

/** Gate a route: 401 unless a valid, unrevoked token is present. Attaches `req.auth`. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const verified = verifyToken(token);
  if (!verified) {
    res.status(401).json({ error: "Invalid or expired token" }); return;
  }
  try {
    if (await RevokedToken.exists({ jti: verified.jti })) {
      res.status(401).json({ error: "Session ended. Please sign in again." }); return;
    }
  } catch {
    // Never let a database outage turn a revoked session back on.
    res.status(503).json({ error: "Sign-in check unavailable. Please try again." }); return;
  }
  req.auth = { userId: verified.userId, role: verified.role };
  next();
}

/**
 * Gate a route to one role. Must run after `requireAuth` (reads `req.auth`).
 * 403 if the signed-in user's role doesn't match — e.g. a shipper token must
 * not be able to drive captain-only endpoints (accept loads, change trip state).
 */
export function requireRole(role: Role) {
  return function roleGuard(req: AuthedRequest, res: Response, next: NextFunction): void {
    if (req.auth?.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export const AUTH_COOKIE = COOKIE;
