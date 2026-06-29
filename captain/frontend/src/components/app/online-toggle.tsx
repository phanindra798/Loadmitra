import { Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCaptain } from "@/features/captain/captain-context";

/**
 * The captain's online/offline switch — the single most important control in a
 * driver app. Online means "broadcast load requests to me"; offline silences
 * them. Icon-only: solid GREEN when online, solid RED when offline. Two sizes:
 * a compact round button for headers/nav and a full-width hero button.
 */
export function OnlineToggle({
  size = "pill",
  className,
}: {
  size?: "pill" | "block";
  className?: string;
}) {
  const { online, toggleOnline } = useCaptain();
  const label = online ? "You're online — tap to go offline" : "You're offline — tap to go online";

  if (size === "block") {
    return (
      <button
        type="button"
        onClick={toggleOnline}
        aria-pressed={online}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-14 w-full items-center justify-center rounded-2xl text-white shadow-sm transition-all active:scale-[0.99]",
          online ? "bg-success hover:brightness-110" : "bg-primary hover:brightness-110",
          className,
        )}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
          <Power className="h-5 w-5" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleOnline}
      aria-pressed={online}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full text-white shadow-sm transition-colors",
        online ? "bg-success hover:brightness-110" : "bg-primary hover:brightness-110",
        className,
      )}
    >
      <span className="relative grid place-items-center">
        {online && (
          <span
            className="absolute inline-flex h-9 w-9 rounded-full bg-success/40"
            style={{ animation: "lm-pulse-dot 1.4s ease-in-out infinite" }}
          />
        )}
        <Power className="relative h-4 w-4" />
      </span>
    </button>
  );
}
