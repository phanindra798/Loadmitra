import mongoose from "mongoose";
import { env } from "./env";
import { ensureActiveTripIndex } from "../services/active-trip.service";
import { logger } from "../utils/logger";

/** Connect to MongoDB (Atlas or local). Resolves once the cluster is reachable. */
export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  // Fail server selection fast so a request doesn't hang for the full default
  // 30s when the cluster is unreachable (e.g. Atlas IP not whitelisted).
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await ensureActiveTripIndex();
  const { host, name } = mongoose.connection;
  logger.info(`MongoDB connected → ${host}/${name}`);
}

let listenersBound = false;

/**
 * Connect with retry — never throws. Lets the HTTP server boot and serve even
 * while the DB is briefly unreachable; mongoose auto-reconnects once it's back.
 * The usual culprit in dev is the Atlas IP whitelist (Network Access) not
 * including your current IP — fix that and this loop connects on its next pass.
 */
export async function connectDbWithRetry(retryMs = 10000): Promise<void> {
  if (!listenersBound) {
    listenersBound = true;
    mongoose.connection.on("error", (err) => logger.error("MongoDB error", err.message));
    mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
    mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
  }
  for (let attempt = 1; ; attempt++) {
    try {
      await connectDb();
      return;
    } catch (err) {
      logger.error(
        `MongoDB connect failed (attempt ${attempt}). Retrying in ${retryMs / 1000}s. ` +
          `Check database connectivity, index permissions, MongoDB version and duplicate active trips.`,
        (err as Error).message,
      );
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }
}
