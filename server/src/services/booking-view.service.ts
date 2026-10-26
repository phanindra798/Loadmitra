import type { BookingDoc } from "../models/booking.model";

/** Explicit public fields: never expose owner IDs, fingerprints or OTP challenges. */
export function shipperBookingView(b: BookingDoc) {
  const place = (p: BookingDoc["pickup"]) => ({ label: p.label, address: p.address, city: p.city });
  const c = b.captain;
  return {
    id: b.bookingId, mode: b.mode, pickup: place(b.pickup), drop: place(b.drop),
    distanceKm: b.distanceKm, truckTypeId: b.truckTypeId, truckTypeName: b.truckTypeName,
    loadWeightKg: b.loadWeightKg, goodsType: b.goodsType, agreedPrice: b.agreedPrice,
    priceSnapshot: b.priceSnapshot ?? null,
    status: b.status, tripStatus: b.tripStatus ?? null,
    captain: c ? {
      id: c.id, name: c.name, vehicleNumber: c.vehicleNumber, truckTypeId: c.truckTypeId,
      rating: c.rating, trips: c.trips, phoneMasked: c.phoneMasked, etaMins: c.etaMins,
      hue: c.hue, badges: c.badges,
    } : null,
    createdAt: b.createdAt?.toISOString() ?? null,
    updatedAt: b.updatedAt?.toISOString() ?? null,
    createdLabel: b.createdAt ? b.createdAt.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    }) : b.createdLabel,
  };
}
