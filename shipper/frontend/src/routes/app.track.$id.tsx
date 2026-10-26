import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ShieldAlert,
  Share2,
  Truck,
  CheckCircle2,
  Leaf,
} from "lucide-react";
import { MapCanvas } from "@/components/app/map-canvas";
import { CaptainCard } from "@/components/app/captain-card";
import { HandoverCode } from "@/components/app/handover-code";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useBooking } from "@/features/shipper/booking-context";
import { shipperApi } from "@/lib/api";
import { inr } from "@/features/shipper/pricing";
import { useT, type Translate } from "@/features/shipper/i18n";
import type { BookingStatus } from "@/features/shipper/types";

export const Route = createFileRoute("/app/track/$id")({
  component: TrackPage,
});

// Lifecycle order — used so the shipper only ever advances forward when it
// mirrors the captain's status (never jumps backward on a slow poll).
const ORDER: BookingStatus[] = [
  "requested",
  "accepted",
  "enroute_pickup",
  "at_pickup",
  "picked",
  "enroute_drop",
  "delivered",
];
const rank = (s: BookingStatus) => ORDER.indexOf(s);

function headline(status: BookingStatus, etaMins: number, t: Translate) {
  switch (status) {
    case "at_pickup":
      return { title: t("track.atPickupTitle"), sub: t("track.atPickupSub") };
    case "picked":
      return { title: t("track.pickedTitle"), sub: t("track.pickedSub") };
    case "enroute_drop":
      return { title: t("track.enrouteDropTitle", { min: etaMins }), sub: t("track.enrouteDropSub") };
    case "delivered":
      return { title: t("track.deliveredTitle"), sub: t("track.deliveredSub") };
    case "cancelled":
      return { title: t("track.cancelledTitle"), sub: "" };
    default:
      return { title: t("track.arrivingPickup", { min: etaMins }), sub: t("track.arrivingPickupSub") };
  }
}

function TrackPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const t = useT();
  const { getBooking, updateStatus } = useBooking();
  const booking = getBooking(id);
  const [pollError, setPollError] = useState<string | null>(null);
  const [sos, setSos] = useState(false);
  const [deliveredPopup, setDeliveredPopup] = useState(false);

  const status = booking?.status;

  // Latest status without re-arming the poll loop on every change.
  const statusRef = useRef(status);
  statusRef.current = status;

  // Mirror the captain's live status from the server. Forward-only, so the
  // shipper sees each step (incl. "delivered") exactly when the captain does it.
  // Preserve the last known state on connection failures and display an error.
  const bid = booking?.id;
  useEffect(() => {
    if (!bid) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const loop = async () => {
      const cur = statusRef.current;
      if (cancelled || !cur || cur === "delivered" || cur === "cancelled") return;
      try {
        const r = await shipperApi.getBooking(bid);
        if (cancelled) return;
        setPollError(null);
        const next = r.tripStatus as BookingStatus | null;
        if (next === "cancelled") updateStatus(bid, "cancelled");
        else if (next && rank(next) > rank(cur)) updateStatus(bid, next); // advance to captain's step
      } catch (error) {
        if (cancelled) return;
        setPollError(error instanceof Error ? error.message : "Tracking temporarily unavailable");
      }
      if (!cancelled) timer = setTimeout(loop, 3000);
    };

    timer = setTimeout(loop, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bid, updateStatus]);

  // Pop a celebratory dialog the moment the trip *becomes* delivered while the
  // user is watching (not when reopening a trip that was already delivered).
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== "delivered" && status === "delivered") {
      setDeliveredPopup(true);
    }
    prevStatus.current = status;
  }, [status]);

  if (!booking) {
    return (
      <div className="mx-auto min-h-[100dvh] w-full max-w-2xl">
        <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
          <Truck className="h-8 w-8 text-muted-foreground" />
          <p className="font-semibold text-foreground">{t("track.tripNotFound")}</p>
          <Link to="/app">
            <Button className="rounded-xl">{t("common.goHome")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const eta =
    booking.status === "enroute_drop"
      ? Math.max(3, Math.round((booking.price.distanceKm / 45) * 6))
      : (booking.captain?.etaMins ?? 8);
  const h = headline(booking.status, eta, t);
  const delivered = booking.status === "delivered";
  const handoverStage = booking.status === "at_pickup" ? "picked"
    : booking.status === "enroute_drop" ? "delivered" : null;

  function shareTrip() {
    const text = `Track my LoadMitra shipment ${booking!.id}: ${booking!.pickup.label} → ${booking!.drop.label}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "LoadMitra trip", text }).catch(() => {});
    } else {
      setSos(false);
      alert(text);
    }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden lg:h-screen">
      <MapCanvas variant="live" className="absolute inset-0 h-full w-full" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-3 pt-3 sm:px-4">
        <button
          onClick={() => navigate({ to: "/app" })}
          aria-label="Back to home"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-sm backdrop-blur hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-bold text-foreground shadow-sm backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-cyan-accent" style={{ animation: "lm-pulse-dot 1.4s ease-in-out infinite" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-accent" />
          </span>
          {t("track.live")} · {booking.id}
        </span>
      </div>

      {/* Tracking sheet */}
      <div className="absolute inset-x-0 bottom-16 z-20 px-2 sm:px-4 lg:inset-auto lg:bottom-6 lg:right-6 lg:top-6 lg:w-[400px] lg:px-0">
        <div className="mx-auto max-h-[78vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl lm-no-scrollbar lg:max-h-[calc(100vh-3rem)]">
          {pollError && <p role="alert" className="mb-3 text-sm text-destructive">{pollError}. Retrying…</p>}
          {/* Headline */}
          <div className="flex items-center gap-3">
            <span
              className={[
                "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                delivered ? "bg-success/15 text-success" : "bg-primary/15 text-primary",
              ].join(" ")}
            >
              {delivered ? <CheckCircle2 className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold tracking-tight text-foreground">{h.title}</p>
              {h.sub && <p className="truncate text-sm text-muted-foreground">{h.sub}</p>}
            </div>
          </div>

          {/* Captain */}
          {booking.captain && <div className="mt-3"><CaptainCard captain={booking.captain} /></div>}

          {/* OTP */}
          {handoverStage && <HandoverCode key={`${booking.id}:${handoverStage}`} bookingId={booking.id} stage={handoverStage} />}

          {/* Delivered summary */}
          {delivered && (
            <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("track.agreedPrice")}</span>
                <span className="font-extrabold text-foreground">{inr(booking.agreedPrice ?? booking.price.estimate)}</span>
              </div>
              {booking.price.co2SavedKg > 0 && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><Leaf className="h-3.5 w-3.5 text-success" /> {t("track.co2Saved")}</span>
                  <span className="font-semibold text-foreground">{booking.price.co2SavedKg} kg</span>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="mt-4">
            <StatusTimeline status={booking.status} />
          </div>

          {/* Actions */}
          {!delivered ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setSos((v) => !v)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-bold text-destructive hover:bg-destructive/15"
              >
                <ShieldAlert className="h-4 w-4" /> {t("track.sos")}
              </button>
              <button
                onClick={shareTrip}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-bold text-foreground hover:bg-secondary"
              >
                <Share2 className="h-4 w-4" /> {t("track.shareTrip")}
              </button>
              {sos && (
                <p className="col-span-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {t("track.sosNote")}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to="/app/bookings" className="col-span-1">
                <Button variant="outline" className="h-11 w-full rounded-xl">{t("track.viewBookings")}</Button>
              </Link>
              <Link to="/app" className="col-span-1">
                <Button className="h-11 w-full rounded-xl">{t("track.bookAgain")}</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Delivered celebration popup */}
      <Dialog open={deliveredPopup} onOpenChange={setDeliveredPopup}>
        <DialogContent className="max-w-sm rounded-2xl text-center">
          <DialogHeader className="items-center text-center sm:text-center">
            <span className="mx-auto mb-1 grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <DialogTitle className="text-xl">{t("track.deliveredTitle")}</DialogTitle>
            <DialogDescription>{t("track.deliveredPopupSub", { place: booking.drop.label })}</DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("track.amount")}</span>
              <span className="font-extrabold text-foreground">{inr(booking.agreedPrice ?? booking.price.estimate)}</span>
            </div>
            {booking.price.co2SavedKg > 0 && (
              <div className="mt-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Leaf className="h-3.5 w-3.5 text-success" /> {t("track.co2Saved")}
                </span>
                <span className="font-semibold text-foreground">{booking.price.co2SavedKg} kg</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link to="/app/bookings">
              <Button variant="outline" className="h-11 w-full rounded-xl">{t("track.viewBookings")}</Button>
            </Link>
            <Link to="/app">
              <Button className="h-11 w-full rounded-xl">{t("track.bookAgain")}</Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
