import { estimateDistanceKm, estimatePrice } from "./pricing";
import type { Booking, Captain, Offer, Place, TruckType } from "./types";

/**
 * Front-end mock data. Every shape conforms to ./types so swapping these for
 * real API responses later is a drop-in change. Nothing here uses Date.now()
 * or Math.random at module scope, keeping SSR output deterministic.
 */

export const TRUCK_TYPES: TruckType[] = [
  {
    id: "ace",
    name: "Tata Ace",
    desc: "Up to 750 kg • 7 ft open",
    capacityKg: 750,
    capacityCFT: 180,
    vehicleFactor: 1.0,
    ratePerKm: 18, // Mini truck — ₹10–25/km band
    baseFare: 250,
    etaMins: 6,
    rating: 4.8,
    trips: 1240,
    emoji: "🛻",
  },
  {
    id: "pickup8",
    name: "Pickup 8 ft",
    desc: "Up to 1,200 kg • 8 ft",
    capacityKg: 1200,
    capacityCFT: 260,
    vehicleFactor: 1.25,
    ratePerKm: 24, // Light commercial — ₹18–35/km band
    baseFare: 320,
    etaMins: 9,
    rating: 4.7,
    trips: 980,
    emoji: "🚐",
  },
  {
    id: "tata407",
    name: "Tata 407",
    desc: "Up to 2,500 kg • 9 ft",
    capacityKg: 2500,
    capacityCFT: 420,
    vehicleFactor: 1.7,
    ratePerKm: 30, // Medium truck — ₹22–40/km band
    baseFare: 480,
    etaMins: 12,
    rating: 4.8,
    trips: 1530,
    emoji: "🚚",
  },
  {
    id: "truck14",
    name: "14 ft Truck",
    desc: "Up to 3,500 kg • 14 ft",
    capacityKg: 3500,
    capacityCFT: 720,
    vehicleFactor: 2.1,
    ratePerKm: 36, // Large truck — upper ₹22–40/km band
    baseFare: 650,
    etaMins: 18,
    rating: 4.6,
    trips: 870,
    emoji: "🚛",
  },
  {
    id: "truck17",
    name: "17 ft Truck",
    desc: "Up to 5,000 kg • 17 ft",
    capacityKg: 5000,
    capacityCFT: 980,
    vehicleFactor: 2.6,
    ratePerKm: 44, // Heavy truck — into ₹35–85/km band
    baseFare: 850,
    etaMins: 24,
    rating: 4.7,
    trips: 640,
    emoji: "🚛",
  },
];

export function truckById(id?: string): TruckType | undefined {
  return TRUCK_TYPES.find((t) => t.id === id);
}

export const SAVED_PLACES: Place[] = [
  {
    id: "home",
    label: "Home",
    address: "Road No. 12, Jubilee Hills, Hyderabad",
    city: "Hyderabad",
    kind: "home",
  },
  {
    id: "work",
    label: "Work",
    address: "HITEC City, Madhapur, Hyderabad",
    city: "Hyderabad",
    kind: "work",
  },
];

export const RECENT_PLACES: Place[] = [
  {
    id: "r1",
    label: "Kompally Warehouse",
    address: "Plot 44, Kompally Industrial Area, Hyderabad",
    city: "Hyderabad",
    kind: "recent",
  },
  {
    id: "r2",
    label: "Secunderabad Rly Station",
    address: "Station Road, Secunderabad",
    city: "Hyderabad",
    kind: "recent",
  },
  {
    id: "r3",
    label: "Gachibowli",
    address: "DLF Cyber City, Gachibowli, Hyderabad",
    city: "Hyderabad",
    kind: "recent",
  },
  {
    id: "r4",
    label: "Whitefield, Bengaluru",
    address: "ITPL Main Rd, Whitefield, Bengaluru",
    city: "Bengaluru",
    kind: "recent",
  },
];

