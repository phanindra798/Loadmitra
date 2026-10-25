import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Bell, MapPin, ChevronDown, Radar, Wallet, Route as RouteIcon,
  Navigation2, ChevronRight, Star, Power,
} from "lucide-react";
import { MapCanvas } from "@/components/app/map-canvas";
import { OnlineToggle } from "@/components/app/online-toggle";
import { RequestCard } from "@/components/app/request-card";
import { useCaptain } from "@/features/captain/captain-context";
import { inr } from "@/features/captain/earnings";
import { useGeolocation } from "@/hooks/use-geolocation";

export const Route = createFileRoute("/app/")({
  component: CaptainDashboard,
});

const REQUEST_TTL = 30; // seconds an offer stays before auto-skipping

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function CaptainDashboard() {
  const navigate = useNavigate();
  const {
    online, requests, activeTrip, earnings, profile, requestPool,
    addRequest, acceptRequest, declineRequest,
  } = useCaptain();

  // Live location for the captain (real GPS via the browser).
  const { status: geoStatus, place: geoPlace, locate } = useGeolocation();
  useEffect(() => {
    locate(); // prompt once on load; harmless if already granted/denied
  }, [locate]);

  // Ids already broadcast this online session, so a live pool refresh (a load a
  // shipper just booked) surfaces the new offer without re-showing seen ones.
  const seenRef = useRef<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(REQUEST_TTL);

  // Reset the broadcast set whenever the captain goes offline.
  useEffect(() => {
    if (!online) seenRef.current = new Set();
  }, [online]);

  // Simulate the matching engine streaming nearby loads while online & free.
  // The pool comes from the server (GET /api/captain/requests, polled live), or
  // the mock seed if the API is unreachable. Feed the next not-yet-seen load.
  useEffect(() => {
    if (!online || activeTrip) return;
    const next = requestPool.find(
      (r) => !seenRef.current.has(r.id) && !requests.some((x) => x.id === r.id),
    );
    if (!next) return;
    const delay = seenRef.current.size === 0 ? 1000 : 3500;
    const t = setTimeout(() => {
      seenRef.current.add(next.id);
      addRequest(next);
    }, delay);
    return () => clearTimeout(t);
  }, [online, activeTrip, requests, requestPool, addRequest]);

  // Countdown on the top (featured) offer; auto-skip when it expires.
  const firstId = requests[0]?.id;
  useEffect(() => {
    if (!firstId) return;
    setSecondsLeft(REQUEST_TTL);
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          declineRequest(firstId);
          return REQUEST_TTL;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [firstId, declineRequest]);

  async function accept(id: string) {
    if (!await acceptRequest(id)) return;
    navigate({ to: "/app/trip/$id", params: { id } });
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden lg:h-screen">
      <MapCanvas variant="home" className="absolute inset-0 h-full w-full" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 px-3 pt-3 sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            onClick={() => locate()}
            title="Use my live location"
            className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card/95 py-2 pl-3 pr-4 shadow-sm backdrop-blur hover:bg-secondary"
          >
            <MapPin
              className={`h-4 w-4 shrink-0 ${geoStatus === "ready" ? "text-success" : "text-primary"}`}
            />
            <span className="min-w-0 text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {geoStatus === "locating"
                  ? "Locating…"
                  : geoStatus === "denied"
                    ? "Location blocked"
                    : geoStatus === "unsupported"
                      ? "Location off"
                      : "You're in"}
              </span>
              <span className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
                {geoPlace?.city ?? profile.city} <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <OnlineToggle />
            <button
              aria-label="Notifications"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-sm backdrop-blur hover:bg-secondary"
            >
              <Bell className="h-4 w-4" />
            </button>
            <Link
              to="/app/account"
              aria-label="Account"
              className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white ring-1 ring-border lg:hidden"
              style={{ background: `hsl(${profile.hue} 60% 45%)` }}
            >
              {initials(profile.name)}
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom sheet on mobile, floating card on desktop */}
      <div className="absolute inset-x-0 bottom-16 z-20 px-2 sm:px-4 lg:inset-auto lg:bottom-auto lg:left-6 lg:top-20 lg:w-[420px] lg:px-0">
        <div className="mx-auto max-h-[76vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl lm-no-scrollbar lg:max-h-[calc(100vh-7rem)]">
          {/* Active trip banner */}
          {activeTrip && (
            <Link
              to="/app/trip/$id"
              params={{ id: activeTrip.id }}
              className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Navigation2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground">Trip in progress</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {activeTrip.pickup.label} → {activeTrip.drop.label}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
            </Link>
          )}

          {/* Greeting + today earnings */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold tracking-tight text-foreground">
                Hi {profile.name.split(" ")[0]} 👋
              </h2>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-current text-savings" /> {profile.rating} ·{" "}
                {profile.vehicleNumber}
              </p>
            </div>
            <Link
              to="/app/earnings"
              className="shrink-0 rounded-2xl border border-border bg-background px-3 py-2 text-right hover:border-primary/40"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Today
              </span>
              <span className="block text-lg font-extrabold tracking-tight text-foreground">
                {inr(earnings.today)}
              </span>
            </Link>
          </div>

          {/* Mini stats */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Trips today" value={String(earnings.tripsToday)} />
            <Stat label="Online hrs" value={`${earnings.onlineHoursToday}`} />
            <Stat label="Accept rate" value={`${Math.round(earnings.acceptanceRate * 100)}%`} />
          </div>

          {/* Offline state */}
          {!online && !activeTrip && (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-4 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-primary">
                <Power className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-bold text-foreground">You're offline</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Go online to start receiving load requests near you.
              </p>
              <div className="mt-3">
                <OnlineToggle size="block" />
              </div>
            </div>
          )}

          {/* Active trip → resume CTA */}
          {activeTrip && (
            <Link
              to="/app/trip/$id"
              params={{ id: activeTrip.id }}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm hover:brightness-110"
            >
              <Navigation2 className="h-4 w-4" /> Resume trip
            </Link>
          )}

          {/* Online + searching (no offers yet) */}
          {online && !activeTrip && requests.length === 0 && (
            <div className="mt-4 flex flex-col items-center py-8 text-center">
              <div className="relative grid h-28 w-28 place-items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="absolute inset-0 rounded-full border border-primary/40"
                    style={{ animation: `lm-ping-ring 2.4s ease-out ${i * 0.8}s infinite` }}
                  />
                ))}
                <span className="relative grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <Radar className="h-6 w-6" />
                </span>
              </div>
              <p className="mt-4 text-sm font-bold text-foreground">Looking for loads near you…</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Matching by your route, truck and rating. Hang tight — offers appear here.
              </p>
            </div>
          )}

          {/* Incoming offers */}
          {online && !activeTrip && requests.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  New load requests
                </p>
                <Link to="/app/trips" className="text-xs font-semibold text-primary">
                  View all
                </Link>
              </div>
              {requests.map((r, i) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  secondsLeft={i === 0 ? secondsLeft : undefined}
                  totalSeconds={REQUEST_TTL}
                  onAccept={() => accept(r.id)}
                  onDecline={() => declineRequest(r.id)}
                />
              ))}
            </div>
          )}

          {/* Quick links */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Link
              to="/app/earnings"
              className="flex items-center gap-2 rounded-2xl border border-border bg-background p-3 hover:border-primary/40"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success">
                <Wallet className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">Earnings</span>
            </Link>
            <Link
              to="/app/trips"
              className="flex items-center gap-2 rounded-2xl border border-border bg-background p-3 hover:border-primary/40"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <RouteIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">My trips</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-2.5 text-center">
      <p className="text-base font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
