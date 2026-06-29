import { captainPayout, estimateFare } from "./earnings";
import type {
  CaptainProfile,
  EarningsSummary,
  LoadMode,
  LoadRequest,
  Place,
  Trip,
  TruckType,
} from "./types";

/**
 * Front-end mock data for the captain app. Every shape conforms to ./types so
 * swapping these for real API responses later is a drop-in change. Nothing here
 * uses Date.now() or Math.random at module scope, keeping SSR output
 * deterministic (matches the shipper app's approach).
 */

export const TRUCK_TYPES: TruckType[] = [
  { id: "ace", name: "Tata Ace", desc: "Up to 750 kg • 7 ft open", capacityKg: 750, capacityCFT: 180, vehicleFactor: 1.0, baseFare: 250, emoji: "🛻" },
  { id: "pickup8", name: "Pickup 8 ft", desc: "Up to 1,200 kg • 8 ft", capacityKg: 1200, capacityCFT: 260, vehicleFactor: 1.25, baseFare: 320, emoji: "🚐" },
  { id: "tata407", name: "Tata 407", desc: "Up to 2,500 kg • 9 ft", capacityKg: 2500, capacityCFT: 420, vehicleFactor: 1.7, baseFare: 480, emoji: "🚚" },
  { id: "truck14", name: "14 ft Truck", desc: "Up to 3,500 kg • 14 ft", capacityKg: 3500, capacityCFT: 720, vehicleFactor: 2.1, baseFare: 650, emoji: "🚛" },
  { id: "truck17", name: "17 ft Truck", desc: "Up to 5,000 kg • 17 ft", capacityKg: 5000, capacityCFT: 980, vehicleFactor: 2.6, baseFare: 850, emoji: "🚛" },
];

export function truckById(id?: string): TruckType | undefined {
  return TRUCK_TYPES.find((t) => t.id === id);
}

/** The logged-in captain. Drives a Tata 407 out of Hyderabad. */
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

/**
 * Pool of distinct captain identities. A signed-in captain is mapped to one of
 * these (stable, by phone) so the shipper doesn't always see the same driver.
 */
export const CAPTAIN_POOL: CaptainProfile[] = [
  CAPTAIN,
  { id: "cap-2087", name: "Suresh Babu", phoneMasked: "+91 ••••• ••5 12", vehicleNumber: "TS07 AB 9032", truckTypeId: "ace", rating: 4.7, trips: 880, joinedLabel: "Captain since Jul 2023", hue: 28, kycVerified: true, city: "Hyderabad" },
  { id: "cap-3391", name: "Imran Khan", phoneMasked: "+91 ••••• ••7 65", vehicleNumber: "AP16 CJ 4410", truckTypeId: "truck14", rating: 4.9, trips: 2120, joinedLabel: "Captain since Jan 2022", hue: 145, kycVerified: true, city: "Vijayawada" },
  { id: "cap-4456", name: "Mahesh Reddy", phoneMasked: "+91 ••••• ••3 28", vehicleNumber: "TS09 KX 7781", truckTypeId: "pickup8", rating: 4.6, trips: 610, joinedLabel: "Captain since Nov 2023", hue: 280, kycVerified: true, city: "Warangal" },
  { id: "cap-5512", name: "Venkatesh Rao", phoneMasked: "+91 ••••• ••9 04", vehicleNumber: "KA01 MN 5567", truckTypeId: "truck17", rating: 4.8, trips: 1740, joinedLabel: "Captain since Mar 2021", hue: 200, kycVerified: true, city: "Bengaluru" },
  { id: "cap-6634", name: "Prakash Naidu", phoneMasked: "+91 ••••• ••1 89", vehicleNumber: "AP31 DG 2245", truckTypeId: "tata407", rating: 4.5, trips: 430, joinedLabel: "Captain since Feb 2024", hue: 340, kycVerified: false, city: "Guntur" },
];

/** Stable, distinct captain identity for a given key (the signed-in phone). */
export function captainIdentityFor(key?: string): CaptainProfile {
  if (!key) return CAPTAIN_POOL[0];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CAPTAIN_POOL[h % CAPTAIN_POOL.length];
}

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

