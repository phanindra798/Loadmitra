import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  ChevronDown,
  Bell,
  Home as HomeIcon,
  Briefcase,
  Plus,
  Navigation2,
  ChevronRight,
  Package,
  Loader2,
} from "lucide-react";
import { MapCanvas } from "@/components/app/map-canvas";
import { ServiceTile } from "@/components/app/service-tile";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useT } from "@/features/shipper/i18n";
import { useProfile } from "@/features/shipper/profile-context";
import { useBooking } from "@/features/shipper/booking-context";
import { MODE_LIST, MODE_I18N, TONE_VAR } from "@/features/shipper/mode-meta";
import { OFFERS, SAVED_PLACES, truckById } from "@/features/shipper/mock-data";
import { inr } from "@/features/shipper/pricing";
import type { BookingMode, Place } from "@/features/shipper/types";

export const Route = createFileRoute("/app/")({
  component: ShipperHome,
});

const ACTIVE_STATUSES = new Set([
  "requested",
  "accepted",
  "enroute_pickup",
  "at_pickup",
  "picked",
  "enroute_drop",
]);

function ShipperHome() {
  const navigate = useNavigate();
  const t = useT();
  const { firstName, initials } = useProfile();
  const { setMode, setDrop, setPickup, bookings } = useBooking();
  const { status: geoStatus, place: geoPlace, locate } = useGeolocation();

  const activeTrip = bookings.find((b) => ACTIVE_STATUSES.has(b.status));

  const locationLabel =
    geoStatus === "locating"
      ? t("home.locating")
      : geoStatus === "denied"
        ? t("home.enableLocation")
        : geoStatus === "unsupported"
          ? t("home.unavailable")
          : (geoPlace?.city ?? t("home.setLocation"));

  async function detectLocation() {
    const found = await locate();
    if (found) {
      // Seed the booking pickup so the search screen starts from where you are.
      setPickup({
        id: "current",
        label: found.label,
        address: found.address,
        city: found.city,
        kind: "other",
      });
    }
  }

  function pickMode(mode: BookingMode) {
    setMode(mode);
    navigate({ to: "/app/search" });
  }

  function pickSaved(place: Place) {
    setDrop(place);
    navigate({ to: "/app/search" });
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden lg:h-screen">
      <MapCanvas variant="home" className="absolute inset-0 h-full w-full" />

      {/* Top location bar */}
      <div className="absolute inset-x-0 top-0 z-20 px-3 pt-3 sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            onClick={detectLocation}
            disabled={geoStatus === "locating"}
            className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card/95 py-2 pl-3 pr-4 shadow-sm backdrop-blur hover:bg-secondary disabled:opacity-80"
          >
            {geoStatus === "locating" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span className="min-w-0 text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("home.currentLocation")}
              </span>
              <span className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
                {locationLabel} <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              aria-label="Notifications"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-sm backdrop-blur hover:bg-secondary"
            >
              <Bell className="h-4 w-4" />
            </button>
            <Link
              to="/app/account"
              aria-label="Account"
              className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-border lg:hidden"
            >
              {initials}
            </Link>
          </div>
        </div>
      </div>

      {/* Booking panel: bottom sheet on mobile, floating card on desktop */}
      <div className="absolute inset-x-0 bottom-16 z-20 px-2 sm:px-4 lg:inset-auto lg:bottom-auto lg:left-6 lg:top-20 lg:w-[400px] lg:px-0">
        <div className="mx-auto max-h-[74vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl lm-no-scrollbar lg:max-h-[calc(100vh-7rem)]">
          {/* Active trip banner */}
          {activeTrip && (
            <Link
              to="/app/track/$id"
              params={{ id: activeTrip.id }}
              className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3"
            >
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Navigation2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground">{t("home.tripInProgress")}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {activeTrip.pickup.label} → {activeTrip.drop.label}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
            </Link>
          )}

          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {t("home.greeting", { name: firstName })}
          </h2>

          {/* Search trigger */}
          <button
            onClick={() => navigate({ to: "/app/search" })}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left shadow-sm transition-colors hover:border-primary/40"
          >
            <Search className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {t("home.enterPickupDrop")}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {t("home.instantEstimate")}
              </span>
            </span>
            <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
              {t("home.go")}
            </span>
          </button>

          {/* Service tiles */}
          <div className="mt-4 grid grid-cols-4 gap-2.5">
            {MODE_LIST.map((m) => (
              <ServiceTile
                key={m.id}
                icon={m.icon}
                label={t(MODE_I18N[m.id].short)}
                tone={m.tone}
                badge={m.id === "return" ? "−25%" : m.id === "shared" ? "−20%" : undefined}
                onClick={() => pickMode(m.id)}
              />
            ))}
            <ServiceTile icon={Package} label={t("home.track")} tone="primary" onClick={() => navigate({ to: "/app/bookings" })} />
          </div>

          {/* Saved places */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("home.savedPlaces")}
            </p>
            <div className="flex flex-wrap gap-2">
              {SAVED_PLACES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickSaved(p)}
                  className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left hover:border-primary/40"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                    {p.kind === "home" ? <HomeIcon className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-foreground">{p.label}</span>
                    <span className="block max-w-[8rem] truncate text-[11px] text-muted-foreground">
                      {p.address}
                    </span>
                  </span>
                </button>
              ))}
              <button
                onClick={() => navigate({ to: "/app/search" })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t("home.add")}
              </button>
            </div>
          </div>

          {/* Offers strip */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("home.offersForYou")}
              </p>
              <Link to="/app/offers" className="text-xs font-semibold text-primary">
                {t("home.seeAll")}
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 lm-no-scrollbar">
              {OFFERS.slice(0, 3).map((o) => (
                <Link
                  key={o.id}
                  to="/app/offers"
                  className="flex w-56 shrink-0 flex-col justify-between rounded-2xl border border-border p-3"
                  style={{ background: `color-mix(in oklab, ${TONE_VAR[o.tone]} 10%, var(--card))` }}
                >
                  <p className="text-sm font-bold text-foreground">{o.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{o.desc}</p>
                  <span className="mt-2 inline-flex w-fit rounded-md bg-card px-2 py-0.5 text-[11px] font-bold text-foreground ring-1 ring-border">
                    {o.code}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Cheapest hint */}
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Tata Ace from {inr(truckById("ace")!.baseFare)} base · {MODE_LIST.length} ways to ship
          </p>
        </div>
      </div>
    </div>
  );
}
