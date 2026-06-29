import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronLeft, Navigation, MapPin, KeyRound, ShieldAlert, CheckCircle2,
  Truck, Star, X, Wallet,
} from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { MapCanvas } from "@/components/app/map-canvas";
import { CustomerCard } from "@/components/app/customer-card";
import { StatusTimeline } from "@/components/app/status-timeline";
import { PayoutCard } from "@/components/app/payout-card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { useCaptain } from "@/features/captain/captain-context";
import { inr } from "@/features/captain/earnings";
import type { TripStatus } from "@/features/captain/types";

export const Route = createFileRoute("/app/trip/$id")({
  component: TripPage,
});

type Step =
  | { kind: "advance"; label: string; next: TripStatus; icon: typeof Navigation }
  | { kind: "otp"; label: string; otp: "pickup" | "drop"; next: TripStatus; complete?: boolean };

function stepFor(status: TripStatus): Step | null {
  switch (status) {
    case "accepted":
      return { kind: "advance", label: "Head to pickup", next: "enroute_pickup", icon: Navigation };
    case "enroute_pickup":
      return { kind: "advance", label: "I've arrived at pickup", next: "at_pickup", icon: MapPin };
    case "at_pickup":
      return { kind: "otp", label: "Verify pickup OTP & load", otp: "pickup", next: "picked" };
    case "picked":
      return { kind: "advance", label: "Start drive to drop", next: "enroute_drop", icon: Navigation };
    case "enroute_drop":
      return { kind: "otp", label: "Verify drop OTP & complete", otp: "drop", next: "delivered", complete: true };
    default:
      return null;
  }
}

function headline(status: TripStatus, etaMins: number) {
  switch (status) {
    case "accepted":
      return { title: "Load accepted 🎉", sub: "Head to the pickup point" };
    case "enroute_pickup":
      return { title: `Pickup in ~${etaMins} min`, sub: "Driving to pickup" };
    case "at_pickup":
      return { title: "At pickup", sub: "Collect the pickup OTP from the customer" };
    case "picked":
      return { title: "Loaded up", sub: "Start the drive to drop" };
    case "enroute_drop":
      return { title: "On the way to drop", sub: "Collect the drop OTP at delivery" };
    case "delivered":
      return { title: "Delivered 🎉", sub: "Nice work — payment settled offline" };
    case "cancelled":
      return { title: "Trip cancelled", sub: "" };
  }
}

function TripPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { getTrip, activeTrip, updateStatus, completeTrip, cancelTrip } = useCaptain();
  const trip = getTrip(id);

  const [otp, setOtp] = useState("");
  const [sos, setSos] = useState(false);
  const [rating, setRating] = useState(0);

  if (!trip) {
    return (
      <div className="mx-auto min-h-[100dvh] w-full max-w-2xl">
        <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
          <Truck className="h-8 w-8 text-muted-foreground" />
          <p className="font-semibold text-foreground">Trip not found</p>
          <Link to="/app">
            <Button className="rounded-xl">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isActive = activeTrip?.id === trip.id && trip.status !== "delivered" && trip.status !== "cancelled";
  const delivered = trip.status === "delivered";
  const etaMins = Math.max(4, Math.round((trip.distanceKm / 45) * 4));
  const h = headline(trip.status, etaMins);
  const step = isActive ? stepFor(trip.status) : null;

  function runStep() {
    if (!step) return;
    if (step.kind === "advance") {
      updateStatus(step.next);
    } else {
      if (otp.length !== 4) return;
      const code = otp;
      setOtp("");
      if (step.complete) completeTrip(undefined, code);
      else updateStatus(step.next, code);
    }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden lg:h-screen">
      <MapCanvas variant="live" className="absolute inset-0 h-full w-full" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-3 pt-3 sm:px-4">
        <button
          onClick={() => navigate({ to: "/app" })}
          aria-label="Back to dashboard"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-sm backdrop-blur hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-bold text-foreground shadow-sm backdrop-blur">
          {!delivered && trip.status !== "cancelled" && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-cyan-accent" style={{ animation: "lm-pulse-dot 1.4s ease-in-out infinite" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-accent" />
            </span>
          )}
          {trip.id}
        </span>
      </div>

      {/* Trip sheet */}
      <div className="absolute inset-x-0 bottom-16 z-20 px-2 sm:px-4 lg:inset-auto lg:bottom-6 lg:right-6 lg:top-6 lg:w-[420px] lg:px-0">
        <div className="mx-auto max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl lm-no-scrollbar lg:max-h-[calc(100vh-3rem)]">
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

          {/* Customer */}
          <div className="mt-3">
            <CustomerCard trip={trip} showActions={!delivered && trip.status !== "cancelled"} />
          </div>

          {/* Delivered earnings summary */}
          {delivered && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/20 text-success">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground">You earned</p>
                <p className="text-2xl font-extrabold tracking-tight text-foreground">{inr(trip.payout.net)}</p>
              </div>
            </div>
          )}

          {/* OTP entry */}
          {step?.kind === "otp" && (
            <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <KeyRound className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold text-muted-foreground">
                  {step.otp === "pickup"
                    ? "Ask the customer for the 4-digit pickup OTP"
                    : "Ask the customer for the 4-digit drop OTP"}
                </p>
              </div>
              <div className="mt-3 flex justify-center">
                <InputOTP maxLength={4} value={otp} onChange={setOtp} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric">
                  <InputOTPGroup className="gap-2.5">
                    {[0, 1, 2, 3].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-14 w-14 rounded-xl border border-border bg-background text-xl font-extrabold text-foreground shadow-sm"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">Demo: enter any 4 digits.</p>
            </div>
          )}

          {/* Timeline */}
          <div className="mt-4">
            <StatusTimeline status={trip.status} />
          </div>

          {/* Payout breakdown (active trips) */}
          {!delivered && trip.status !== "cancelled" && (
            <div className="mt-4">
              <PayoutCard payout={trip.payout} mode={trip.mode} />
            </div>
          )}

          {/* Primary action */}
          {step && (
            <Button
              onClick={runStep}
              disabled={step.kind === "otp" && otp.length !== 4}
              className="mt-4 h-12 w-full rounded-xl text-base"
            >
              {step.kind === "advance" && <step.icon className="h-4 w-4" />}
              {step.label}
            </Button>
          )}

          {/* Active secondary actions */}
          {isActive && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => setSos((v) => !v)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-bold text-destructive hover:bg-destructive/15"
              >
                <ShieldAlert className="h-4 w-4" /> SOS
              </button>
              <button
                onClick={() => {
                  cancelTrip();
                  navigate({ to: "/app" });
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              {sos && (
                <p className="col-span-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  Live location shared with LoadMitra safety team and your emergency contact.
                </p>
              )}
            </div>
          )}

          {/* Delivered: rate the customer + next */}
          {delivered && (
            <div className="mt-4">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rate the customer
              </p>
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setRating(n)}
                    className="p-1"
                  >
                    <Star
                      className={[
                        "h-7 w-7",
                        n <= (rating || trip.ratingGiven || 0)
                          ? "fill-current text-savings"
                          : "text-muted-foreground/40",
                      ].join(" ")}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to="/app/trips" className="col-span-1">
                  <Button variant="outline" className="h-11 w-full rounded-xl">View trips</Button>
                </Link>
                <Link to="/app" className="col-span-1">
                  <Button className="h-11 w-full rounded-xl">Find next load</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Cancelled */}
          {trip.status === "cancelled" && (
            <Link to="/app" className="mt-4 block">
              <Button className="h-11 w-full rounded-xl">Back to dashboard</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
