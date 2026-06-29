# LoadMitra API (`server/`)

One shared **Express + TypeScript + MongoDB** API for **both** portals (shipper :8080 and captain :8081). A single database lets a shipper's booking be matched, tracked, and chatted about by a captain.

## Run

```bash
cd server
npm install
cp .env.example .env          # then paste your MongoDB Atlas URI into MONGODB_URI
npm run dev                   # http://localhost:4000  (tsx watch)
```

`npm run typecheck` to type-check, `npm run build` + `npm start` for production.

### MongoDB Atlas
Atlas → **Database → Connect → Drivers** → copy the `mongodb+srv://…` string into `MONGODB_URI` (add a DB name, e.g. `…mongodb.net/loadmitra?…`). Allow your IP under **Network Access**.

## Auth API (Phase 1)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/health` | — | liveness |
| POST | `/api/auth/send-otp` | `{ phone, role }` | `role` = `shipper`\|`captain`. Returns `{ sent, devOtp }` in dev (the OTP, since SMS is a later phase). |
| POST | `/api/auth/verify-otp` | `{ phone, role, otp, name?, email?, dialCode? }` | Verifies the code, finds-or-creates the user, returns `{ token, user }` and sets an httpOnly `lm_token` cookie. A new number with no `name` returns **409 `registration_required`** — collect a name and retry. |
| GET | `/api/auth/me` | — (Bearer/cookie) | current user |
| PATCH | `/api/auth/me` | `{ name?, email? }` | update profile |
| POST | `/api/auth/logout` | — | clears the cookie |

Send the token as `Authorization: Bearer <token>` (or rely on the cookie).

## Catalogue + pricing (Phase 2)

Shared by both portals. Pure compute over the rate card in `data/trucks.ts` — no DB needed.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/trucks` | — | truck catalogue (`{ data: TruckType[] }`) |
| POST | `/api/pricing/estimate` | `{ truckTypeId, mode, distanceKm? , pickupCity?, dropCity?, loadWeightKg? }` | shipper market-range estimate. Give `distanceKm`, or both cities (falls back to a deterministic distance until geocoding lands). `mode` = `full`\|`shared`\|`return`. |

## Captain API (Phase 2)

Served from in-memory seed data (`data/captain.ts`) — same response shapes the DB collections will return later. Currently ungated (the captain frontend isn't sending tokens yet); add `requireAuth` once it does.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/captain/me` | — | captain profile |
| GET | `/api/captain/requests` | — | load offers (job board) |
| POST | `/api/captain/requests/:id/accept` | — | accept an offer → started `Trip` (201) |
| GET | `/api/captain/trips` | — | trip history |
| POST | `/api/captain/trips/:id/status` | `{ status, otp? }` | advance lifecycle. 4-digit `otp` required for `picked`/`delivered`. |
| GET | `/api/captain/earnings` | — | earnings summary + ledger |
| POST | `/api/captain/earnings/quote` | `{ truckTypeId, mode, distanceKm?/cities, loadWeightKg? }` | captain payout for a load (fare − commission + incentive) |

The customer fare uses the **same** market-range formula on both sides (shared `data/trucks.ts` rate card); the captain payout layers commission + return/shared incentive on top (`services/earnings.service.ts`).

## Roadmap
- **Phase 2 (in progress)** — catalogue, pricing, captain read endpoints **done** (above), served from seed. Remaining: shipper `bookings` create/list, captain `online` toggle, **persist** Load/Booking/Trip/CaptainProfile to Mongo, frontends swap mock data → React Query.
- **Phase 3** — Socket.IO (matching/tracking/chat), real geocoding, SMS OTP.
- **Phase 4** — auth hardening, indexes, rate-limit, tests, deploy (Atlas + Render/Railway).
