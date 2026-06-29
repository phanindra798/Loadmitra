/**
 * Cross-portal links. LoadMitra ships as two independent apps — this Shipper
 * portal and the Captain portal (the repo's `captain/` app). They run as
 * separate deployments, so navigation between them is a hard URL, not a
 * client-side route.
 *
 * Override per environment with Vite env vars (set in `.env`):
 *   VITE_SHIPPER_PORTAL_URL=https://app.loadmitra.com
 *   VITE_CAPTAIN_PORTAL_URL=https://captain.loadmitra.com
 *
 * Defaults target the local dev ports: shipper on 8080, captain on 8081.
 */
export const SHIPPER_PORTAL_URL =
  import.meta.env.VITE_SHIPPER_PORTAL_URL ?? "http://localhost:8080";

export const CAPTAIN_PORTAL_URL =
  import.meta.env.VITE_CAPTAIN_PORTAL_URL ?? "http://localhost:8081";
