import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One-time passwords for phone login. A TTL index on `expiresAt` lets MongoDB
 * auto-purge expired codes. We keep only the latest code per (phone, role).
 */
const otpSchema = new Schema({
  phone: { type: String, required: true },
  role: { type: String, enum: ["shipper", "captain"], required: true },
  code: { type: String, required: true }, // 6-digit; plaintext is fine for this demo
  expiresAt: { type: Date, required: true },
});

otpSchema.index({ phone: 1, role: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpDoc = InferSchemaType<typeof otpSchema>;
export const Otp = model("Otp", otpSchema);
