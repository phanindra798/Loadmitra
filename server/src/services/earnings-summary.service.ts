import { Booking } from "../models/booking.model";
import { captainPayout } from "./earnings.service";
import type { EarningsSummary, LoadMode, Payout } from "../types";

export const EARNINGS_TIME_ZONE = "Asia/Kolkata";
const DAY = 86400000;
const IST_OFFSET = 330 * 60000;
const dayKey = (value: number) => new Date(value).toISOString().slice(0, 10);

/** Calendar periods in the product's Indian timezone, independent of server TZ. */
export function earningsWindow(now: Date) {
  const local = new Date(now.getTime() + IST_OFFSET);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const monday = today - ((local.getUTCDay() + 6) % 7) * DAY;
  const month = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  return { today: dayKey(today), week: dayKey(monday), month: dayKey(month),
    since: new Date(Math.min(monday, month) - IST_OFFSET),
    weekly: Array.from({ length: 7 }, (_, i) => ({ date: dayKey(monday + i * DAY), day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], net: 0 })),
  };
}

interface DailyTotal { _id: string; net: number; incentive: number; trips: number }
interface LedgerRecord {
  bookingId: string; mode: LoadMode; agreedPrice: number; distanceKm: number;
  pickup: { label: string }; drop: { label: string }; completedAt?: Date; payoutSnapshot?: Payout;
}

/** One owner-scoped database pass; daily groups and recent ledger output are bounded. */
export async function getEarningsSummary(captainId: string, now = new Date()): Promise<EarningsSummary> {
  const window = earningsWindow(now);
  const recorded = { completedAt: { $type: "date" }, "payoutSnapshot.net": { $type: "number" }, "payoutSnapshot.incentive": { $type: "number" } };
  const [result] = await Booking.aggregate<{
    days: DailyTotal[]; ledger: LedgerRecord[]; unknown: { count: number }[];
  }>([
    { $match: { acceptedByCaptainId: captainId, status: "accepted", tripStatus: "delivered" } },
    { $sort: { completedAt: -1, _id: -1 } },
    { $project: { bookingId: 1, mode: 1, agreedPrice: 1, distanceKm: 1, pickup: 1, drop: 1, completedAt: 1, payoutSnapshot: 1 } },
    { $facet: {
      days: [
        { $match: { ...recorded, completedAt: { $type: "date", $gte: window.since, $lte: now } } },
        { $group: { _id: { $dateToString: { date: "$completedAt", format: "%Y-%m-%d", timezone: EARNINGS_TIME_ZONE } },
          net: { $sum: "$payoutSnapshot.net" }, incentive: { $sum: "$payoutSnapshot.incentive" }, trips: { $sum: 1 } } },
      ],
      ledger: [{ $limit: 20 }],
      unknown: [{ $match: { $nor: [recorded] } }, { $count: "count" }],
    } },
  ]).option({ maxTimeMS: 5000 });
  const days = result?.days ?? [];
  const sum = (from: string, field: "net" | "incentive" | "trips") => days.reduce((total, row) => total + (row._id >= from ? row[field] : 0), 0);
  const daily = new Map(days.map(row => [row._id, row.net]));
  return {
    today: sum(window.today, "net"), week: sum(window.week, "net"), month: sum(window.month, "net"),
    tripsToday: sum(window.today, "trips"), incentiveThisWeek: sum(window.week, "incentive"),
    onlineHoursToday: null, acceptanceRate: null, timeZone: EARNINGS_TIME_ZONE,
    weekly: window.weekly.map(day => ({ ...day, net: daily.get(day.date) ?? 0 })),
    unknownCompletionTrips: result?.unknown[0]?.count ?? 0,
    ledger: (result?.ledger ?? []).map(row => {
      const payout = row.payoutSnapshot ?? captainPayout(row.agreedPrice, row.mode, row.distanceKm);
      return { id: row.bookingId, label: `${row.pickup.label} → ${row.drop.label}`, mode: row.mode,
        net: payout.net, legacyEstimate: !row.payoutSnapshot,
        dateLabel: row.completedAt instanceof Date ? row.completedAt.toLocaleString("en-IN", {
          timeZone: EARNINGS_TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        }) : "Completion date not recorded" };
    }),
  };
}
