import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Route as RouteIcon, Navigation2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { TripRow } from "@/components/app/trip-row";
import { useCaptain } from "@/features/captain/captain-context";
import { inr } from "@/features/captain/earnings";

export const Route = createFileRoute("/app/trips")({
  component: TripsPage,
});

type Filter = "all" | "delivered" | "cancelled";

function TripsPage() {
  const { trips, activeTrip } = useCaptain();
  const [filter, setFilter] = useState<Filter>("all");

  const history = trips.filter((t) =>
    filter === "all" ? true : t.status === filter,
  );
  const totalEarned = trips
    .filter((t) => t.status === "delivered")
    .reduce((sum, t) => sum + t.payout.net, 0);

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-28 lg:pb-10">
      <PageHeader title="My trips" subtitle={`${trips.length} trips · ${inr(totalEarned)} earned`} back={false} />

      <div className="px-4 pt-4 sm:px-6">
        {/* Active trip */}
        {activeTrip && (
          <Link
            to="/app/trip/$id"
            params={{ id: activeTrip.id }}
            className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Navigation2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Trip in progress</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeTrip.pickup.city} → {activeTrip.drop.city}
              </p>
            </div>
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
              Resume
            </span>
          </Link>
        )}

        {/* Filter chips */}
        <div className="mb-3 flex gap-2">
          {(["all", "delivered", "cancelled"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        {/* List */}
        {history.length > 0 ? (
          <div className="space-y-2.5">
            {history.map((t) => (
              <TripRow key={t.id} trip={t} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <RouteIcon className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">No trips here yet</p>
            <p className="text-xs text-muted-foreground">
              Go online from the dashboard to start accepting loads.
            </p>
            <Link
              to="/app"
              className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Go to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
