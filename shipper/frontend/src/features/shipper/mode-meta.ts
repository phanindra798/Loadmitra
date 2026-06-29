import { Repeat, Truck, Users, type LucideIcon } from "lucide-react";
import type { BookingMode } from "./types";
import type { TKey } from "./translations";

/** Translation keys for each mode's full + short label (English text lives in the catalog). */
export const MODE_I18N: Record<BookingMode, { label: TKey; short: TKey }> = {
  full: { label: "mode.full.label", short: "mode.full.short" },
  shared: { label: "mode.shared.label", short: "mode.shared.short" },
  return: { label: "mode.return.label", short: "mode.return.short" },
};

export type Tone = "primary" | "cyan" | "savings" | "success";

/** Maps a semantic tone to its CSS custom property (defined in styles.css). */
export const TONE_VAR: Record<Tone, string> = {
  primary: "var(--primary)",
  cyan: "var(--cyan-accent)",
  savings: "var(--savings)",
  success: "var(--success)",
};

export interface ModeMeta {
  id: BookingMode;
  label: string;
  short: string;
  desc: string;
  icon: LucideIcon;
  tone: Tone;
  badge?: string;
}

export const MODE_META: Record<BookingMode, ModeMeta> = {
  full: {
    id: "full",
    label: "Full Truck",
    short: "Full",
    desc: "Book the entire truck for your load",
    icon: Truck,
    tone: "primary",
  },
  shared: {
    id: "shared",
    label: "Shared Truck",
    short: "Shared",
    desc: "Pay only for the space you use",
    icon: Users,
    tone: "cyan",
    badge: "♻ Save 20%",
  },
  return: {
    id: "return",
    label: "Return Load",
    short: "Return",
    desc: "Ride a truck's empty return trip",
    icon: Repeat,
    tone: "savings",
    badge: "🔥 Save 25%",
  },
};

export const MODE_LIST: ModeMeta[] = [MODE_META.full, MODE_META.shared, MODE_META.return];
