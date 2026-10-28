import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Wallet, Gift, Truck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useCaptain } from "@/features/captain/captain-context";
import { inr } from "@/features/captain/earnings";
import { MODE_META, TONE_VAR } from "@/features/captain/mode-meta";

export const Route = createFileRoute("/app/earnings")({ component: EarningsPage });
type Period = "today" | "week" | "month";

function EarningsPage() {
  const { authenticated, earnings, earningsLoading, earningsError, refreshEarnings } = useCaptain();
  const [period, setPeriod] = useState<Period>("today");
  const weekly = earnings.weekly ?? [];
  const maxBar = Math.max(1, ...weekly.map(day => day.net));
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-28 lg:pb-10">
      <PageHeader title="Earnings" subtitle="Completed-trip estimates · India time (IST)" back={false} />
      <div className="space-y-5 px-4 pt-4 sm:px-6">
        {!authenticated ? <p><Link to="/login" className="font-semibold underline">Sign in</Link> to view your earnings.</p>
          : earningsLoading ? <p role="status">Loading completed-trip estimates…</p>
          : earningsError ? <div role="alert" className="rounded-xl border border-destructive/30 p-4">
            <p>Could not load earnings. {earningsError}</p>
            <button type="button" className="mt-2 font-semibold underline" onClick={refreshEarnings}>Retry earnings</button>
          </div> : <>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex gap-1.5 rounded-2xl bg-secondary p-1.5">
                {(["today", "week", "month"] as Period[]).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}
                  className={`h-9 flex-1 rounded-xl text-sm font-semibold ${period === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                  {value === "today" ? "Today" : value === "week" ? "This week" : "This month"}
                </button>)}
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Estimated net</p>
              <p data-testid="earnings-total" className="mt-1 text-4xl font-extrabold tabular-nums">{inr(earnings[period])}</p>
              <p className="mt-2 text-xs text-muted-foreground">Based on verified deliveries. Payment collection or settlement is not recorded.</p>
              <h2 className="mt-5 text-xs font-semibold text-muted-foreground">This week · Monday–Sunday (IST)</h2>
              <div className="mt-3 flex h-28 items-end justify-between gap-2" aria-label="Daily estimates this week">
                {weekly.map(day => <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5" aria-label={`${day.day}: ${inr(day.net)} estimated`}>
                  <div className="w-full rounded-t-md bg-primary" title={`${day.date}: ${inr(day.net)}`} style={{ height: `${(day.net / maxBar) * 88}px` }} />
                  <span className="text-[10px] text-muted-foreground">{day.day}</span>
                </div>)}
              </div>
              {weekly.every(day => day.net === 0) && <p className="mt-2 text-xs text-muted-foreground">No recorded delivery estimates this week.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4"><Truck className="h-5 w-5 text-primary" /><p className="mt-2 font-bold">{earnings.tripsToday}</p><p className="text-xs text-muted-foreground">Deliveries today</p></div>
              <div className="rounded-2xl border border-border bg-card p-4"><Gift className="h-5 w-5 text-primary" /><p className="mt-2 font-bold">{inr(earnings.incentiveThisWeek)}</p><p className="text-xs text-muted-foreground">Estimated incentives this week</p></div>
            </div>
            {(earnings.unknownCompletionTrips ?? 0) > 0 && <p role="note" className="rounded-xl border border-border p-3 text-sm">
              {earnings.unknownCompletionTrips} older completed trip(s) lack a recorded completion date or payout snapshot and are excluded from period totals. No dates have been guessed.
            </p>}
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent completed trips · latest 20</h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {earnings.ledger.map(entry => {
                  const meta = MODE_META[entry.mode];
                  return <Link key={entry.id} to="/app/trip/$id" params={{ id: entry.id }} className="flex items-center gap-3 border-b border-border p-3.5 last:border-0">
                    <meta.icon className="h-5 w-5 shrink-0" style={{ color: TONE_VAR[meta.tone] }} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.label}</p><p className="text-xs text-muted-foreground">{entry.dateLabel} · {meta.short}</p>
                      {entry.legacyEstimate && <p className="text-xs text-muted-foreground">Legacy estimate using current payout rules</p>}
                    </div><span className="text-sm font-bold">{inr(entry.net)}</span>
                  </Link>;
                })}
                {earnings.ledger.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No completed trips yet.</p>}
              </div>
            </section>
            <button type="button" className="text-sm font-semibold underline" onClick={refreshEarnings}>Refresh earnings</button>
            <p className="text-xs text-muted-foreground">Online hours and offer acceptance rate are not tracked yet. These estimates are not a payment balance.</p>
          </>}
      </div>
    </div>
  );
}
