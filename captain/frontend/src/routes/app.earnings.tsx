import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Wallet, TrendingUp, Gift, Target, Truck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useCaptain } from "@/features/captain/captain-context";
import { inr } from "@/features/captain/earnings";
import { MODE_META, TONE_VAR } from "@/features/captain/mode-meta";

export const Route = createFileRoute("/app/earnings")({
  component: EarningsPage,
});

type Period = "today" | "week" | "month";

/** Animate a number from its previous value to the new target (eased). */
function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Illustrative daily split for the weekly bar chart (deterministic).
const WEEK_BARS = [
  { day: "Mon", v: 2100 },
  { day: "Tue", v: 3200 },
  { day: "Wed", v: 1800 },
  { day: "Thu", v: 3900 },
  { day: "Fri", v: 2600 },
  { day: "Sat", v: 3050 },
  { day: "Sun", v: 1800 },
];

function EarningsPage() {
  const { earnings, profile } = useCaptain();
  const [period, setPeriod] = useState<Period>("today");

  const isToday = period === "today";
  const rawAmount = earnings[period];
  const amount = useCountUp(rawAmount);
  const maxBar = Math.max(...WEEK_BARS.map((b) => b.v));

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-28 lg:pb-10">
      <PageHeader title="Earnings" subtitle={profile.vehicleNumber} back={false} />

      <div className="space-y-5 px-4 pt-4 sm:px-6">
        {/* Hero balance */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex gap-1.5 rounded-2xl bg-secondary p-1.5">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={[
                  "h-9 flex-1 rounded-xl text-sm font-semibold capitalize transition-all",
                  period === p ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
                ].join(" ")}
              >
                {p === "today" ? "Today" : p === "week" ? "This week" : "This month"}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" /> Net earnings
                {isToday && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-success"
                        style={{ animation: "lm-pulse-dot 1.4s ease-in-out infinite" }}
                      />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    LIVE
                  </span>
                )}
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums text-foreground">{inr(amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Settled offline · no money held in app</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
              <TrendingUp className="h-3.5 w-3.5" /> +12%
            </span>
          </div>

          {/* Weekly bar chart */}
          <div className="mt-5 flex h-28 items-end justify-between gap-2">
            {WEEK_BARS.map((b, i) => (
              <div key={b.day} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(8, (b.v / maxBar) * 88)}px`,
                    background: i === 3 ? "var(--primary)" : "color-mix(in oklab, var(--primary) 35%, transparent)",
                  }}
                />
                <span className="text-[10px] font-medium text-muted-foreground">{b.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={Truck} label="Trips today" value={earnings.tripsToday} format={(n) => String(n)} tone="primary" />
          <StatTile icon={Gift} label="Bonus / week" value={earnings.incentiveThisWeek} format={inr} tone="savings" />
          <StatTile icon={Target} label="Accept rate" value={Math.round(earnings.acceptanceRate * 100)} format={(n) => `${n}%`} tone="success" />
        </div>

        {/* Incentive banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-savings/30 bg-savings/10 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-savings/20 text-savings">
            <Gift className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">2 more return loads → ₹500 bonus</p>
            <p className="text-xs text-muted-foreground">Complete 5 return loads this week to unlock.</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: "60%", background: "var(--savings)" }} />
            </div>
          </div>
        </div>

        {/* Ledger */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent payouts
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {earnings.ledger.map((e, i) => {
              const meta = MODE_META[e.mode];
              return (
                <div
                  key={e.id}
                  className={[
                    "flex items-center gap-3 p-3.5",
                    i > 0 ? "border-t border-border" : "",
                  ].join(" ")}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${TONE_VAR[meta.tone]} 14%, transparent)` }}
                  >
                    <meta.icon className="h-4 w-4" style={{ color: TONE_VAR[meta.tone] }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{e.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.dateLabel} · {meta.short}</p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-success">+ {inr(e.net)}</span>
                </div>
              );
            })}
            {earnings.ledger.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No payouts yet.</p>
            )}
          </div>
        </section>

        <p className="pb-2 text-center text-[11px] text-muted-foreground">
          Earnings are estimates. Final amounts are negotiated with the customer and settled offline.
        </p>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  format,
  tone,
}: {
  icon: typeof Truck;
  label: string;
  value: number;
  format: (n: number) => string;
  tone: "primary" | "savings" | "success";
}) {
  const v = useCountUp(value);
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
      <span
        className="mx-auto grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: `color-mix(in oklab, ${TONE_VAR[tone]} 14%, transparent)`, color: TONE_VAR[tone] }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-base font-extrabold tracking-tight tabular-nums text-foreground">{format(v)}</p>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
