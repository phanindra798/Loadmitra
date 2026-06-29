import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStatus } from "@/features/captain/types";

/**
 * Captain-side trip timeline. Same status lifecycle as the shipper app, but the
 * labels are framed as the captain's actions ("Head to pickup", "Verify pickup
 * OTP") rather than the customer's view.
 */
const STEPS: { status: TripStatus; label: string; hint: string }[] = [
  { status: "accepted", label: "Load accepted", hint: "You took this job" },
  { status: "enroute_pickup", label: "Heading to pickup", hint: "Drive to the pickup point" },
  { status: "at_pickup", label: "Arrived at pickup", hint: "Collect the pickup OTP to load" },
  { status: "picked", label: "Load picked up", hint: "Goods loaded and verified" },
  { status: "enroute_drop", label: "Heading to drop", hint: "On the way to delivery" },
  { status: "delivered", label: "Delivered", hint: "Collect the drop OTP to complete" },
];

const ORDER: TripStatus[] = [
  "accepted",
  "enroute_pickup",
  "at_pickup",
  "picked",
  "enroute_drop",
  "delivered",
];

export function StatusTimeline({ status }: { status: TripStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
        This trip was cancelled.
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
                {step.label}
              </p>
              {active && <p className="text-xs text-muted-foreground">{step.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
