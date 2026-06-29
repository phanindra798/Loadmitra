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
  // Pin shipper to 8080 with strictPort. Without this, a second shipper instance
  // (8080 already taken) silently drifts onto 8081 — squatting the captain port
  // and breaking the captain portal handoff. Fail loudly instead.
  vite: {
    server: { port: 8080, strictPort: true },
    preview: { port: 8080, strictPort: true },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
