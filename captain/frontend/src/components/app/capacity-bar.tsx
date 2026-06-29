import { cn } from "@/lib/utils";

/**
 * Shared-load capacity meter. Shows how much of a truck is already committed
 * and how much space is left — the visual half of the atomic "never oversell"
 * allocation guard on the backend.
 */
export function CapacityBar({
  usedKg,
  totalKg,
  addKg = 0,
  className,
}: {
  usedKg: number;
  totalKg: number;
  /** Optional preview of the load about to be added (shown as a second segment). */
  addKg?: number;
  className?: string;
}) {
  const used = Math.min(usedKg, totalKg);
  const add = Math.min(addKg, Math.max(0, totalKg - used));
  const usedPct = (used / totalKg) * 100;
  const addPct = (add / totalKg) * 100;
  const freeKg = Math.max(0, totalKg - used - add);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">Capacity used</span>
        <span className="text-foreground">
          {(used + add).toLocaleString("en-IN")} / {totalKg.toLocaleString("en-IN")} kg
        </span>
      </div>
      <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-l-full" style={{ width: `${usedPct}%`, background: "var(--cyan-accent)" }} />
        {add > 0 && (
          <div
            className="h-full"
            style={{
              width: `${addPct}%`,
              background:
                "repeating-linear-gradient(45deg, var(--primary) 0 6px, color-mix(in oklab, var(--primary) 60%, white) 6px 12px)",
            }}
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>{freeKg.toLocaleString("en-IN")} kg free</span>
        {add > 0 && <span className="text-primary">+ {add.toLocaleString("en-IN")} kg your load</span>}
      </div>
    </div>
  );
}