/** A small searchable directory used by the location picker. */
export const PLACE_DIRECTORY: Place[] = [
  ...SAVED_PLACES,
  ...RECENT_PLACES,
  { id: "p1", label: "Vijayawada", address: "Benz Circle, Vijayawada", city: "Vijayawada", kind: "other" },
  { id: "p2", label: "Visakhapatnam Port", address: "Port Area, Visakhapatnam", city: "Visakhapatnam", kind: "other" },
  { id: "p3", label: "Warangal", address: "Hanamkonda, Warangal", city: "Warangal", kind: "other" },
  { id: "p4", label: "Guntur Market Yard", address: "Mirchi Yard, Guntur", city: "Guntur", kind: "other" },
  { id: "p5", label: "Pune — Chakan MIDC", address: "Chakan Industrial Area, Pune", city: "Pune", kind: "other" },
  { id: "p6", label: "Mumbai — Bhiwandi", address: "Bhiwandi Logistics Hub, Mumbai", city: "Mumbai", kind: "other" },
  { id: "p7", label: "Chennai — Ambattur", address: "Ambattur Industrial Estate, Chennai", city: "Chennai", kind: "other" },
];

const CAPTAIN_NAMES = [
  "Ravi Kumar",
  "Suresh Babu",
  "Imran Khan",
  "Mahesh Reddy",
  "Anil Yadav",
];

const PLATE_PREFIX = ["TS09", "TS07", "AP16", "KA05", "TS10"];

/** Deterministic captain for a given truck type (used by the matching screen). */
export function captainForTruck(truckTypeId: string): Captain {
  const idx = Math.max(0, TRUCK_TYPES.findIndex((t) => t.id === truckTypeId));
  const truck = TRUCK_TYPES[idx] ?? TRUCK_TYPES[0];
  return {
    id: `cap-${truckTypeId}`,
    name: CAPTAIN_NAMES[idx % CAPTAIN_NAMES.length],
    vehicleNumber: `${PLATE_PREFIX[idx % PLATE_PREFIX.length]} ${1000 + idx * 111}`,
    truckTypeId,
    rating: truck.rating,
    trips: truck.trips,
    phoneMasked: "+91 ••••• ••2 47",
    etaMins: truck.etaMins,
    hue: (idx * 67) % 360,
    badges: ["verified", "return"],
  };
}

export const OFFERS: Offer[] = [
  {
    id: "o1",
    title: "Save 25% with Return Load",
    desc: "Book a truck on its empty return trip and pay up to 30% less.",
    code: "RETURN25",
    tone: "savings",
    icon: "return",
  },
  {
    id: "o2",
    title: "Share Truck & Save 20%",
    desc: "Split a truck by weight — pay only for the space you use.",
    code: "SHARE20",
    tone: "cyan",
    icon: "share",
  },
  {
    id: "o3",
    title: "₹200 off your first load",
    desc: "New to LoadMitra? First booking gets an instant ₹200 off.",
    code: "FIRST200",
    tone: "primary",
    icon: "first",
  },
  {
    id: "o4",
    title: "Refer & earn ₹300",
    desc: "Invite a business — you both earn ₹300 in LoadMitra credits.",
    code: "REFER300",
    tone: "success",
    icon: "refer",
  },
];

/** Build a finished Booking for the seeded history list. */
function historyBooking(
  id: string,
  mode: Booking["mode"],
  pickup: Place,
  drop: Place,
  truckTypeId: string,
  loadWeightKg: number,
  goodsType: string,
  status: Booking["status"],
  createdLabel: string,
): Booking {
  const truck = truckById(truckTypeId)!;
  const distanceKm = estimateDistanceKm(pickup.city, drop.city);
  const price = estimatePrice({ truck, distanceKm, mode, loadWeightKg });
  return {
    id,
    mode,
    pickup,
    drop,
    truckTypeId,
    truckTypeName: truck.name,
    loadWeightKg,
    goodsType,
    price,
    agreedPrice: price.estimate,
    status,
    captain: captainForTruck(truckTypeId),
    createdLabel,
  };
}

export const SAMPLE_BOOKINGS: Booking[] = [
  historyBooking(
    "LM-7F3A21",
    "return",
    PLACE_DIRECTORY[5], // Whitefield, Bengaluru
    SAVED_PLACES[1], // Work
    "tata407",
    1800,
    "Electronics",
    "delivered",
    "12 Jun, 4:10 PM",
  ),
  historyBooking(
    "LM-6B12C9",
    "shared",
    SAVED_PLACES[0], // Home
    RECENT_PLACES[0], // Kompally
    "ace",
    300,
    "Furniture",
    "delivered",
    "08 Jun, 11:25 AM",
  ),
  historyBooking(
    "LM-5A90E4",
    "full",
    RECENT_PLACES[2], // Gachibowli
    PLACE_DIRECTORY[7], // Vijayawada
    "truck14",
    3200,
    "Textiles",
    "cancelled",
    "02 Jun, 9:00 AM",
  ),
];

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
