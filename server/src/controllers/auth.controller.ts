import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { User, publicUser, type UserDoc } from "../models/user.model";
import { signToken, AUTH_COOKIE, type AuthedRequest } from "../middleware/auth";

const roleSchema = z.enum(["shipper", "captain"]);
const phoneSchema = z.string().regex(/^\d{6,15}$/, "Enter a valid phone number");

const sendOtpSchema = z.object({ phone: phoneSchema, role: roleSchema });
const verifyOtpSchema = z.object({
  phone: phoneSchema,
  role: roleSchema,
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  dialCode: z.string().optional(),
});
const updateMeSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    // Prod: frontends and API live on different domains (Vercel ↔ API host), so
    // the cookie must be SameSite=None+Secure to ride cross-site requests. Dev
    // is same-site over http, where None+Secure would be dropped — use Lax.
    sameSite: env.isProd ? "none" : "lax",
    secure: env.isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

/**
 * POST /api/auth/send-otp — demo mode. No SMS provider is wired, so we neither
 * generate nor store a code; verify-otp accepts any 6-digit value. We still
 * validate the request and return success so the login UI advances to the OTP
 * step. (Swap this for a real SMS send when you wire a provider.)
 */
export function sendOtp(req: Request, res: Response): void {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    return;
  }
  res.json({ sent: true });
}

/**
 * POST /api/auth/verify-otp — demo mode. Any 6-digit code is accepted (the Zod
 * schema guarantees the format); there is no real code to check against. We
 * find-or-create the user and issue a JWT. A brand-new number with no name
 * returns 409 `registration_required` so the client can collect a profile.
 */
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { phone, role, name, email, dialCode } = parsed.data;

  let user = await User.findOne({ phone, role });
  if (!user) {
    if (!name) {
      // New number — the client must collect a name before we can create the account.
      res.status(409).json({ error: "registration_required" });
      return;
    }
    user = await User.create({ phone, role, name, email: email || "", dialCode: dialCode || "+91" });
  } else if (name || email) {
    // Returning user who supplied fresh details (e.g. completing a profile).
    if (name) user.name = name;
    if (email) user.email = email;
    await user.save();
  }

  const token = signToken({ userId: String(user._id), role });
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user as UserDoc & { _id: unknown }) });
}

/** GET /api/auth/me — the signed-in user. */
export async function me(req: AuthedRequest, res: Response): Promise<void> {
  const user = await User.findById(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: publicUser(user as UserDoc & { _id: unknown }) });
}

/** PATCH /api/auth/me — update name/email. */
export async function updateMe(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const user = await User.findById(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (parsed.data.name) user.name = parsed.data.name;
  if (parsed.data.email !== undefined) user.email = parsed.data.email;
  await user.save();
  res.json({ user: publicUser(user as UserDoc & { _id: unknown }) });
}

/** POST /api/auth/logout — clear the cookie. */
export function logout(_req: Request, res: Response): void {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
}
