// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Off a Lovable sandbox the wrapper skips the Nitro deploy plugin unless an
  // explicit `nitro` option is present, and its built-in default targets
  // Cloudflare — neither produces a Vercel-deployable build. Force the Vercel
  // preset so `vite build` emits .vercel/output (Build Output API). Override
  // with NITRO_PRESET to deploy elsewhere (e.g. cloudflare-module, node-server).
  nitro: { preset: process.env.NITRO_PRESET || "vercel" },
  // The captain portal runs alongside the shipper portal (which uses 8080),
  // so it gets its own dev port. Override per environment with --port if needed.
  vite: {
    // strictPort: fail loudly if 8081 is taken instead of silently drifting to
    // 8082 — the cross-portal "Become a captain" link points at :8081, so a
    // drifted port would break the handoff.
    server: { port: 8081, strictPort: true },
    preview: { port: 8081, strictPort: true },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
