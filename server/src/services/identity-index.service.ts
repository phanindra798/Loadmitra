import { User, IDENTITY_INDEX, LEGACY_IDENTITY_INDEX } from "../models/user.model";
import { Otp } from "../models/otp.model";

const missingIndex = (error: unknown) => {
  const e = error as { code?: number; codeName?: string };
  return e.code === 27 || e.codeName === "IndexNotFound" || e.code === 26 || e.codeName === "NamespaceNotFound";
};

/**
 * Moves login identity from (phone, role) to (dialCode, phone, role). Idempotent
 * and safe on every start. The new unique index is built before the old one is
 * dropped, so phone uniqueness is enforced at every moment of the migration.
 */
export async function ensureIdentityIndexes(): Promise<void> {
  for (const model of [User, Otp]) {
    // Every account and challenge created before country codes were stored is Indian.
    await model.collection.updateMany({ dialCode: null }, { $set: { dialCode: "+91" } });
    await model.collection.createIndex({ dialCode: 1, phone: 1, role: 1 }, { unique: true, name: IDENTITY_INDEX });
    try {
      await model.collection.dropIndex(LEGACY_IDENTITY_INDEX);
    } catch (error) {
      if (!missingIndex(error)) throw error;
    }
  }
}
