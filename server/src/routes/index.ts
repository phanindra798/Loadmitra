import { asyncHandler } from "../middleware/async-handler";
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { sendOtp, verifyOtp, me, updateMe, logout } from "../controllers/auth.controller";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { listTrucks } from "../controllers/trucks.controller";
import { streamEvents } from "../controllers/events.controller";
import { postEstimate } from "../controllers/pricing.controller";
import { getMe, updateVehicle } from "../controllers/captain.controller";
import { listRequests } from "../controllers/requests.controller";
import { acceptRequest, listTrips, getTrip, updateTripStatus } from "../controllers/trips.controller";
import { getEarnings, postQuote } from "../controllers/earnings.controller";
import { createBooking, getBooking, listBookings, cancelBooking, issueHandoverOtp } from "../controllers/bookings.controller";

const router = Router();

// 503 while MongoDB is unreachable, so monitoring sees an outage the API itself survives.
router.get("/health", (_req: Request, res: Response) => {
  const db = mongoose.connection.readyState === mongoose.ConnectionStates.connected ? "up" : "down";
  res.status(db === "up" ? 200 : 503)
    .json({ status: db === "up" ? "ok" : "degraded", db, service: "loadmitra-server", time: new Date().toISOString() });
});

// Auth (shared by both portals). Rate-limit the OTP endpoints per IP+phone to
// blunt brute-force and SMS-bombing. Keyed on body.phone (parsed before routes).
const otpKey = (req: Request) => `${req.ip}:${(req.body as { phone?: string })?.phone ?? ""}`;
const sendOtpLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, key: otpKey });
const verifyOtpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, key: otpKey });

router.post("/api/auth/send-otp", sendOtpLimiter, asyncHandler(sendOtp));
router.post("/api/auth/verify-otp", verifyOtpLimiter, asyncHandler(verifyOtp));
router.get("/api/auth/me", requireAuth, asyncHandler(me));
router.patch("/api/auth/me", requireAuth, asyncHandler(updateMe));
router.post("/api/auth/logout", asyncHandler(logout));

// Signed-in limits count per account, not per IP: many mobile users in India
// share one carrier IP, and one busy account must not block the others.
const perAccount = (req: AuthedRequest) => req.auth!.userId;

// Live change signals for both portals (Server-Sent Events). Bounded reconnects per account.
router.get("/api/events", requireAuth, rateLimit({ windowMs: 60 * 1000, max: 30, key: perAccount }), streamEvents);

// Shared truck catalogue + shipper pricing
router.get("/api/trucks", listTrucks);
router.post("/api/pricing/estimate", postEstimate);

// Shipper bookings — persisted so the captain job board can read them back.
// Require shipper identity and bound request rates for database operations.
const bookingWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, key: perAccount });
const bookingReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, key: perAccount });
router.post("/api/bookings", requireAuth, requireRole("shipper"), bookingWriteLimiter, asyncHandler(createBooking));
router.get("/api/bookings", requireAuth, requireRole("shipper"), bookingReadLimiter, asyncHandler(listBookings));
router.get("/api/bookings/:id", requireAuth, requireRole("shipper"), bookingReadLimiter, asyncHandler(getBooking));

router.post("/api/bookings/:id/cancel", requireAuth, requireRole("shipper"), bookingWriteLimiter, asyncHandler(cancelBooking));
const handoverOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5,
  key: (req: AuthedRequest) => `${req.auth!.userId}:${req.params.id}`,
});
router.post("/api/bookings/:id/handover-otp", requireAuth, requireRole("shipper"), handoverOtpLimiter, asyncHandler(issueHandoverOtp));

// Captain endpoints — captain-only. The captain always signs in before reaching
// the app, so gating these is safe. Closes the hole where anyone could read the
// live job board or, worse, flip ANY booking to cancelled/delivered by its id.
// Reads are shared by every captain screen and tab (the fallback poll alone is about
// 60 a minute per tab); writes are taps, so 30 a minute is generous.
const captainRead = [requireAuth, requireRole("captain"), rateLimit({ windowMs: 60 * 1000, max: 300, key: perAccount })] as const;
const captainWrite = [requireAuth, requireRole("captain"), rateLimit({ windowMs: 60 * 1000, max: 30, key: perAccount })] as const;

// Captain profile
router.get("/api/captain/me", ...captainRead, asyncHandler(getMe));
router.patch("/api/captain/vehicle", ...captainWrite, asyncHandler(updateVehicle));

// Load requests (job board) + accept
router.get("/api/captain/requests", ...captainRead, asyncHandler(listRequests));
router.post("/api/captain/requests/:id/accept", ...captainWrite, asyncHandler(acceptRequest));

// Trips: history + status transitions
router.get("/api/captain/trips", ...captainRead, asyncHandler(listTrips));
router.get("/api/captain/trips/:id", ...captainRead, asyncHandler(getTrip));
router.post("/api/captain/trips/:id/status", ...captainWrite, asyncHandler(updateTripStatus));

// Earnings: summary + per-load quote
router.get("/api/captain/earnings", ...captainRead, asyncHandler(getEarnings));
router.post("/api/captain/earnings/quote", ...captainWrite, postQuote);

export default router;
