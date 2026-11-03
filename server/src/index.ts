import mongoose from "mongoose";
import { createApp } from "./app";
import { connectDbWithRetry } from "./config/db";
import { env } from "./config/env";
import { closeAllStreams } from "./services/live-events.service";
import { logger } from "./utils/logger";

function main() {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`LoadMitra API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
  // Connect the DB in the background with retry. The HTTP server boots
  // immediately so the frontends can always reach the API; DB-backed routes
  // (login, bookings) work as soon as the connection lands. This stops one
  // Atlas hiccup (or an un-whitelisted IP) from taking the whole API down.
  void connectDbWithRetry();

  // On restart (PM2 sends SIGINT, systemd/Docker SIGTERM) finish in-flight requests
  // instead of cutting them off. Live streams never finish on their own, so end them;
  // the portals reconnect to the new process. Give up after 8 s (PM2 kill_timeout is 10 s).
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info(`${signal} received, shutting down`);
    setTimeout(() => process.exit(1), 8000).unref();
    closeAllStreams();
    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
