import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A LoadMitra account. The same phone number can exist as both a shipper and a
 * captain (separate portals), so uniqueness is on the (phone, role) pair.
 */
const userSchema = new Schema(
  {
    role: { type: String, enum: ["shipper", "captain"], required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, required: true, trim: true }, // 10-digit, no country code
    dialCode: { type: String, default: "+91" },
  },
  { timestamps: true },
);

userSchema.index({ phone: 1, role: 1 }, { unique: true });

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
