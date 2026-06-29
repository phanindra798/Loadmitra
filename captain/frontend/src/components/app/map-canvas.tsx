import { useId } from "react";
import { cn } from "@/lib/utils";

type MapVariant = "home" | "route" | "live";

/**
 * Self-contained faux map. Pure SVG + CSS so it renders identically on the
 * server and client (no Google Maps key needed yet). The route polyline, pins
 * and moving marker scale fluidly with the container — drop a real map tile
 * layer in behind this later and reuse the same overlay markers.
 */
export function MapCanvas({
  variant = "home",
  className,
}: {
  variant?: MapVariant;
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const routeId = `route-${uid}`;
  const showRoute = variant === "route" || variant === "live";

  return (
    <div
      aria-hidden
      className={cn("relative isolate overflow-hidden", className)}
      style={{ background: "var(--map-bg)" }}
    >
      {/* Street grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 38px, var(--map-street) 38px 42px)," +
            "repeating-linear-gradient(90deg, transparent 0 46px, var(--map-street) 46px 50px)",
          opacity: 0.7,
        }}
      />
      {/* Major diagonals for a city feel */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(35deg, transparent 0 120px, var(--map-street) 120px 127px)",
          opacity: 0.5,
        }}
      />
      {/* Decorative blocks */}
      <div className="absolute left-[6%] top-[12%] h-16 w-24 rounded-md" style={{ background: "var(--map-block)" }} />
      <div className="absolute right-[10%] top-[20%] h-20 w-20 rounded-md" style={{ background: "var(--map-green)" }} />
      <div className="absolute left-[16%] bottom-[14%] h-24 w-28 rounded-lg" style={{ background: "var(--map-water)" }} />
      <div className="absolute right-[18%] bottom-[18%] h-14 w-24 rounded-md" style={{ background: "var(--map-block)" }} />

      {/* Route + markers */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
        fill="none"
      >
        {showRoute && (
          <>
            <path
              id={routeId}
              d="M60,188 C120,158 132,96 200,116 S300,150 344,72"
              stroke="var(--map-route-soft)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M60,188 C120,158 132,96 200,116 S300,150 344,72"
              stroke="var(--map-route)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={variant === "live" ? "10 8" : undefined}
              className={variant === "live" ? "lm-route-dash" : undefined}
              style={
                variant === "live"
                  ? { animation: "lm-dash-flow 0.9s linear infinite" }
                  : undefined
              }
            />
            {/* Pickup */}
            <g>
              <circle cx="60" cy="188" r="9" fill="white" />
              <circle cx="60" cy="188" r="5.5" fill="var(--map-route)" />
            </g>
            {/* Drop */}
            <g>
              <circle cx="344" cy="72" r="11" fill="white" />
              <circle cx="344" cy="72" r="7" fill="var(--savings)" />
            </g>
            {/* Live moving marker */}
            {variant === "live" && (
              <g className="lm-marker">
                <animateMotion dur="7s" repeatCount="indefinite" rotate="0">
                  <mpath href={`#${routeId}`} />
                </animateMotion>
                <circle r="13" fill="var(--map-route)" opacity="0.18" />
                <circle r="8" fill="white" />
                <circle r="5" fill="var(--map-route)" />
              </g>
            )}
          </>
        )}
      </svg>

      {/* Home: nearby trucks + "you are here" */}
      {variant === "home" && (
        <>
          {[
            { left: "26%", top: "30%", delay: "0s" },
            { left: "62%", top: "26%", delay: "0.4s" },
            { left: "70%", top: "58%", delay: "0.8s" },
            { left: "34%", top: "64%", delay: "1.2s" },
            { left: "50%", top: "44%", delay: "0.2s" },
          ].map((m, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-lg"
              style={{ left: m.left, top: m.top }}
            >
              <span
                className="lm-marker inline-block"
                style={{ animation: `lm-marker-bob 2.2s ease-in-out ${m.delay} infinite` }}
              >
                🚚
              </span>
            </span>
          ))}
          {/* You are here */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span
              className="lm-ping absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "var(--primary)", animation: "lm-ping-ring 2s ease-out infinite" }}
            />
            <span
              className="relative block h-3.5 w-3.5 rounded-full border-2 border-white"
              style={{ background: "var(--primary)" }}
            />
          </span>
        </>
      )}

      {/* Soft vignette to lift overlays */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 55%, color-mix(in oklab, var(--background) 55%, transparent) 100%)",
        }}
      />
    </div>
  );
}
