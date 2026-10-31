import { Schema, model, type InferSchemaType } from "mongoose";
import { IDENTITY_INDEX } from "./user.model";

/**
 * One-time passwords for phone login. A TTL index on `expiresAt` lets MongoDB
 * auto-purge expired codes. We keep only the latest code per (dialCode, phone, role).
 */
const otpSchema = new Schema({
  dialCode: { type: String, required: true, default: "+91" },
  phone: { type: String, required: true },
  role: { type: String, enum: ["shipper", "captain"], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

otpSchema.index({ dialCode: 1, phone: 1, role: 1 }, { unique: true, name: IDENTITY_INDEX });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpDoc = InferSchemaType<typeof otpSchema>;
export const Otp = model("Otp", otpSchema);
