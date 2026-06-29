import { Info, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/features/captain/earnings";
import { MODE_META, TONE_VAR } from "@/features/captain/mode-meta";
import type { LoadMode, Payout } from "@/features/captain/types";

/**
 * Transparent earnings breakdown for a single load — what the captain keeps
 * after the platform commission, plus any return/shared incentive. Money is
 * settled offline in this version, so the net is a negotiable estimate.
 */
export function PayoutCard({
  payout,
  mode,
  className,
}: {
  payout: Payout;
  mode: LoadMode;
  className?: string;
}) {
  const meta = MODE_META[mode];

  const rows: { label: string; value: string; tone?: "muted" | "minus" | "plus" }[] = [
    { label: "Customer fare", value: inr(payout.fare) },
    {
      label: `Platform fee · ${Math.round(payout.commissionPct * 100)}%`,
      value: `− ${inr(payout.commission)}`,
      tone: "minus",
    },
  ];
  if (payout.incentive > 0) {
    rows.push({ label: "Return/shared bonus", value: `+ ${inr(payout.incentive)}`, tone: "plus" });
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> You earn
          </p>
          <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-foreground">
            {inr(payout.net)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {inr(payout.perKm)}/km · settled offline
          </p>
        </div>
        {meta.badge && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: TONE_VAR[meta.tone], color: "#0B1220" }}
          >
            {meta.badge}
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="min-w-0 truncate text-muted-foreground">{r.label}</dt>
            <dd
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                r.tone === "minus" && "text-destructive",
                r.tone === "plus" && "text-success",
                !r.tone && "text-foreground",
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      {payout.incentive > 0 && (
        <div className="mt-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ background: "color-mix(in oklab, var(--success) 18%, transparent)", color: "var(--success)" }}
          >
            <TrendingUp className="h-3.5 w-3.5" /> Bonus for filling an empty trip
          </span>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Estimate only — the final price is negotiable with the customer. No payment is collected in
        the app.
      </p>
    </div>
  );
}
