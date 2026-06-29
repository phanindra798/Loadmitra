import { Link } from "@tanstack/react-router";
import { ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/features/captain/earnings";
import { MODE_META, TONE_VAR } from "@/features/captain/mode-meta";
import type { Trip } from "@/features/captain/types";

const ACTIVE = new Set(["accepted", "enroute_pickup", "at_pickup", "picked", "enroute_drop"]);

export function TripRow({ trip, className }: { trip: Trip; className?: string }) {
  const meta = MODE_META[trip.mode];
  const isActive = ACTIVE.has(trip.status);
  const cancelled = trip.status === "cancelled";

  return (
    <Link
      to="/app/trip/$id"
      params={{ id: trip.id }}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40",
        className,
      )}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
        style={{ background: `color-mix(in oklab, ${TONE_VAR[meta.tone]} 14%, transparent)` }}
      >
        <meta.icon className="h-5 w-5" style={{ color: TONE_VAR[meta.tone] }} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">
          {trip.pickup.city} → {trip.drop.city}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {trip.createdLabel} · {trip.distanceKm} km · {meta.short}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {cancelled ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
            Cancelled
          </span>
        ) : isActive ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            In progress
          </span>
        ) : (
          <>
            <p className="text-sm font-extrabold text-foreground">{inr(trip.payout.net)}</p>
            {trip.ratingGiven != null && (
              <p className="flex items-center justify-end gap-0.5 text-[11px] text-muted-foreground">
                <Star className="h-3 w-3 fill-current text-savings" /> {trip.ratingGiven}.0
              </p>
            )}
          </>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
