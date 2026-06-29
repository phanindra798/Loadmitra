import jwt from "jsonwebtoken";
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
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "30d" });
}

/** Read the bearer token from the Authorization header or the auth cookie. */
function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[COOKIE] ?? null;
}

/** Gate a route: 401 unless a valid token is present. Attaches `req.auth`. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    req.auth = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
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
