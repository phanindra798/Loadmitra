import { createHmac, randomInt } from "node:crypto";
import { Otp } from "../models/otp.model";
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

/** Codes are exposed only in local development until an SMS adapter is configured. */
export function hashOtp(phone: string, role: string, code: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(`${phone}:${role}:${code}`).digest("hex");
}

function deliveryAvailable(res: Response): boolean {
  if (!env.isProd) return true;
  res.status(503).json({ error: "SMS delivery is not configured" });
  return false;
}

export async function sendOtp(req: Request, res: Response): Promise<void> {
  if (!deliveryAvailable(res)) return;
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { phone, role } = parsed.data;
  const code = String(randomInt(100000, 1000000));
  await Otp.findOneAndUpdate({ phone, role }, {
    $set: { codeHash: hashOtp(phone, role, code), attempts: 0,
      expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000) },
    $unset: { code: 1 },
  }, { upsert: true, new: true });
  res.json({ sent: true, devOtp: code });
}

/** Verify a bounded, unexpired challenge and consume it before issuing a session. */
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  if (!deliveryAvailable(res)) return;
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { phone, role, name, email, dialCode } = parsed.data;

  const challenge = await Otp.findOneAndUpdate(
    { phone, role, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } }, { new: true },
  );
  const codeHash = hashOtp(phone, role, parsed.data.otp);
  if (!challenge || challenge.codeHash !== codeHash) {
    res.status(401).json({ error: "Invalid or expired OTP. Request a new code if needed." });
    return;
  }
  let user = await User.findOne({ phone, role });
  if (!user && !name) {
    res.status(409).json({ error: "registration_required" });
    return;
  }
  // Atomic consumption prevents simultaneous successful replays and resend races.
  const consumed = await Otp.findOneAndDelete({
    _id: challenge._id, codeHash, expiresAt: { $gt: new Date() }, attempts: { $lte: 5 },
  });
  if (!consumed) {
    res.status(401).json({ error: "Invalid or expired OTP" });
    return;
  }
  if (!user) {
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
  res.clearCookie(AUTH_COOKIE, { sameSite: env.isProd ? "none" : "lax", secure: env.isProd });
  res.json({ ok: true });
}
