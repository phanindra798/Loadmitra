import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { captainApi } from "@/lib/api";
import type { CaptainProfile } from "@/features/captain/types";
import { Button } from "@/components/ui/button";

export function VehicleRegistration({ profile }: { profile: CaptainProfile }) {
  const client = useQueryClient();
  const [vehicleNumber, setVehicleNumber] = useState(
    profile.truckTypeId ? profile.vehicleNumber : "",
  );
  const [truckTypeId, setTruckTypeId] = useState(profile.truckTypeId);
  const [city, setCity] = useState(profile.city);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const trucks = useQuery({
    queryKey: ["truck-catalogue"],
    queryFn: ({ signal }) => captainApi.trucks(signal),
    staleTime: 60000,
  });
  const plate = vehicleNumber.toUpperCase().replace(/[\s-]/g, "");
  const valid =
    /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6,15}$/.test(plate) &&
    city.trim().length >= 2 &&
    Boolean(trucks.data?.some((t) => t.id === truckTypeId));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!valid || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setError(null);
    try {
      const saved = await captainApi.saveVehicle(
        { vehicleNumber: plate, truckTypeId, city: city.trim() },
        controller.signal,
      );
      await client.cancelQueries({ queryKey: ["captain-account"] });
      await client.cancelQueries({ queryKey: ["captain-offers"] });
      if (controller.signal.aborted) return;
      // Remove offers for the previous truck before refreshing matching loads.
      client.setQueryData(["captain-offers"], []);
      client.setQueryData(["captain-account"], saved);
      void client.invalidateQueries({ queryKey: ["captain-offers"] });
      toast.success("Vehicle saved");
    } catch (failure) {
      if (
        !controller.signal.aborted &&
        !(failure instanceof Error && failure.name === "AbortError")
      )
        setError(failure instanceof Error ? failure.message : "Could not save vehicle");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  const inputClass =
    "mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground";
  return (
    <form onSubmit={save} className="space-y-3">
      {profile.truckTypeId && (
        <p className="text-sm font-semibold">Saved vehicle: {profile.vehicleNumber}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Register your vehicle to receive matching loads. Changes apply to future trips; current
        trips keep the vehicle recorded when accepted.
      </p>
      {trucks.isError ? (
        <div role="alert" className="text-sm">
          Could not load truck types.{" "}
          <Button type="button" variant="outline" onClick={() => void trucks.refetch()}>
            Retry truck types
          </Button>
        </div>
      ) : null}
      <fieldset disabled={saving || trucks.isPending || trucks.isError} className="space-y-3">
        <div>
          <label htmlFor="vehicle-number" className="text-sm font-semibold">
            Vehicle registration number
          </label>
          <input
            id="vehicle-number"
            value={vehicleNumber}
            maxLength={30}
            required
            onChange={(event) => setVehicleNumber(event.target.value)}
            placeholder="TS09AB1234"
            autoCapitalize="characters"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="vehicle-type" className="text-sm font-semibold">
            Truck type
          </label>
          <select
            id="vehicle-type"
            value={truckTypeId}
            required
            onChange={(event) => setTruckTypeId(event.target.value)}
            className={inputClass}
          >
            <option value="">
              {trucks.isPending ? "Loading truck types…" : "Choose truck type"}
            </option>
            {trucks.data?.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.name} — up to {truck.capacityKg.toLocaleString("en-IN")} kg
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vehicle-city" className="text-sm font-semibold">
            Operating city
          </label>
          <input
            id="vehicle-city"
            value={city}
            required
            minLength={2}
            maxLength={80}
            onChange={(event) => setCity(event.target.value)}
            className={inputClass}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Vehicle details are self-reported. Document verification is not available yet.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!valid || saving}>
          {saving ? "Saving vehicle…" : "Save vehicle"}
        </Button>
      </fieldset>
    </form>
  );
}
