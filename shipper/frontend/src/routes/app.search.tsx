import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  MapPin,
  Navigation,
  ArrowUpDown,
  LocateFixed,
  Clock,
  Home as HomeIcon,
  Briefcase,
  Search as SearchIcon,
  ArrowRight,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useT } from "@/features/shipper/i18n";
import { useBooking } from "@/features/shipper/booking-context";
import { MODE_LIST, MODE_I18N } from "@/features/shipper/mode-meta";
import { PLACE_DIRECTORY } from "@/features/shipper/mock-data";
import type { Place } from "@/features/shipper/types";

export const Route = createFileRoute("/app/search")({
  component: SearchPage,
});

function placeIcon(kind: Place["kind"]) {
  if (kind === "home") return HomeIcon;
  if (kind === "work") return Briefcase;
  if (kind === "recent") return Clock;
  return MapPin;
}

function SearchPage() {
  const navigate = useNavigate();
  const t = useT();
  const { draft, setMode, setPickup, setDrop } = useBooking();
  const { status: geoStatus, locate } = useGeolocation();

  const [pickup, setPickupLocal] = useState<Place | undefined>(draft.pickup);
  const [drop, setDropLocal] = useState<Place | undefined>(draft.drop);
  const [pickupText, setPickupText] = useState(draft.pickup?.label ?? "");
  const [dropText, setDropText] = useState(draft.drop?.label ?? "");
  const [active, setActive] = useState<"pickup" | "drop">(draft.pickup ? "drop" : "pickup");

  const query = (active === "pickup" ? pickupText : dropText).trim().toLowerCase();
  const results = PLACE_DIRECTORY.filter((p) =>
    query
      ? `${p.label} ${p.address} ${p.city}`.toLowerCase().includes(query)
      : true,
  );

  function choose(place: Place) {
    if (active === "pickup") {
      setPickupLocal(place);
      setPickupText(place.label);
      if (!drop) setActive("drop");
    } else {
      setDropLocal(place);
      setDropText(place.label);
      if (!pickup) setActive("pickup");
    }
  }

  function swap() {
    setPickupLocal(drop);
    setDropLocal(pickup);
    setPickupText(dropText);
    setDropText(pickupText);
  }

  async function useCurrentLocation() {
    const found = await locate();
    if (found) {
      choose({
        id: "current",
        label: found.label,
        address: found.address,
        city: found.city,
        kind: "other",
      });
    } else {
      toast.error(t("search.geoError"), { description: t("search.geoErrorHint") });
    }
  }

  function synth(text: string, place?: Place): Place | undefined {
    if (place) return place;
    const t = text.trim();
    if (!t) return undefined;
    return { id: "x-" + t, label: t, address: t, city: t, kind: "other" };
  }

  function cont() {
    const p = synth(pickupText, pickup);
    const d = synth(dropText, drop);
    if (!p || !d) return;
    setPickup(p);
    setDrop(d);
    navigate({ to: "/app/quote" });
  }

  const canContinue = pickupText.trim() && dropText.trim();

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-28 lg:pb-10">
      <PageHeader title={t("search.title")} subtitle={t("search.subtitle")} />

      <div className="px-4 pt-4 sm:px-6">
        {/* Mode chips */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lm-no-scrollbar">
          {MODE_LIST.map((m) => {
            const Icon = m.icon;
            const activeMode = draft.mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeMode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" /> {t(MODE_I18N[m.id].label)}
                {m.badge && activeMode && <span className="ml-0.5">{m.badge}</span>}
              </button>
            );
          })}
        </div>

        {/* Pickup / drop fields with swap */}
        <div className="relative rounded-2xl border border-border bg-card p-2 shadow-sm">
          <div className="absolute left-[26px] top-[34px] bottom-[34px] w-px border-l-2 border-dashed border-border" />
          <FieldRow
            tone="var(--primary)"
            icon={<span className="block h-3 w-3 rounded-full" style={{ background: "var(--primary)" }} />}
            placeholder={t("search.pickupPlaceholder")}
            value={pickupText}
            activeField={active === "pickup"}
            onFocus={() => setActive("pickup")}
            onChange={(v) => {
              setPickupText(v);
              setPickupLocal(undefined);
            }}
          />
          <div className="my-1 h-px bg-border" />
          <FieldRow
            tone="var(--savings)"
            icon={<MapPin className="h-4 w-4" style={{ color: "var(--savings)" }} />}
            placeholder={t("search.dropPlaceholder")}
            value={dropText}
            activeField={active === "drop"}
            onFocus={() => setActive("drop")}
            onChange={(v) => {
              setDropText(v);
              setDropLocal(undefined);
            }}
          />
          <button
            onClick={swap}
            aria-label="Swap pickup and drop"
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-secondary"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>

        {/* Suggestions */}
        <div className="mt-4">
          {active === "pickup" && !query && (
            <button
              onClick={useCurrentLocation}
              disabled={geoStatus === "locating"}
              className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-secondary disabled:opacity-70"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                {geoStatus === "locating" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
              </span>
              <span className="text-sm font-semibold text-primary">
                {geoStatus === "locating" ? t("search.gettingLocation") : t("search.useCurrent")}
              </span>
            </button>
          )}

          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {query ? t("search.results") : t("search.savedRecent")}
          </p>
          <ul>
            {results.map((p) => {
              const Icon = placeIcon(p.kind);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => choose(p)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-secondary"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{p.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.address}</span>
                    </span>
                    <Navigation className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
            {results.length === 0 && (
              <li className="flex flex-col items-center gap-1 px-2 py-8 text-center">
                <SearchIcon className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">{t("search.noMatch")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("search.noMatchHint", {
                    q: active === "pickup" ? pickupText : dropText,
                    field: active === "pickup" ? t("search.fieldPickup") : t("search.fieldDrop"),
                  })}
                </p>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Sticky continue */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 p-3 backdrop-blur-xl lg:bottom-0 lg:left-[260px]">
        <div className="mx-auto max-w-2xl px-1">
          <Button onClick={cont} disabled={!canContinue} className="h-12 w-full rounded-xl text-base">
            {t("search.seeEstimate")} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  icon,
  placeholder,
  value,
  activeField,
  onFocus,
  onChange,
}: {
  tone: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  activeField: boolean;
  onFocus: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
        activeField ? "bg-secondary/60" : "",
      ].join(" ")}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center">{icon}</span>
      <input
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent pr-10 text-sm font-semibold text-foreground placeholder:font-medium placeholder:text-muted-foreground/70 focus:outline-none"
      />
    </div>
  );
}
