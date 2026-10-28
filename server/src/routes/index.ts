import { asyncHandler } from "../middleware/async-handler";
import { Router, type Request, type Response } from "express";
import { sendOtp, verifyOtp, me, updateMe, logout } from "../controllers/auth.controller";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { listTrucks } from "../controllers/trucks.controller";
import { postEstimate } from "../controllers/pricing.controller";
import { getMe, updateVehicle } from "../controllers/captain.controller";
import { listRequests } from "../controllers/requests.controller";
import { acceptRequest, listTrips, getTrip, updateTripStatus } from "../controllers/trips.controller";
import { getEarnings, postQuote } from "../controllers/earnings.controller";
import { createBooking, getBooking, listBookings, cancelBooking, issueHandoverOtp } from "../controllers/bookings.controller";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "loadmitra-server", time: new Date().toISOString() });
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
router.post("/api/auth/logout", logout);

// Shared truck catalogue + shipper pricing
router.get("/api/trucks", listTrucks);
router.post("/api/pricing/estimate", postEstimate);

// Shipper bookings — persisted so the captain job board can read them back.
// Require shipper identity and bound request rates for database operations.
const bookingWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
const bookingReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
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
const captainOnly = [requireAuth, requireRole("captain")] as const;

// Captain profile
router.get("/api/captain/me", ...captainOnly, asyncHandler(getMe));
router.patch("/api/captain/vehicle", ...captainOnly, rateLimit({ windowMs: 60000, max: 20, key: (req: AuthedRequest) => req.auth!.userId }), asyncHandler(updateVehicle));

// Load requests (job board) + accept
router.get("/api/captain/requests", ...captainOnly, asyncHandler(listRequests));
router.post("/api/captain/requests/:id/accept", ...captainOnly, asyncHandler(acceptRequest));

// Trips: history + status transitions
router.get("/api/captain/trips", ...captainOnly, asyncHandler(listTrips));
router.get("/api/captain/trips/:id", ...captainOnly, asyncHandler(getTrip));
router.post("/api/captain/trips/:id/status", ...captainOnly, asyncHandler(updateTripStatus));

// Earnings: summary + per-load quote
router.get("/api/captain/earnings", ...captainOnly, asyncHandler(getEarnings));
router.post("/api/captain/earnings/quote", ...captainOnly, postQuote);

export default router;
