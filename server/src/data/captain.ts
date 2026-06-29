import { captainPayout, estimateFare, truckById } from "../services/earnings.service";
import type { CaptainProfile, EarningsSummary, LoadMode, LoadRequest, Place, Trip } from "../types";

/**
 * Seed data for the captain endpoints. In the DB phase these become the
 * CaptainProfile / Load / Booking collections; the shapes stay the same.
 * Deterministic (no Date.now / Math.random at module scope).
 */

export const CAPTAIN: CaptainProfile = {
  id: "cap-1042",
  name: "Ravi Kumar",
  phoneMasked: "+91 ••••• ••2 47",
  vehicleNumber: "TS09 UB 4421",
  truckTypeId: "tata407",
  rating: 4.8,
  trips: 1530,
  joinedLabel: "Captain since Mar 2023",
  hue: 211,
  kycVerified: true,
  city: "Hyderabad",
};

const PLACES: Record<string, Place> = {
  hitec: { label: "HITEC City warehouse", address: "Madhapur, Hyderabad", city: "Hyderabad" },
  kompally: { label: "Kompally Warehouse", address: "Plot 44, Kompally Industrial Area", city: "Hyderabad" },
  gachibowli: { label: "Gachibowli", address: "DLF Cyber City, Gachibowli", city: "Hyderabad" },
  secunderabad: { label: "Secunderabad Rly Station", address: "Station Road, Secunderabad", city: "Hyderabad" },
  vijayawada: { label: "Vijayawada", address: "Benz Circle, Vijayawada", city: "Vijayawada" },
  warangal: { label: "Warangal", address: "Hanamkonda, Warangal", city: "Warangal" },
  bengaluru: { label: "Whitefield, Bengaluru", address: "ITPL Main Rd, Whitefield", city: "Bengaluru" },
  guntur: { label: "Guntur Market Yard", address: "Mirchi Yard, Guntur", city: "Guntur" },
};

interface Seed {
  id: string;
  mode: LoadMode;
  pickup: Place;
  drop: Place;
  distanceKm: number;
  truckTypeId: string;
  loadWeightKg: number;
  goodsType: string;
  etaToPickupMins: number;
  customerName: string;
  customerRating: number;
  createdLabel: string;
}

function buildRequest(s: Seed): LoadRequest {
  const truck = truckById(s.truckTypeId)!;
  const fare = estimateFare({ truck, distanceKm: s.distanceKm, mode: s.mode, loadWeightKg: s.loadWeightKg });
  return {
    id: s.id,
    mode: s.mode,
    pickup: s.pickup,
    drop: s.drop,
    distanceKm: s.distanceKm,
    truckTypeId: s.truckTypeId,
    truckTypeName: truck.name,
    loadWeightKg: s.loadWeightKg,
    goodsType: s.goodsType,
    payout: captainPayout(fare, s.mode, s.distanceKm),
    etaToPickupMins: s.etaToPickupMins,
    customerName: s.customerName,
    customerRating: s.customerRating,
    createdLabel: s.createdLabel,
  };
}

export const LOAD_REQUESTS: LoadRequest[] = [
  buildRequest({ id: "REQ-8842", mode: "return", pickup: PLACES.gachibowli, drop: PLACES.vijayawada, distanceKm: 275, truckTypeId: "tata407", loadWeightKg: 1800, goodsType: "Electronics", etaToPickupMins: 8, customerName: "Sai Traders", customerRating: 4.7, createdLabel: "Just now" }),
  buildRequest({ id: "REQ-8839", mode: "full", pickup: PLACES.hitec, drop: PLACES.warangal, distanceKm: 145, truckTypeId: "tata407", loadWeightKg: 2200, goodsType: "Furniture", etaToPickupMins: 5, customerName: "Lakshmi Movers", customerRating: 4.9, createdLabel: "Just now" }),
  buildRequest({ id: "REQ-8835", mode: "shared", pickup: PLACES.kompally, drop: PLACES.secunderabad, distanceKm: 22, truckTypeId: "tata407", loadWeightKg: 900, goodsType: "General goods", etaToPickupMins: 12, customerName: "Bharat Stores", customerRating: 4.5, createdLabel: "1 min ago" }),
  buildRequest({ id: "REQ-8831", mode: "full", pickup: PLACES.secunderabad, drop: PLACES.guntur, distanceKm: 290, truckTypeId: "tata407", loadWeightKg: 2400, goodsType: "Textiles", etaToPickupMins: 15, customerName: "Annapurna Logistics", customerRating: 4.6, createdLabel: "2 min ago" }),
];

function buildTrip(s: Seed & { status: Trip["status"]; ratingGiven?: number }): Trip {
  const r = buildRequest(s);
  return {
    id: s.id,
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
    status: s.status,
    createdLabel: s.createdLabel,
    ratingGiven: s.ratingGiven,
  };
}

export const SAMPLE_TRIPS: Trip[] = [
  buildTrip({ id: "LM-7F3A21", mode: "return", pickup: PLACES.bengaluru, drop: PLACES.hitec, distanceKm: 575, truckTypeId: "tata407", loadWeightKg: 1800, goodsType: "Electronics", etaToPickupMins: 0, customerName: "Sri Venkateswara Co.", customerRating: 4.8, createdLabel: "Today, 4:10 PM", status: "delivered", ratingGiven: 5 }),
  buildTrip({ id: "LM-6B12C9", mode: "full", pickup: PLACES.hitec, drop: PLACES.warangal, distanceKm: 145, truckTypeId: "tata407", loadWeightKg: 2300, goodsType: "Furniture", etaToPickupMins: 0, customerName: "Lakshmi Movers", customerRating: 4.9, createdLabel: "Today, 11:25 AM", status: "delivered", ratingGiven: 5 }),
  buildTrip({ id: "LM-5A90E4", mode: "full", pickup: PLACES.gachibowli, drop: PLACES.vijayawada, distanceKm: 275, truckTypeId: "tata407", loadWeightKg: 2200, goodsType: "Auto parts", etaToPickupMins: 0, customerName: "Annapurna Logistics", customerRating: 4.6, createdLabel: "Yesterday, 9:00 AM", status: "delivered", ratingGiven: 4 }),
  buildTrip({ id: "LM-4C71B8", mode: "shared", pickup: PLACES.kompally, drop: PLACES.secunderabad, distanceKm: 22, truckTypeId: "tata407", loadWeightKg: 800, goodsType: "General goods", etaToPickupMins: 0, customerName: "Bharat Stores", customerRating: 4.5, createdLabel: "Yesterday, 7:40 AM", status: "cancelled" }),
];

const deliveredToday = SAMPLE_TRIPS.filter(
  (t) => t.status === "delivered" && t.createdLabel.startsWith("Today"),
);

export const EARNINGS: EarningsSummary = {
  today: deliveredToday.reduce((sum, t) => sum + t.payout.net, 0),
  week: 18450,
  month: 72300,
  tripsToday: deliveredToday.length,
  onlineHoursToday: 6.5,
  incentiveThisWeek: 1240,
  acceptanceRate: 0.92,
  ledger: SAMPLE_TRIPS.filter((t) => t.status === "delivered").map((t) => ({
    id: t.id,
    label: `${t.pickup.city} → ${t.drop.city}`,
    mode: t.mode,
    dateLabel: t.createdLabel,
    net: t.payout.net,
  })),
};
