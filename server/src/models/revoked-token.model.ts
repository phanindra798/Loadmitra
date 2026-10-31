import { Schema, model } from "mongoose";

/**
 * Login tokens revoked by logout, keyed by the JWT `jti`. Each entry lives only
 * until the token would have expired anyway; the TTL index then removes it.
 */
const revokedTokenSchema = new Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedToken = model("RevokedToken", revokedTokenSchema);
