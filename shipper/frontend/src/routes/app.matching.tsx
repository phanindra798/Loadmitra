import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radar, X, CheckCircle2, ArrowRight, Truck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CaptainCard } from "@/components/app/captain-card";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/features/shipper/booking-context";
import { captainForTruck } from "@/features/shipper/mock-data";
import { shipperApi } from "@/lib/api";
import { inr } from "@/features/shipper/pricing";
import { MODE_I18N } from "@/features/shipper/mode-meta";
import { useT } from "@/features/shipper/i18n";

export const Route = createFileRoute("/app/matching")({
  validateSearch: (search: Record<string, unknown>) => ({ id: String(search.id ?? "") }),
  component: MatchingPage,
});

function MatchingPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const { getBooking, assignCaptain, updateStatus } = useBooking();
  const booking = getBooking(id);
  const [phase, setPhase] = useState<"searching" | "found">("searching");

  // Wait for a real captain to accept on the server, then show that captain.
  // Polls GET /api/bookings/:id. If the API is unreachable (standalone/offline
  // demo), fall back to a placeholder match after a few failed polls so the flow
  // never dead-ends.
  useEffect(() => {
    if (!booking || phase === "found") return;
    let cancelled = false;
    let fails = 0;
    let ticks = 0;
    let timer: ReturnType<typeof setTimeout>;

    const found = (captain: Parameters<typeof assignCaptain>[1]) => {
      if (cancelled) return;
      assignCaptain(booking.id, captain);
      updateStatus(booking.id, "accepted");
      setPhase("found");
    };

    const tick = async () => {
      ticks += 1;
      try {
        const r = await shipperApi.getBooking(booking.id);
        if (cancelled) return;
        fails = 0;
        // Accepted on the server → show the real captain (placeholder only if the
        // captain snapshot somehow didn't persist).
        if (r.status === "accepted") {
          found(r.captain ?? captainForTruck(booking.truckTypeId));
          return;
        }
      } catch {
        fails += 1;
        if (fails >= 3) {
          found(captainForTruck(booking.truckTypeId)); // API unreachable — placeholder
          return;
        }
      }
      // Safety net: if no captain accepts *this* load in ~20s, match a
      // placeholder so the shipper is never stranded on the searching screen.
      if (ticks >= 8) {
        found(captainForTruck(booking.truckTypeId));
        return;
      }
      if (!cancelled) timer = setTimeout(tick, 2500);
    };

    timer = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, phase]);

  if (!booking) {
    return (
      <div className="mx-auto min-h-[100dvh] w-full max-w-2xl">
        <PageHeader title={t("matching.findingTitle")} />
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <Truck className="h-8 w-8 text-muted-foreground" />
          <p className="font-semibold text-foreground">{t("matching.noBooking")}</p>
          <Link to="/app">
            <Button className="rounded-xl">{t("common.goHome")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  function cancel() {
    updateStatus(booking!.id, "cancelled");
    navigate({ to: "/app" });
  }

  function confirm() {
    updateStatus(booking!.id, "enroute_pickup");
    navigate({ to: "/app/track/$id", params: { id: booking!.id } });
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-28 lg:pb-10">
      <PageHeader title={phase === "searching" ? t("matching.findingTitle") : t("matching.foundTitle")} />

      <div className="px-4 pt-6 sm:px-6">
        {/* Route summary */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{booking.pickup.label}</span>
          </div>
          <div className="ml-[5px] h-4 border-l-2 border-dashed border-border" />
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--savings)" }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{booking.drop.label}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3 text-xs">
            <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-foreground">{t(MODE_I18N[booking.mode].label)}</span>
            <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-foreground">{booking.truckTypeName}</span>
            <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-foreground">{booking.price.distanceKm} km</span>
            <span className="ml-auto font-extrabold text-foreground">{inr(booking.agreedPrice ?? booking.price.estimate)}</span>
          </div>
        </div>

        {phase === "searching" ? (
          <div className="flex flex-col items-center py-8 text-center">
            {/* Radar */}
            <div className="relative grid h-48 w-48 place-items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="lm-ping absolute inset-0 rounded-full border border-primary/40"
                  style={{ animation: `lm-ping-ring 2.4s ease-out ${i * 0.8}s infinite` }}
                />
              ))}
              <div
                className="lm-radar absolute inset-0 rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--primary) 35%, transparent) 60deg, transparent 70deg)",
                  animation: "lm-radar-sweep 2.2s linear infinite",
                }}
              />
              <span className="relative grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Radar className="h-7 w-7" />
              </span>
            </div>
            <h2 className="mt-6 text-lg font-bold text-foreground">{t("matching.searching")}</h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("matching.searchingHint")}</p>
            <button
              onClick={cancel}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" /> {t("matching.cancelRequest")}
            </button>
          </div>
        ) : (
          <div className="lm-anim-fade-in space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 p-3 text-sm font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" /> {t("matching.accepted")}
            </div>
            {booking.captain && <CaptainCard captain={booking.captain} />}
            <Button onClick={confirm} className="h-12 w-full rounded-xl text-base">
              {t("matching.confirmTrack")} <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              onClick={cancel}
              className="block w-full text-center text-sm font-semibold text-muted-foreground hover:text-destructive"
            >
              {t("matching.cancelBooking")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
