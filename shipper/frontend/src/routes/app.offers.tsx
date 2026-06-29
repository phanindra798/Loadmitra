import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Repeat, Users, Gift, Sparkles, Copy, Check, Leaf } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useT } from "@/features/shipper/i18n";
import { useBooking } from "@/features/shipper/booking-context";
import { OFFERS } from "@/features/shipper/mock-data";
import { TONE_VAR } from "@/features/shipper/mode-meta";
import type { Offer } from "@/features/shipper/types";

export const Route = createFileRoute("/app/offers")({
  component: OffersPage,
});

const ICONS = { return: Repeat, share: Users, first: Sparkles, refer: Gift } as const;

function OffersPage() {
  const navigate = useNavigate();
  const t = useT();
  const { setMode } = useBooking();
  const [copied, setCopied] = useState<string | null>(null);

  function copy(code: string) {
    setCopied(code);
    try {
      navigator.clipboard?.writeText(code);
    } catch {
      /* ignore */
    }
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
  }

  function use(o: Offer) {
    if (o.icon === "return") setMode("return");
    if (o.icon === "share") setMode("shared");
    navigate({ to: "/app/search" });
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-3xl pb-28 lg:pb-10">
      <PageHeader title={t("offers.title")} subtitle={t("offers.subtitle")} back={false} />

      <div className="space-y-4 px-4 pt-4 sm:px-6">
        {/* Hero savings band */}
        <div
          className="relative overflow-hidden rounded-3xl p-5 text-white"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--navy))" }}
        >
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5" />
            <p className="text-sm font-semibold">{t("offers.greenImpact")}</p>
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{t("price.co2Saved", { kg: "1,250" })}</p>
          <p className="mt-1 text-sm text-white/80">{t("offers.greenSub")}</p>
        </div>

        {/* Offer cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {OFFERS.map((o) => {
            const Icon = ICONS[o.icon];
            return (
              <div key={o.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${TONE_VAR[o.tone]} 16%, transparent)`, color: TONE_VAR[o.tone] }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <button
                    onClick={() => copy(o.code)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs font-bold text-foreground hover:bg-secondary"
                  >
                    {copied === o.code ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    {o.code}
                  </button>
                </div>
                <h3 className="mt-3 text-base font-bold tracking-tight text-foreground">{o.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{o.desc}</p>
                <button
                  onClick={() => use(o)}
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-foreground hover:bg-secondary/80"
                >
                  {o.icon === "refer" ? t("offers.invite") : t("offers.useOffer")}
                </button>
              </div>
            );
          })}
        </div>

        <p className="px-1 text-center text-[11px] text-muted-foreground">{t("offers.disclaimer")}</p>
      </div>
    </div>
  );
}
