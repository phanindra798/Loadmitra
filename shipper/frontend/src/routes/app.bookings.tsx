import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Package, ChevronRight, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { BookingDetailsDialog } from "@/components/app/booking-details-dialog";
import { useT, type Translate } from "@/features/shipper/i18n";
import { useBooking } from "@/features/shipper/booking-context";
import { MODE_META, MODE_I18N } from "@/features/shipper/mode-meta";
import { inr } from "@/features/shipper/pricing";
import type { Booking, BookingStatus } from "@/features/shipper/types";

export const Route = createFileRoute("/app/bookings")({
  component: BookingsPage,
});

type Filter = "all" | "active" | "completed" | "cancelled";

const ACTIVE = new Set<BookingStatus>([
  "requested",
  "accepted",
  "enroute_pickup",
  "at_pickup",
  "picked",
  "enroute_drop",
]);

function statusMeta(s: BookingStatus, t: Translate): { label: string; cls: string } {
  if (s === "delivered") return { label: t("status.delivered"), cls: "bg-success/15 text-success" };
  if (s === "cancelled") return { label: t("status.cancelled"), cls: "bg-destructive/15 text-destructive" };
  if (s === "requested" || s === "accepted")
    return { label: t("status.confirmed"), cls: "bg-primary/15 text-primary" };
  return { label: t("status.onTheWay"), cls: "bg-cyan-accent/15 text-cyan-accent" };
}

function BookingsPage() {
  const navigate = useNavigate();
  const t = useT();
  const { bookings, authenticated, historyLoading, historyError, refreshBookings, hasMoreBookings, loadMoreBookings, getBooking } = useBooking();
  const [filter, setFilter] = useState<Filter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? getBooking(detailId) ?? null : null;

  const filtered = bookings.filter((b) => {
    if (filter === "active") return ACTIVE.has(b.status);
    if (filter === "completed") return b.status === "delivered";
    if (filter === "cancelled") return b.status === "cancelled";
    return true;
  });

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: t("bookings.all") },
    { id: "active", label: t("bookings.active") },
    { id: "completed", label: t("bookings.completed") },
    { id: "cancelled", label: t("bookings.cancelled") },
  ];

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-4xl pb-28 lg:pb-10">
      <PageHeader title={t("bookings.title")} subtitle={t("bookings.count", { n: bookings.length })} back={false} />

      <div className="px-4 pt-4 sm:px-6">
        {!authenticated && <p className="mb-4">Please <Link className="text-primary underline" to="/login">sign in</Link> to see your bookings.</p>}
        {authenticated && <Button variant="outline" className="mb-4" onClick={() => void refreshBookings()} disabled={historyLoading}>Refresh bookings</Button>}
        {historyLoading && <p role="status" className="mb-4 text-sm">Loading your bookings…</p>}
        {historyError && <p role="alert" className="mb-4 text-sm text-destructive">{historyError}. Use Refresh bookings to retry.</p>}
        {/* Filter tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lm-no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={[
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                filter === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          authenticated && !historyLoading && !historyError && (hasMoreBookings
            ? <p className="py-8 text-center text-muted-foreground">No matching bookings loaded. Check older bookings below.</p>
            : <EmptyState />)
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="space-y-3 lg:hidden">
              {filtered.map((b) => (
                <BookingCard key={b.id} booking={b} onOpen={() => setDetailId(b.id)} />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-2xl border border-border lg:block">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t("bookings.route")}</th>
                    <th className="px-4 py-3 font-semibold">{t("bookings.mode")}</th>
                    <th className="px-4 py-3 font-semibold">{t("bookings.truck")}</th>
                    <th className="px-4 py-3 font-semibold">{t("bookings.date")}</th>
                    <th className="px-4 py-3 font-semibold">{t("bookings.status")}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t("bookings.price")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((b) => {
                    const sm = statusMeta(b.status, t);
                    return (
                      <tr key={b.id} className="hover:bg-secondary/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{b.pickup.label}</p>
                          <p className="text-xs text-muted-foreground">→ {b.drop.label}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{t(MODE_I18N[b.mode].label)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.truckTypeName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.createdLabel}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sm.cls}`}>
                            {sm.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                          {inr(b.agreedPrice ?? b.price.estimate)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDetailId(b.id)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                          >
                            {t("bookings.viewDetails")} <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {hasMoreBookings && <Button variant="outline" className="mt-4 w-full" disabled={historyLoading} onClick={() => void loadMoreBookings()}>Load older bookings</Button>}
      </div>

      <BookingDetailsDialog
        booking={detail}
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
        onTrack={(id) => navigate({ to: "/app/track/$id", params: { id } })}
      />
    </div>
  );
}

function BookingCard({ booking: b, onOpen }: { booking: Booking; onOpen: () => void }) {
  const t = useT();
  const meta = MODE_META[b.mode];
  const Icon = meta.icon;
  const sm = statusMeta(b.status, t);
  return (
    <button
      onClick={onOpen}
      className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" /> {t(MODE_I18N[b.mode].label)}
        </span>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sm.cls}`}>{sm.label}</span>
      </div>

      <div className="mt-3 flex items-stretch gap-3">
        <div className="flex flex-col items-center pt-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
          <span className="my-0.5 w-px flex-1 border-l-2 border-dashed border-border" />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--savings)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{b.pickup.label}</p>
          <p className="mt-3 truncate text-sm font-semibold text-foreground">{b.drop.label}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {b.truckTypeName} · {b.createdLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-extrabold text-foreground">{inr(b.agreedPrice ?? b.price.estimate)}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </span>
      </div>
    </button>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
        <Package className="h-7 w-7" />
      </span>
      <p className="font-bold text-foreground">{t("bookings.empty")}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{t("bookings.emptyHint")}</p>
      <Link to="/app/search">
        <Button className="mt-1 rounded-xl">{t("bookings.bookTruck")}</Button>
      </Link>
    </div>
  );
}
