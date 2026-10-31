import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A LoadMitra account. The same phone number can exist as both a shipper and a
 * captain (separate portals), and the same digits in two countries are two
 * people, so uniqueness is on (dialCode, phone, role).
 */
const userSchema = new Schema(
  {
    role: { type: String, enum: ["shipper", "captain"], required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, required: true, trim: true }, // 10-digit, no country code
    vehicle: { type: new Schema({
      vehicleNumber: { type: String, required: true },
      truckTypeId: { type: String, required: true },
      city: { type: String, required: true },
    }, { _id: false }), default: undefined },
    dialCode: { type: String, required: true, default: "+91" },
  },
  { timestamps: true },
);

/** Shared by users and OTP challenges; installed by services/identity-index.service. */
export const IDENTITY_INDEX = "identity_dial_phone_role";
/** Pre-country-code unique index, removed once the identity index exists. */
export const LEGACY_IDENTITY_INDEX = "phone_1_role_1";
userSchema.index({ dialCode: 1, phone: 1, role: 1 }, { unique: true, name: IDENTITY_INDEX });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);

/** Shape returned to clients (never leak internal fields). */
export function publicUser(u: UserDoc & { _id: unknown }) {
  return {
    id: String(u._id),
    role: u.role,
    name: u.name,
    email: u.email,
    phone: u.phone,
    dialCode: u.dialCode,
  };
}