interface RequestSeed {
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

function buildRequest(s: RequestSeed): LoadRequest {
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

/**
 * Incoming job offers shown when the captain is online. The matching engine
 * would stream these over a socket; here they're a deterministic seed list that
 * the dashboard "broadcasts" one at a time to simulate live demand.
 */
export const LOAD_REQUESTS: LoadRequest[] = [
  buildRequest({
    id: "REQ-8842",
    mode: "return",
    pickup: PLACES.gachibowli,
    drop: PLACES.vijayawada,
    distanceKm: 275,
    truckTypeId: "tata407",
    loadWeightKg: 1800,
    goodsType: "Electronics",
    etaToPickupMins: 8,
    customerName: "Sai Traders",
    customerRating: 4.7,
    createdLabel: "Just now",
  }),
  buildRequest({
    id: "REQ-8839",
    mode: "full",
    pickup: PLACES.hitec,
    drop: PLACES.warangal,
    distanceKm: 145,
    truckTypeId: "tata407",
    loadWeightKg: 2200,
    goodsType: "Furniture",
    etaToPickupMins: 5,
    customerName: "Lakshmi Movers",
    customerRating: 4.9,
    createdLabel: "Just now",
  }),
  buildRequest({
    id: "REQ-8835",
    mode: "shared",
    pickup: PLACES.kompally,
    drop: PLACES.secunderabad,
    distanceKm: 22,
    truckTypeId: "tata407",
    loadWeightKg: 900,
    goodsType: "General goods",
    etaToPickupMins: 12,
    customerName: "Bharat Stores",
    customerRating: 4.5,
    createdLabel: "1 min ago",
  }),
  buildRequest({
    id: "REQ-8831",
    mode: "full",
    pickup: PLACES.secunderabad,
    drop: PLACES.guntur,
    distanceKm: 290,
    truckTypeId: "tata407",
    loadWeightKg: 2400,
    goodsType: "Textiles",
    etaToPickupMins: 15,
    customerName: "Annapurna Logistics",
    customerRating: 4.6,
    createdLabel: "2 min ago",
  }),
];

function buildTrip(
  s: RequestSeed & { status: Trip["status"]; ratingGiven?: number },
): Trip {
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

/** Seeded trip history (most recent first). */
export const SAMPLE_TRIPS: Trip[] = [
  buildTrip({
    id: "LM-7F3A21",
    mode: "return",
    pickup: PLACES.bengaluru,
    drop: PLACES.hitec,
    distanceKm: 575,
    truckTypeId: "tata407",
    loadWeightKg: 1800,
    goodsType: "Electronics",
    etaToPickupMins: 0,
    customerName: "Sri Venkateswara Co.",
    customerRating: 4.8,
    createdLabel: "Today, 4:10 PM",
    status: "delivered",
    ratingGiven: 5,
  }),
  buildTrip({
    id: "LM-6B12C9",
    mode: "full",
    pickup: PLACES.hitec,
    drop: PLACES.warangal,
    distanceKm: 145,
    truckTypeId: "tata407",
    loadWeightKg: 2300,
    goodsType: "Furniture",
    etaToPickupMins: 0,
    customerName: "Lakshmi Movers",
    customerRating: 4.9,
    createdLabel: "Today, 11:25 AM",
    status: "delivered",
    ratingGiven: 5,
  }),
  buildTrip({
    id: "LM-5A90E4",
    mode: "full",
    pickup: PLACES.gachibowli,
    drop: PLACES.vijayawada,
    distanceKm: 275,
    truckTypeId: "tata407",
    loadWeightKg: 2200,
    goodsType: "Auto parts",
    etaToPickupMins: 0,
    customerName: "Annapurna Logistics",
    customerRating: 4.6,
    createdLabel: "Yesterday, 9:00 AM",
    status: "delivered",
    ratingGiven: 4,
  }),
  buildTrip({
    id: "LM-4C71B8",
    mode: "shared",
    pickup: PLACES.kompally,
    drop: PLACES.secunderabad,
    distanceKm: 22,
    truckTypeId: "tata407",
    loadWeightKg: 800,
    goodsType: "General goods",
    etaToPickupMins: 0,
    customerName: "Bharat Stores",
    customerRating: 4.5,
    createdLabel: "Yesterday, 7:40 AM",
    status: "cancelled",
  }),
];

/** Earnings summary derived from the seeded ledger (today + history). */
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

export const GOODS_TYPES = [
  "General goods",
  "Electronics",
  "Furniture",
  "Textiles",
  "Perishables",
  "Construction material",
  "Auto parts",
  "Other",
];
