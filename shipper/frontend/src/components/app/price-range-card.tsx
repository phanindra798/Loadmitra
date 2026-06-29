import { Leaf, Info, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, priceRangeLabel } from "@/features/shipper/pricing";
import { MODE_META, TONE_VAR } from "@/features/shipper/mode-meta";
import { useT } from "@/features/shipper/i18n";
import type { PriceBreakdown } from "@/features/shipper/types";

/**
 * Transparent, negotiable price ESTIMATE. Never a single hard figure — always a
 * range — and always with a full breakdown, because freight pricing is haggled
 * and no money moves through the app in this version.
 */
export function PriceRangeCard({
  price,
  className,
}: {
  price: PriceBreakdown;
  className?: string;
}) {
  const t = useT();
  const meta = MODE_META[price.mode];

  const rows: { label: string; value: string }[] = [
    { label: t("price.baseFare"), value: inr(price.base) },
    { label: t("price.distanceRow", { km: price.distanceKm }), value: inr(price.distanceCharge) },
  ];
  if (price.sharePct != null) {
    rows.push({ label: t("price.yourShare"), value: `${Math.round(price.sharePct * 100)}%` });
  }
  if (price.surgeMultiplier !== 1) {
    rows.push({ label: t("price.surge"), value: `×${price.surgeMultiplier.toFixed(2)}` });
  }
  if (price.discount > 0) {
    const discountLabel =
      price.mode === "return"
        ? t("price.returnDiscount", { pct: Math.round(price.discountPct * 100) })
        : price.mode === "shared"
          ? t("price.sharedPrice")
          : t("price.discount");
    rows.push({ label: discountLabel, value: `− ${inr(price.discount)}` });
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("price.estimated")}
          </p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {priceRangeLabel(price)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {inr(price.ratePerKm)}/km · {t("price.negotiable")}
          </p>
        </div>
        {meta.badge && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: TONE_VAR[meta.tone], color: "#0B1220" }}
          >
            {meta.badge}
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="min-w-0 truncate text-muted-foreground">{r.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>

      {(price.savings > 0 || price.co2SavedKg > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {price.savings > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: "color-mix(in oklab, var(--savings) 20%, transparent)", color: "var(--savings)" }}
            >
              <TrendingDown className="h-3.5 w-3.5" /> {t("price.youSave", { amount: inr(price.savings) })}
            </span>
          )}
          {price.co2SavedKg > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: "color-mix(in oklab, var(--success) 18%, transparent)", color: "var(--success)" }}
            >
              <Leaf className="h-3.5 w-3.5" /> {t("price.co2Saved", { kg: price.co2SavedKg })}
            </span>
          )}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("price.disclaimer")}
      </p>
    </div>
  );
}
