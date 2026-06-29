import { useCallback, useState } from "react";
import { readJSON, writeJSON } from "@/lib/storage";

export interface GeoPlace {
  label: string; // short label, e.g. "HITEC City" or the city
  address: string; // fuller address line
  city: string;
  lat: number;
  lon: number;
}

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "error" | "unsupported";

const LAST_KEY = "lm-geo";

/** Best-effort reverse geocode with no API key; falls back to raw coordinates. */
async function reverseGeocode(lat: number, lon: number): Promise<GeoPlace> {
  const coords = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  const fallback: GeoPlace = { label: "Current location", address: coords, city: "Current location", lat, lon };
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (!res.ok) return fallback;
    const d: {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
    } = await res.json();
    const city = d.city || d.locality || d.principalSubdivision || "Current location";
    const label = d.locality || d.city || city;
    const address = [d.locality, d.city, d.principalSubdivision].filter(Boolean).join(", ") || coords;
    return { label, address, city, lat, lon };
  } catch {
    return fallback;
  }
}

/**
 * Wraps the browser Geolocation API into a request-on-demand hook.
 * `locate()` prompts for permission, resolves to a reverse-geocoded place (or
 * null on failure), and caches the last good fix so other screens can reuse it.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [place, setPlace] = useState<GeoPlace | null>(() => readJSON<GeoPlace | null>(LAST_KEY, null));

  const locate = useCallback((): Promise<GeoPlace | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return Promise.resolve(null);
    }
    setStatus("locating");
    return new Promise<GeoPlace | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const resolved = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          setPlace(resolved);
          writeJSON(LAST_KEY, resolved);
          setStatus("ready");
          resolve(resolved);
        },
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }, []);

  return { status, place, locate };
}
