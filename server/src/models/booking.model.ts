import { Schema, model, type InferSchemaType } from "mongoose";
import { captainPayout } from "../services/earnings.service";
import type { LoadRequest, Payout, Trip, TripStatus } from "../types";

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
    createdLabel: { type: String, default: "Just now" },
    status: { type: String, enum: ["open", "accepted", "cancelled"], default: "open", index: true },
    acceptedByCaptainId: { type: String },
    captain: { type: acceptedCaptainSchema, default: undefined }, // set when a captain accepts
    // Captain's live trip lifecycle, mirrored to the shipper's track screen.
    tripStatus: {
      type: String,
      enum: ["accepted", "enroute_pickup", "at_pickup", "picked", "enroute_drop", "delivered", "cancelled"],
    },
  },
  { timestamps: true },
);

export type BookingDoc = InferSchemaType<typeof bookingSchema>;
export const Booking = model("Booking", bookingSchema);

/** Captain payout for a booking — same economics as the seed (earnings.service). */
function payoutFor(b: BookingDoc): Payout {
  return captainPayout(b.agreedPrice || 0, b.mode, b.distanceKm);
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
    status,
    createdLabel: r.createdLabel,
  };
}
