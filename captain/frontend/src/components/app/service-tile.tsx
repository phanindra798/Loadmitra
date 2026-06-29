import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_VAR, type Tone } from "@/features/captain/mode-meta";

/** Rapido-style quick-action tile used on the captain dashboard. */
export function ServiceTile({
  icon: Icon,
  label,
  badge,
  tone = "primary",
  onClick,
  className,
}: {
  icon: LucideIcon;
  label: string;
  badge?: string;
  tone?: Tone;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {badge && (
        <span
          className="absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none shadow-sm"
          style={{ background: TONE_VAR[tone], color: "#0B1220" }}
        >
          {badge}
        </span>
      )}
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-border transition-colors group-hover:ring-transparent"
        style={{ background: `color-mix(in oklab, ${TONE_VAR[tone]} 14%, transparent)`, color: TONE_VAR[tone] }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
        {label}
      </span>
    </button>
  );
}
