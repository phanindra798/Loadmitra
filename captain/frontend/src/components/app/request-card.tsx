import { Clock, MapPin, Package, Star, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/features/captain/earnings";
import { MODE_META, TONE_VAR } from "@/features/captain/mode-meta";
import { RouteLine } from "./route-line";
import type { LoadRequest } from "@/features/captain/types";

/**
 * An incoming job offer. The captain's whole decision lives on this card:
 * what they earn (big), where it goes, how far the pickup is, and who the
 * customer is. An optional countdown ring shows the offer expiring.
 */
export function RequestCard({
  request,
  onAccept,
  onDecline,
  secondsLeft,
  totalSeconds = 30,
  className,
}: {
  request: LoadRequest;
  onAccept?: () => void;
  onDecline?: () => void;
  secondsLeft?: number;
  totalSeconds?: number;
  className?: string;
}) {
  const meta = MODE_META[request.mode];
  const showTimer = secondsLeft != null;
  const pct = showTimer ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 1;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {/* Countdown bar */}
      {showTimer && (
        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct * 100}%`, background: pct < 0.3 ? "var(--destructive)" : "var(--primary)" }}
          />
        </div>
      )}

      <div className="p-4">
        {/* Header: mode + payout */}
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: `color-mix(in oklab, ${TONE_VAR[meta.tone]} 16%, transparent)`, color: TONE_VAR[meta.tone] }}
          >
            <meta.icon className="h-3.5 w-3.5" /> {meta.label}
          </span>
          <div className="text-right">
            <p className="text-2xl font-extrabold leading-none tracking-tight text-foreground">
              {inr(request.payout.net)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {inr(request.payout.perKm)}/km
            </p>
          </div>
        </div>

        {/* Route */}
        <RouteLine pickup={request.pickup} drop={request.drop} className="mt-3" />

        {/* Meta chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" /> {request.distanceKm} km
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" /> {request.etaToPickupMins} min to pickup
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-foreground">
            <Package className="h-3.5 w-3.5 text-primary" /> {request.loadWeightKg.toLocaleString("en-IN")} kg · {request.goodsType}
          </span>
        </div>

        {/* Customer */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{request.customerName}</span>
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3.5 w-3.5 fill-current text-savings" /> {request.customerRating}
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">{request.truckTypeName}</span>
        </div>

        {/* Actions */}
        {(onAccept || onDecline) && (
          <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
            <button
              type="button"
              onClick={onDecline}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" /> Skip
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm hover:brightness-110"
            >
              <Check className="h-4 w-4" /> Accept {showTimer && secondsLeft != null ? `· ${secondsLeft}s` : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
