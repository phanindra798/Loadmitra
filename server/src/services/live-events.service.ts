import type { Response } from "express";
import type { Role } from "../middleware/auth";

/**
 * Live change signals over Server-Sent Events. Events only say *what* changed;
 * clients re-read it through the normal owner-scoped endpoints, so a stream
 * never carries booking data or widens what a user can see.
 *
 * In-process only (like the rate limiter): fine for one API instance. Running
 * several instances would need a shared bus (e.g. Redis pub/sub).
 */
export type LiveEvent =
  | { type: "booking"; id: string } // shipper: one of your bookings changed
  | { type: "trip"; id: string } // captain: one of your trips changed
  | { type: "offers" }; // captain: the job board changed

export const MAX_STREAMS_PER_USER = 5;
export const MAX_STREAMS = 2000;
export const HEARTBEAT_MS = 25_000;
/** Streams end at least hourly so a session is re-checked (revocation, expiry). */
export const MAX_STREAM_MS = 60 * 60 * 1000;
const MAX_BUFFERED_BYTES = 64 * 1024;

interface Stream {
  userId: string;
  role: Role;
  jti: string;
  res: Response;
  timers: NodeJS.Timeout[];
}

const streams = new Set<Stream>();

export type OpenResult = "ok" | "user_limit" | "server_limit";

/** Starts an event stream on `res`; it ends on disconnect, logout, expiry or MAX_STREAM_MS. */
export function openStream(
  res: Response,
  who: { userId: string; role: Role; jti: string; exp: number },
): OpenResult {
  if (streams.size >= MAX_STREAMS) return "server_limit";
  let mine = 0;
  for (const stream of streams) if (stream.userId === who.userId) mine++;
  if (mine >= MAX_STREAMS_PER_USER) return "user_limit";

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  // Tell nginx (deploy proxy) not to buffer the stream.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write("retry: 5000\n\n");

  const stream: Stream = { userId: who.userId, role: who.role, jti: who.jti, res, timers: [] };
  const lifetime = Math.max(0, Math.min(who.exp * 1000 - Date.now(), MAX_STREAM_MS));
  stream.timers.push(
    setInterval(() => write(stream, ": ping\n\n"), HEARTBEAT_MS),
    setTimeout(() => endStream(stream), lifetime),
  );
  for (const timer of stream.timers) timer.unref();
  streams.add(stream);
  res.on("close", () => endStream(stream));
  return "ok";
}

function write(stream: Stream, chunk: string) {
  // A client that stops reading is dropped instead of buffering without limit.
  if (stream.res.writableLength > MAX_BUFFERED_BYTES) { endStream(stream); return; }
  stream.res.write(chunk);
}

function endStream(stream: Stream) {
  if (!streams.delete(stream)) return;
  for (const timer of stream.timers) clearTimeout(timer);
  stream.res.end();
}

function publish(match: (stream: Stream) => boolean, event: LiveEvent) {
  const chunk = `data: ${JSON.stringify(event)}\n\n`;
  for (const stream of [...streams]) if (match(stream)) write(stream, chunk);
}

export const publishToUser = (userId: string, event: LiveEvent) =>
  publish((stream) => stream.userId === userId, event);
export const publishToRole = (role: Role, event: LiveEvent) =>
  publish((stream) => stream.role === role, event);

/** Signals everyone a booking change concerns: its shipper, its captain and, if asked, the job board. */
export function publishBookingChange(
  booking: { bookingId: string; shipperId?: string | null; acceptedByCaptainId?: string | null },
  options: { offers?: boolean } = {},
) {
  if (booking.shipperId) publishToUser(booking.shipperId, { type: "booking", id: booking.bookingId });
  if (booking.acceptedByCaptainId) publishToUser(booking.acceptedByCaptainId, { type: "trip", id: booking.bookingId });
  if (options.offers) publishToRole("captain", { type: "offers" });
}

/** Ends every stream opened with a now-revoked session. */
export function endSession(jti: string) {
  for (const stream of [...streams]) if (stream.jti === jti) endStream(stream);
}

export const streamCount = () => streams.size;

export function closeAllStreams() {
  for (const stream of [...streams]) endStream(stream);
}
