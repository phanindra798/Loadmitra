# LoadMitra

India-first freight marketplace connecting **Shippers** with **Captains** (truck drivers/owners) — full loads, shared loads, and discounted return loads, with live tracking and transparent per-tonne price estimates.

The repo is organized as **two frontends backed by one shared API**:

```
LoadMitra/
├── shipper/frontend/        # The shipper (customer) portal — book & track trucks
│   └── src/                 #   TanStack Start + React + Vite + Tailwind  → :8080
│       ├── routes/          #     landing, /login, /app/* (home, search, quote, matching, track…)
│       ├── components/app/  #     MapCanvas, PriceRangeCard, CaptainCard, …
│       ├── features/shipper #     types, pricing, i18n, mock data, booking context
│       ├── lib/api.ts       #     thin client → the shared API (:4000)
│       └── lib/portals.ts   #     cross-links to the captain portal
│
├── captain/frontend/        # The captain (driver/owner) portal — get loads & earn
│   └── src/                 #   Same stack as shipper                      → :8081
│       ├── routes/          #     landing, /login, /app/* (dashboard, trip, trips, earnings, account)
│       ├── components/app/  #     RequestCard, PayoutCard, OnlineToggle, CustomerCard, …
│       ├── features/captain #     types, earnings, i18n, mock data, captain context
│       ├── lib/api.ts       #     thin client → the shared API (:4000)
│       └── lib/portals.ts   #     cross-links to the shipper portal
│
└── server/                  # ONE shared API for both portals  → :4000
    └── src/                 #   Node + Express + TypeScript + MongoDB (Zod)
        #   /health, /api/auth/*, /api/trucks, /api/pricing/estimate, /api/captain/*
```

Both frontends point at the shared API via `VITE_API_URL` (defaults to `http://localhost:4000`);
the server's CORS allows both web origins (`:8080`, `:8081`).

The two portals are deployed separately and link to each other by URL (configurable via
`VITE_SHIPPER_PORTAL_URL` / `VITE_CAPTAIN_PORTAL_URL`; defaults point at the dev ports
above). In the shipper app, every "Become a captain" call-to-action opens the captain
portal; the captain app likewise links back for shippers.

## Quick start

Install everything from the repo root, then run the pieces you need:

```bash
npm run install:all        # installs both frontends + the server

npm run dev:api            # shared API       → http://localhost:4000   (run this first)
npm run dev                # shipper web app  → http://localhost:8080
npm run dev:captain        # captain web app  → http://localhost:8081
```

Each piece can also be run on its own, e.g. `cd captain/frontend && npm install && npm run dev`.
Copy `server/.env.example` to `server/.env` (set `MONGODB_URI`) to configure the API / CORS origins.

## Status

- **Shipper portal** — Rapido-style map-first home, location search, truck + **per-tonne**
  price estimate (full / shared / return), captain matching, live tracking, bookings,
  offers, account. Responsive, light/dark, **6 languages**.
- **Captain portal** — Driver dashboard with an online/offline switch, live incoming load
  requests (accept/skip with a countdown), an OTP-verified trip flow (head to pickup →
  load → drive → deliver), trip history, an earnings dashboard (today/week/month, payout
  breakdown, incentives), and an account/KYC screen. Same design system, responsive,
  light/dark, 6 languages.
- **Shared API (`server/`)** — one Express + TypeScript + MongoDB service for both portals:
  phone-OTP auth (JWT + httpOnly cookie), the shared truck catalogue, shipper pricing, and the
  captain set (profile, load requests, accept, trip status, earnings/quote) — formulas match the
  frontends. Matching/tracking sockets and payments are later phases (see the master spec).

The captain payout = customer fare − platform commission + return/shared incentive, computed
from the same rate card the shipper sees.

Money is **not** handled in-app in this version — prices are negotiable estimates settled offline.
