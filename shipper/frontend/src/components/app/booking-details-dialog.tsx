import { Navigation2, Package, Leaf, Repeat, Boxes } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CaptainCard } from "@/components/app/captain-card";
import { StatusTimeline } from "@/components/app/status-timeline";
import { MODE_META, MODE_I18N } from "@/features/shipper/mode-meta";
import { inr } from "@/features/shipper/pricing";
import { useT, type Translate } from "@/features/shipper/i18n";
import type { Booking, BookingStatus } from "@/features/shipper/types";

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
  if (s === "requested" || s === "accepted") return { label: t("status.confirmed"), cls: "bg-primary/15 text-primary" };
  return { label: t("status.onTheWay"), cls: "bg-cyan-accent/15 text-cyan-accent" };
}

export function BookingDetailsDialog({
  booking,
  open,
  onOpenChange,
  onTrack,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTrack: (id: string) => void;
}) {
  const t = useT();
  if (!booking) return null;
  const b = booking;
  const Icon = MODE_META[b.mode].icon;
  const sm = statusMeta(b.status, t);
  const p = b.price;
  const isActive = ACTIVE.has(b.status);
  const total = b.agreedPrice ?? p.estimate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0">
        <div className="max-h-[85vh] overflow-y-auto lm-no-scrollbar">
          {/* Header */}
          <DialogHeader className="space-y-1 border-b border-border p-5 pr-10 text-left">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Icon className="h-5 w-5 text-primary" /> {t(MODE_I18N[b.mode].label)}
              </DialogTitle>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sm.cls}`}>{sm.label}</span>
            </div>
            <DialogDescription>
              {t("details.bookingMeta", { id: b.id, created: b.createdLabel })}
              {b.scheduledLabel ? ` · ${b.scheduledLabel}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5">
            {/* Route */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-stretch gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
                  <span className="my-0.5 w-px flex-1 border-l-2 border-dashed border-border" />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--savings)" }} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("details.pickup")}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{b.pickup.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.pickup.address}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("details.drop")}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{b.drop.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.drop.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipment facts */}
            <div className="grid grid-cols-3 gap-2">
              <Fact icon={Package} label={t("bookings.truck")} value={b.truckTypeName} />
              <Fact icon={Navigation2} label={t("details.distance")} value={`${p.distanceKm} km`} />
              <Fact icon={Boxes} label={t("details.load")} value={`${b.loadWeightKg} kg`} />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">{t("details.goods", { goods: b.goodsType })}</p>

            {/* Captain */}
            {b.captain && <CaptainCard captain={b.captain} showActions={isActive} />}

            {/* Price breakdown */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("details.priceBreakdown")}
              </p>
              <Row label={t("details.baseFare")} value={inr(p.base)} />
              <Row label={t("details.distanceRow", { km: p.distanceKm })} value={inr(p.distanceCharge)} />
              {p.discountPct > 0 && (
                <Row
                  label={t("details.discountRow", { pct: Math.round(p.discountPct * 100) })}
                  value={`− ${inr(p.discount)}`}
                  tone="savings"
                />
              )}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">
                  {b.agreedPrice ? t("details.agreedPrice") : t("details.estimatedTotal")}
                </span>
                <span className="text-lg font-extrabold text-foreground">{inr(total)}</span>
              </div>
              <p className="mt-0.5 text-right text-[11px] text-muted-foreground">
                {t("details.perTonne", { price: inr(p.ratePerKm) })}
              </p>

              {(p.savings > 0 || p.co2SavedKg > 0) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-dashed border-border pt-3">
                  {p.savings > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-savings/10 px-2.5 py-1 text-xs font-semibold text-savings">
                      <Repeat className="h-3.5 w-3.5" /> {t("details.youSaved", { amount: inr(p.savings) })}
                    </span>
                  )}
                  {p.co2SavedKg > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                      <Leaf className="h-3.5 w-3.5" /> {t("details.co2Saved", { kg: p.co2SavedKg })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("details.tripStatus")}</p>
              <StatusTimeline status={b.status} />
            </div>
          </div>

          {/* Footer actions */}
          <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background p-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
            {isActive && (
              <Button
                className="flex-1 rounded-xl"
                onClick={() => {
                  onOpenChange(false);
                  onTrack(b.id);
                }}
              >
                <Navigation2 className="h-4 w-4" /> {t("details.trackLive")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "savings" }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "savings" ? "font-semibold text-savings" : "font-semibold text-foreground"}>
        {value}
      </span>
    </div>
  );
}
