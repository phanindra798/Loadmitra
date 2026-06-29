import { Repeat, Truck, Users, type LucideIcon } from "lucide-react";
import type { LoadMode } from "./types";

export type Tone = "primary" | "cyan" | "savings" | "success";

/** Maps a semantic tone to its CSS custom property (defined in styles.css). */
export const TONE_VAR: Record<Tone, string> = {
  primary: "var(--primary)",
  cyan: "var(--cyan-accent)",
  savings: "var(--savings)",
  success: "var(--success)",
};

export interface ModeMeta {
  id: LoadMode;
  label: string;
  short: string;
  desc: string; // captain-facing description
  icon: LucideIcon;
  tone: Tone;
  badge?: string;
}

/** Load modes as the captain sees them — framed around earning, not saving. */
export const MODE_META: Record<LoadMode, ModeMeta> = {
  full: {
    id: "full",
    label: "Full Load",
    short: "Full",
    desc: "Your truck, one customer's load — top fare",
    icon: Truck,
    tone: "primary",
  },
  shared: {
    id: "shared",
    label: "Shared Load",
    short: "Shared",
    desc: "Fill spare space with a second load",
    icon: Users,
    tone: "cyan",
    badge: "+ bonus",
  },
  return: {
    id: "return",
    label: "Return Load",
    short: "Return",
    desc: "Earn on your empty trip back home",
    icon: Repeat,
    tone: "savings",
    badge: "🔥 Top pick",
  },
};

export const MODE_LIST: ModeMeta[] = [MODE_META.full, MODE_META.shared, MODE_META.return];
