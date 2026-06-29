import { cn } from "@/lib/utils";
import type { Place } from "@/features/captain/types";

/** Pickup → drop with the dashed connector. Used across requests, trips, history. */
export function RouteLine({
  pickup,
  drop,
  className,
  dense = false,
}: {
  pickup: Place;
  drop: Place;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--primary)" }} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {pickup.label}
        </span>
      </div>
      {!dense && (
        <p className="ml-[5px] truncate border-l-2 border-dashed border-border pl-[13px] text-[11px] text-muted-foreground">
          {pickup.address}
        </p>
      )}
      <div className={cn("ml-[5px] border-l-2 border-dashed border-border", dense ? "h-3" : "h-2")} />
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--savings)" }} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {drop.label}
        </span>
      </div>
      {!dense && (
        <p className="ml-[5px] truncate pl-[13px] text-[11px] text-muted-foreground">{drop.address}</p>
      )}
    </div>
  );
}
