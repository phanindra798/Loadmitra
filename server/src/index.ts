import { createApp } from "./app";
import { connectDbWithRetry } from "./config/db";
import { env } from "./config/env";
import { logger } from "./utils/logger";

function main() {
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`LoadMitra API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
  // Connect the DB in the background with retry. The HTTP server boots
  // immediately so the frontends can always reach the API; DB-backed routes
  // (login, bookings) work as soon as the connection lands. This stops one
  // Atlas hiccup (or an un-whitelisted IP) from taking the whole API down.
  void connectDbWithRetry();
}

main();
