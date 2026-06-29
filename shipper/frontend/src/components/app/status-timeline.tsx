import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/features/shipper/i18n";
import type { TKey } from "@/features/shipper/translations";
import type { BookingStatus } from "@/features/shipper/types";

const STEPS: { status: BookingStatus; labelKey: TKey; hintKey: TKey }[] = [
  { status: "accepted", labelKey: "timeline.accepted.label", hintKey: "timeline.accepted.hint" },
  { status: "enroute_pickup", labelKey: "timeline.enroutePickup.label", hintKey: "timeline.enroutePickup.hint" },
  { status: "at_pickup", labelKey: "timeline.atPickup.label", hintKey: "timeline.atPickup.hint" },
  { status: "picked", labelKey: "timeline.picked.label", hintKey: "timeline.picked.hint" },
  { status: "enroute_drop", labelKey: "timeline.enrouteDrop.label", hintKey: "timeline.enrouteDrop.hint" },
  { status: "delivered", labelKey: "timeline.delivered.label", hintKey: "timeline.delivered.hint" },
];

const ORDER: BookingStatus[] = [
  "requested",
  "accepted",
  "enroute_pickup",
  "at_pickup",
  "picked",
  "enroute_drop",
  "delivered",
];

export function StatusTimeline({ status }: { status: BookingStatus }) {
  const t = useT();
  if (status === "cancelled") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
        {t("timeline.cancelled")}
      </div>
    );
  }

  const currentIdx = ORDER.indexOf(status);

  return (
    <ol className="relative space-y-0">
      {STEPS.map((step, i) => {
        const stepIdx = ORDER.indexOf(step.status);
        const done = currentIdx > stepIdx;
        const active = currentIdx === stepIdx;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={step.status} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[13px] top-7 h-[calc(100%-14px)] w-0.5",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-card text-primary",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-4 w-4" />
              ) : active ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ background: "var(--primary)", animation: "lm-ping-ring 1.8s ease-out infinite" }}
                  />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-current" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  active ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground",
                )}
              >
                {t(step.labelKey)}
              </p>
              {active && <p className="text-xs text-muted-foreground">{t(step.hintKey)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
