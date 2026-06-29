/* Minimal structured logger. Swap for Winston/Pino in the observability phase. */
type Level = "info" | "warn" | "error";

function log(level: Level, msg: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${level.toUpperCase()} ${msg}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta !== undefined) sink(line, meta);
  else sink(line);
}

export const logger = {
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};
