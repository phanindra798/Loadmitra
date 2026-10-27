import { Link } from "@tanstack/react-router";
import { useCaptain } from "@/features/captain/captain-context";

export function TripSyncStatus() {
  const { authenticated, tripsLoading, tripsError, refreshTrips } = useCaptain();
  if (!authenticated) return <p className="mb-3 rounded-xl border border-border bg-card p-3 text-sm"><Link to="/login" className="font-semibold underline">Sign in</Link> to load your trips.</p>;
  if (tripsLoading) return <p role="status" className="mb-3 p-3 text-sm text-muted-foreground">Loading your saved trips…</p>;
  if (!tripsError) return null;
  return <div role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-card p-3 text-sm">
    <p>Could not refresh trips. {tripsError}</p>
    <button type="button" onClick={refreshTrips} className="mt-2 font-semibold underline">Retry</button>
  </div>;
}
