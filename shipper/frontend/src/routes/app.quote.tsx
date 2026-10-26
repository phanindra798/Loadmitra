import { toast } from "sonner";
import { isAuthed } from "@/lib/account";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Minus, Plus, Star, Clock, ChevronDown, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PriceRangeCard } from "@/components/app/price-range-card";
import { CapacityBar } from "@/components/app/capacity-bar";
import { Button } from "@/components/ui/button";
import {
  useBooking,
  newBookingId,
  nowLabel,
} from "@/features/shipper/booking-context";
import { MODE_LIST, MODE_I18N } from "@/features/shipper/mode-meta";
import { useT } from "@/features/shipper/i18n";
import { GOODS_TYPES, TRUCK_TYPES, truckById } from "@/features/shipper/mock-data";
import { estimateDistanceKm, estimatePrice, inr, priceRangeLabel } from "@/features/shipper/pricing";
import { shipperApi } from "@/lib/api";

export const Route = createFileRoute("/app/quote")({
  component: QuotePage,
});

function QuotePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const requestRef = useRef<{ key: string; id: string } | null>(null);
  const t = useT();
  const { draft, setMode, setTruck, setWeight, setGoods, createBooking } = useBooking();

  const distanceKm = useMemo(
    () => estimateDistanceKm(draft.pickup?.city ?? draft.pickup?.label, draft.drop?.city ?? draft.drop?.label),
    [draft.pickup, draft.drop],
  );

  const weight = draft.loadWeightKg;

  // Recommend the smallest truck that fits, default-select it once.
  const recommendedId = useMemo(() => {
    const fit = TRUCK_TYPES.find((t) => t.capacityKg >= weight);
    return (fit ?? TRUCK_TYPES[TRUCK_TYPES.length - 1]).id;
  }, [weight]);

  useEffect(() => {
    if (!draft.truckTypeId) setTruck(recommendedId);
  }, [draft.truckTypeId, recommendedId, setTruck]);

  const selectedId = draft.truckTypeId ?? recommendedId;
  const selectedTruck = truckById(selectedId)!;

  // Local compute is the instant, SSR-safe baseline; the server estimate (same
  // formula) refines it after mount and falls back to local if the API is down.
  const localPrice = useMemo(
    () => estimatePrice({ truck: selectedTruck, distanceKm, mode: draft.mode, loadWeightKg: weight }),
    [selectedTruck, distanceKm, draft.mode, weight],
  );
  const { data: price } = useQuery({
    queryKey: ["estimate", selectedId, distanceKm, draft.mode, weight],
    queryFn: () =>
      shipperApi.estimate({ truckTypeId: selectedId, mode: draft.mode, distanceKm, loadWeightKg: weight }),
    initialData: localPrice,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // No route set — guide the user back to search.
  if (!draft.pickup || !draft.drop) {
    return (
      <div className="mx-auto min-h-[100dvh] w-full max-w-2xl">
        <PageHeader title={t("quote.title")} />
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground" />
          <p className="font-semibold text-foreground">{t("quote.noRoute")}</p>
          <Link to="/app/search">
            <Button className="rounded-xl">{t("quote.addRoute")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  async function book() {
    if (savingRef.current) return;
    if (!isAuthed()) { toast.error("Please sign in before booking"); navigate({ to: "/login" }); return; }
    const key = JSON.stringify(draft);
    if (requestRef.current?.key !== key) requestRef.current = { key, id: newBookingId() };
    const id = requestRef.current.id;
    savingRef.current = true; setSaving(true);
    const agreed = price.estimate;
    try {
    const saved = await shipperApi.createBooking({
      bookingId: id,
      mode: draft.mode,
      pickup: draft.pickup!,
      drop: draft.drop!,
      distanceKm: price.distanceKm,
      truckTypeId: selectedId,
      truckTypeName: selectedTruck.name,
      loadWeightKg: weight,
      goodsType: draft.goodsType,
      agreedPrice: agreed,
      createdLabel: nowLabel(),
    });
    createBooking(saved);
    navigate({ to: "/app/matching", search: { id } });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Booking failed"); }
    finally { savingRef.current = false; setSaving(false); }
  }

  const existingSharedKg = Math.round(selectedTruck.capacityKg * 0.4);

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-40 lg:pb-44">
      <PageHeader
        title={t("quote.title")}
        subtitle={t("quote.routeSubtitle", { from: draft.pickup.label, to: draft.drop.label, km: distanceKm })}
      />

      <div className="space-y-4 px-4 pt-4 sm:px-6">
        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-secondary p-1.5">
          {MODE_LIST.map((m) => {
            const Icon = m.icon;
            const active = draft.mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={[
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-all",
                  active ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {t(MODE_I18N[m.id].short)}
              </button>
            );
          })}
        </div>

        {/* Load details */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">{t("quote.loadWeight")}</p>
              <p className="text-xs text-muted-foreground">{t("quote.loadWeightHint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeight(Math.max(50, weight - 50))}
                aria-label={t("quote.decreaseWeight")}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background hover:bg-secondary"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-20 text-center text-sm font-bold tabular-nums text-foreground">
                {weight.toLocaleString("en-IN")} kg
              </span>
              <button
                onClick={() => setWeight(Math.min(5000, weight + 50))}
                aria-label={t("quote.increaseWeight")}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background hover:bg-secondary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Goods type */}
          <div className="mt-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("quote.goodsType")}
            </label>
            <div className="relative mt-1">
              <select
                value={draft.goodsType}
                onChange={(e) => setGoods(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-9 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {GOODS_TYPES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {draft.mode === "shared" && (
            <div className="mt-4 rounded-xl bg-secondary/50 p-3">
              <CapacityBar usedKg={existingSharedKg} totalKg={selectedTruck.capacityKg} addKg={weight} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("quote.shareHint", { truck: selectedTruck.name })}
              </p>
            </div>
          )}
        </div>

        {/* Truck list */}
        <div>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("quote.availableTrucks")}
          </p>
          <div className="space-y-2">
            {TRUCK_TYPES.map((truck) => {
              const p = estimatePrice({ truck, distanceKm, mode: draft.mode, loadWeightKg: weight });
              const fits = truck.capacityKg >= weight;
              const active = selectedId === truck.id;
              return (
                <button
                  key={truck.id}
                  onClick={() => setTruck(truck.id)}
                  className={[
                    "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition-all",
                    active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40",
                  ].join(" ")}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                    {truck.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{truck.name}</span>
                      {!fits && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                          {t("quote.tooSmall")}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{truck.desc}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                        <Star className="h-3 w-3 fill-current text-savings" /> {truck.rating}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {truck.etaMins} min
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-extrabold text-foreground">{inr(p.low)}</span>
                    <span className="block text-[11px] text-muted-foreground">–{inr(p.high)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Price breakdown */}
        <PriceRangeCard price={price} />
      </div>

      {/* Sticky book bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 p-3 backdrop-blur-xl lg:bottom-0 lg:left-[260px]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {selectedTruck.name} · {t(MODE_I18N[draft.mode].short)}
            </p>
            <p className="truncate text-base font-extrabold text-foreground">{priceRangeLabel(price)}</p>
          </div>
          <Button disabled={saving} onClick={book} className="ml-auto h-12 rounded-xl px-6 text-base">
            {t("quote.bookNow")} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
