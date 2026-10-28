import { Schema, model, type InferSchemaType } from "mongoose";
import { captainPayout } from "../services/earnings.service";
import type { LoadRequest, Payout, PriceBreakdown, Trip, TripStatus } from "../types";

/**
 * A shipper-created load. This is the bridge between the two portals: the
 * shipper writes one here when they book, and the captain job board
 * (`GET /api/captain/requests`) reads the open ones back. Shapes are kept
 * compatible with the captain `LoadRequest` / `Trip` views via the mappers below.
 */
const placeSchema = new Schema(
  { label: { type: String, default: "" }, address: { type: String, default: "" }, city: { type: String, default: "" } },
  { _id: false },
);

/** Snapshot of the captain who accepted — shaped to the shipper's Captain card. */
const acceptedCaptainSchema = new Schema(
  {
    id: { type: String, default: "" },
    name: { type: String, default: "Captain" },
    vehicleNumber: { type: String, default: "" },
    truckTypeId: { type: String, default: "" },
    rating: { type: Number, default: 4.8 },
    trips: { type: Number, default: 0 },
    phoneMasked: { type: String, default: "" },
    etaMins: { type: Number, default: 6 },
    hue: { type: Number, default: 211 },
    badges: { type: [String], default: [] },
  },
  { _id: false },
);

const priceSnapshotSchema = new Schema<PriceBreakdown>({
  mode: { type: String, enum: ["full", "shared", "return"], required: true },
  distanceKm: Number, ratePerKm: Number, base: Number, distanceCharge: Number,
  surgeMultiplier: Number, subtotal: Number, discountPct: Number, discount: Number,
  sharePct: Number, estimate: Number, low: Number, high: Number, loadTons: Number,
  perTon: Number, perTonLow: Number, perTonHigh: Number, savings: Number, co2SavedKg: Number,
}, { _id: false });

const payoutSnapshotSchema = new Schema<Payout>({
  fare: { type: Number, required: true }, commissionPct: { type: Number, required: true },
  commission: { type: Number, required: true }, incentive: { type: Number, required: true },
  net: { type: Number, required: true }, perKm: { type: Number, required: true },
}, { _id: false });

const bookingSchema = new Schema(
  {
    bookingId: { type: String, required: true, unique: true }, // human id from the shipper, e.g. LM-AB12CD
    shipperId: { type: String, index: true },
    requestFingerprint: { type: String },
    customerName: { type: String, default: "LoadMitra Shipper" },
    customerRating: { type: Number, default: 4.8 },
    mode: { type: String, enum: ["full", "shared", "return"], required: true },
    pickup: { type: placeSchema, required: true },
    drop: { type: placeSchema, required: true },
    distanceKm: { type: Number, required: true },
    truckTypeId: { type: String, required: true },
    truckTypeName: { type: String, required: true },
    loadWeightKg: { type: Number, required: true },
    goodsType: { type: String, default: "General goods" },
    agreedPrice: { type: Number, default: 0 },
    priceSnapshot: { type: priceSnapshotSchema, default: undefined },
    createdLabel: { type: String, default: "Just now" },
    // Written atomically only when delivery is verified. Neither is client input.
    completedAt: { type: Date, default: undefined },
    payoutSnapshot: { type: payoutSnapshotSchema, default: undefined },
    status: { type: String, enum: ["open", "accepted", "cancelled"], default: "open", index: true },
    acceptedByCaptainId: { type: String },
    captain: { type: acceptedCaptainSchema, default: undefined }, // set when a captain accepts
    // Only a keyed hash is persisted. Codes are returned once to the owning shipper.
    handoverOtp: {
      type: new Schema({
        stage: { type: String, enum: ["picked", "delivered"], required: true },
        codeHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        issuedAt: { type: Date, required: true },
        attempts: { type: Number, default: 0, required: true },
      }, { _id: false }),
      default: undefined,
    },
    // Captain's live trip lifecycle, mirrored to the shipper's track screen.
    tripStatus: {
      type: String,
      enum: ["accepted", "enroute_pickup", "at_pickup", "picked", "enroute_drop", "delivered", "cancelled"],
    },
  },
  { timestamps: true },
);

// Keep the constraint in schema metadata as well as installing it explicitly
// before acceptance; future index synchronization must retain this invariant.
export const ACTIVE_TRIP_INDEX_OPTIONS = {
  name: "one_active_trip_per_captain",
  unique: true,
  partialFilterExpression: {
    status: "accepted",
    acceptedByCaptainId: { $type: "string" },
    // null also includes legacy accepted bookings with no tripStatus.
    tripStatus: { $in: [null, "accepted", "enroute_pickup", "at_pickup", "picked", "enroute_drop"] },
  },
};
bookingSchema.index({ acceptedByCaptainId: 1 }, ACTIVE_TRIP_INDEX_OPTIONS);

export type BookingDoc = InferSchemaType<typeof bookingSchema>;
bookingSchema.index({ shipperId: 1, _id: -1 });
bookingSchema.index({ acceptedByCaptainId: 1, createdAt: -1, _id: -1 });
bookingSchema.index({ acceptedByCaptainId: 1, tripStatus: 1, status: 1, completedAt: -1, _id: -1 });
export const Booking = model("Booking", bookingSchema);

/** Captain payout for a booking — same economics as the seed (earnings.service). */
function payoutFor(b: BookingDoc): Payout {
  return b.payoutSnapshot ?? captainPayout(b.agreedPrice || 0, b.mode, b.distanceKm);
}

/** Map a stored booking to the captain job-board `LoadRequest` shape. */
export function bookingToRequest(b: BookingDoc): LoadRequest {
  return {
    id: b.bookingId,
    mode: b.mode,
    pickup: b.pickup,
    drop: b.drop,
    distanceKm: b.distanceKm,
    truckTypeId: b.truckTypeId,
    truckTypeName: b.truckTypeName,
    loadWeightKg: b.loadWeightKg,
    goodsType: b.goodsType,
    payout: payoutFor(b),
    etaToPickupMins: 6,
    customerName: b.customerName,
    customerRating: b.customerRating,
    createdLabel: b.createdLabel,
  };
}

/** Map a stored booking to the captain `Trip` shape (after accept / status change). */
export function bookingToTrip(b: BookingDoc, status: TripStatus): Trip {
  const r = bookingToRequest(b);
  return {
    id: r.id,
    mode: r.mode,
    pickup: r.pickup,
    drop: r.drop,
    distanceKm: r.distanceKm,
    truckTypeId: r.truckTypeId,
    truckTypeName: r.truckTypeName,
    loadWeightKg: r.loadWeightKg,
    goodsType: r.goodsType,
    payout: r.payout,
    customerName: r.customerName,
    customerRating: r.customerRating,
    status: b.status === "cancelled" ? "cancelled" : status,
    createdLabel: r.createdLabel,
    createdAt: b.createdAt?.toISOString(),
    updatedAt: b.updatedAt?.toISOString(),
  };
}
