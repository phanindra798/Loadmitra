import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

export const HANDOVER_OTP_TTL_MS = 10 * 60 * 1000;
export const HANDOVER_OTP_MAX_ATTEMPTS = 5;
export const HANDOVER_OTP_COOLDOWN_MS = 30 * 1000;
export type HandoverStage = "picked" | "delivered";

export function handoverOtpHash(bookingId: string, stage: HandoverStage, code: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(JSON.stringify(["shipment-handover", bookingId, stage, code]))
    .digest("hex");
}

export function createHandoverOtp(bookingId: string, stage: HandoverStage) {
  const code = String(randomInt(100000, 1000000));
  const issuedAt = new Date();
  return {
    code,
    challenge: {
      stage, codeHash: handoverOtpHash(bookingId, stage, code), attempts: 0, issuedAt,
      expiresAt: new Date(issuedAt.getTime() + HANDOVER_OTP_TTL_MS),
    },
  };
}

export function matchesHandoverOtp(bookingId: string, stage: HandoverStage, code: string, storedHash: string): boolean {
  const expected = Buffer.from(handoverOtpHash(bookingId, stage, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === expected.length && timingSafeEqual(stored, expected);
}
