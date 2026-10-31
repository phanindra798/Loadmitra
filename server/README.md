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

## Authentication changes — 25 October 2026

Local development now generates a six-digit challenge, stores only its HMAC, and returns `devOtp` for display on the login screen. Arbitrary codes no longer work. Codes expire after `OTP_TTL_SECONDS` (default 300), allow five verification attempts, and are consumed atomically before issuing a session. Resending invalidates the previous challenge. Existing legacy OTP records cannot authenticate; request a new code.

Production login OTP send and verify return HTTP 503 until an SMS delivery adapter is implemented. Do not deploy with `NODE_ENV=development` to bypass this restriction. Production SMS, country-code identity normalization, and browser session hardening remain outstanding. Shipment handover codes are a separate, authenticated flow described below.

Run `npm test` for the backend regression suite using synthetic persistence and local HTTP requests. The separate `npm run test:integration` suite verifies captain acceptance and lifecycle behavior against a temporary real MongoDB instance (instructions below). Neither suite connects to Atlas; production and browser end-to-end checks remain outstanding.

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

All endpoints require a captain session. Load offers and trip history come from MongoDB; the legacy profile endpoint still contains demo data. Earnings now use saved delivery estimates, as described below.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/captain/me` | — | authenticated captain profile and completed-delivery count |
| PATCH | `/api/captain/vehicle` | `{ vehicleNumber, truckTypeId, city }` | save own self-reported vehicle |
| GET | `/api/captain/requests` | — | load offers (job board) |
| POST | `/api/captain/requests/:id/accept` | — | accept an offer → started `Trip` (201) |
| GET | `/api/captain/trips` | — | latest 100 trips plus a separate active trip |
| GET | `/api/captain/trips/:id` | — | assigned captain only; direct recovery of any owned trip |
| POST | `/api/captain/trips/:id/status` | `{ status, otp? }` | Assigned captain only; valid transition required. `picked`/`delivered` verify a six-digit handover code issued to the booking owner. |
| GET | `/api/captain/earnings` | — | earnings summary + ledger |
| POST | `/api/captain/earnings/quote` | `{ truckTypeId, mode, distanceKm?/cities, loadWeightKg? }` | captain payout for a load (fare − commission + incentive) |

The customer fare uses the **same** market-range formula on both sides (shared `data/trucks.ts` rate card); the captain payout layers commission + return/shared incentive on top (`services/earnings.service.ts`).

## Roadmap
- **Phase 2 (in progress)** — catalogue, pricing, captain read endpoints **done** (above), served from seed. Remaining: shipper `bookings` create/list, captain `online` toggle, **persist** Load/Booking/Trip/CaptainProfile to Mongo, frontends swap mock data → React Query.
- **Phase 3** — Socket.IO (matching/tracking/chat), real geocoding, SMS OTP.
- **Phase 4** — auth hardening, indexes, rate-limit, tests, deploy (Atlas + Render/Railway).

## Booking changes — 25 October 2026

`POST /api/bookings` and `GET /api/bookings/:id` now require a shipper session. Creation stores the authenticated owner, calculates the fare and validates truck capacity. Booking IDs must match `LM-` followed by 6–64 letters, digits or hyphens; the frontend uses a UUID. A retry with the same owner, ID and load details preserves the existing record. A conflicting ID returns 409.

`POST /api/bookings/:id/cancel` cancels an owned booking before pickup. Captain acceptance claims only an open, owned booking atomically; unavailable loads return 409. Trip status changes require the assigned captain and a valid transition. `GET /api/captain/trips` now returns that captain's stored trips. Ownerless legacy demo bookings are intentionally excluded; no migration or deletion is performed.

The earlier seed-data roadmap above is historical. The job board now contains only persisted loads. Self-reported captain vehicle registration is described below; document verification remains unfinished. One-active-trip enforcement is described below. Shipper history restoration is described below. Do not treat these changes as production readiness.

## Shipment handover verification — 26 October 2026

`POST /api/bookings/:id/handover-otp` requires the owning shipper's session. At `at_pickup` it issues a pickup code (`stage: picked`); at `enroute_drop` it issues a delivery code (`stage: delivered`). Other stages and cancelled bookings reject issuance. The response is `{ data: { code, stage, expiresAt } }` with `Cache-Control: no-store`.

Codes are cryptographically random six-digit values, valid for ten minutes. Only a keyed hash bound to the booking and handover stage is stored. Verification reserves one of five attempts with a conditional database update. A correct code advances the trip and removes the challenge atomically; replay, expiry, regeneration and concurrent state changes cannot reuse it. Cancellation also removes the challenge. Ordinary booking and captain responses do not return codes or hashes.

The shipper generates a code from the tracking screen and shares it only at the physical handover. Codes are kept only in screen memory; after leaving the screen, generate a replacement. Regeneration has a database-enforced 30-second cooldown, plus a per-owner/booking limit of five issuance requests per ten minutes. The latter uses the existing single-process limiter; multi-instance hosting needs a shared rate-limit store. A new challenge resets its attempt budget and replaces the old code. No SMS is sent by this flow.

The captain screen accepts six digits and waits for successful verification before clearing the input or advancing. Cancellation also awaits confirmation and is unavailable after pickup. Existing accepted bookings can obtain a challenge at the appropriate stage without a migration; old four-digit demo codes no longer work. Roll out the API and both portals together.

Validation: 52 backend tests pass, including 17 new handover cases covering ownership, expiry, lockout, replay, concurrency, stage isolation and HTTP authentication. Persistence is mocked; real MongoDB concurrency and browser end-to-end validation remain outstanding. Both frontend type checks and production builds pass.

## Shipper booking recovery — 26 October 2026

- `GET /api/bookings?limit=50&before=<cursor>` returns `{ data, nextCursor }`. It requires a shipper session, always filters by the authenticated owner, and sorts by descending MongoDB `_id`. Limits are 1–100 (default 50); cursors must be 24-character hexadecimal IDs. The compound `{ shipperId: 1, _id: -1 }` index supports these reads. Each page is bounded; the UI offers older pages explicitly.
- `GET /api/bookings/:id` now returns the full owned booking: route, shipment, agreed fare, saved price breakdown if available, lifecycle, captain snapshot and timestamps. Direct links work independently of the currently loaded history page. Creation and cancellation return the same public representation. Private owner/fingerprint fields and handover challenges are excluded; responses use `Cache-Control: no-store`.
- New bookings save a server-calculated price snapshot on insert. Retries preserve it and the agreed fare. Legacy bookings retain their original agreed fare without recalculation; the UI identifies unavailable itemized breakdowns. No legacy records are rewritten.
- The shipper app starts with empty history and loads stored bookings. Tracking and matching URLs fetch their own record and poll while active. Sample history is no longer shown. Loading, empty, authentication and network-error states are distinct, with retry and pagination controls. Slow responses merge without undoing newer trip progress.
- Booking state is cleared and outstanding reads aborted when the session changes or is removed, including storage/focus notifications from another tab. Booking records are not persisted in browser cookies or localStorage. The unfinished booking draft still lives only in memory.
- Verification: 63 backend tests (11 new history cases), nine frontend record-recovery tests, and the shipper TypeScript/production build. Database calls are stubbed in tests; browser refresh/account-switch flows against a real MongoDB instance still need live validation. Deploy the API before or together with this frontend because it requires the expanded booking responses.


## One active trip per captain — 27 October 2026

Captain acceptance now waits for the unique partial MongoDB index `one_active_trip_per_captain`. It indexes `acceptedByCaptainId` for accepted bookings in any active stage, including legacy bookings with a missing/null `tripStatus`. Concurrent claims of different loads by one captain return one 201 and 409 `ACTIVE_TRIP_EXISTS` for the losers; different captains can still claim different loads. This applies to all booking modes: shared loads currently represent one booking, not multi-booking route pooling.

Successful delivery or either authorized pre-pickup cancellation removes the booking from the partial index in the same write. Historical captain ownership remains intact, and incorrect handover codes do not free the slot. There is no separate lock document that can be left behind by a process crash. The captain UI also suppresses overlapping acceptance requests from the same screen.

The API installs the index at startup and awaits it before accepting loads, including with Mongoose `autoIndex` disabled. Readiness is cleared on database disconnection and failed builds can retry. Use a MongoDB version supporting `$in` in [partial index filters](https://www.mongodb.com/docs/manual/core/index-partial/); integration tests run on MongoDB 8.0. The database account needs index-creation permissions. Do not remove this index while the API is running.

If existing data has two active bookings assigned to the same captain, index creation fails and new acceptance returns 503. Existing bookings remain readable and valid completion/cancellation operations remain available. No booking is automatically cancelled, deleted or reassigned. Review conflicting bookings, resolve them through valid lifecycle operations, then retry installation/acceptance. `/health` is still a liveness endpoint, not proof that acceptance is ready.

Read-only duplicate check in MongoDB Compass/mongosh:

```javascript
db.bookings.aggregate([
  { $match: {
    status: "accepted",
    acceptedByCaptainId: { $type: "string" },
    tripStatus: { $in: [null, "accepted", "enroute_pickup", "at_pickup", "picked", "enroute_drop"] }
  } },
  { $group: { _id: "$acceptedByCaptainId", bookingIds: { $push: "$bookingId" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

Run `npm test` for 69 backend regression tests. The separate `npm run test:integration` suite starts an isolated local `mongod` on a temporary loopback port with synthetic records, tests real HTTP requests and database constraints, and shuts it down/removes the temporary data afterward. It does not use `.env` database credentials or your existing MongoDB service. An installed MongoDB executable is required; no binary is downloaded automatically.

PowerShell example from `server`:

```powershell
$env:MONGOD_BINARY = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe"
npm run test:integration
```

On Linux/macOS, put `mongod` on PATH or set `MONGOD_BINARY` to its absolute path. The 12 integration tests cover concurrent acceptance, every active stage, verified delivery, both cancellation paths, authorization, legacy records, direct-write enforcement and index-build conflict recovery. These are API/database integration checks; browser flows and production database/index readiness still require deployment validation.


## Captain recovery and account isolation — 27 October 2026

- Captain trip state now lives in a private query cache per browser session. Login, logout, another tab's storage event and window focus trigger session checks. Switching sessions remounts the store, cancels reads and pending mutations, clears the previous cache, and resets local online/offers state. Delayed old-account responses are discarded and cannot log out a newer account. Current-session 401/403 responses from protected captain endpoints clear the stale token.
- Trips refresh every three seconds while the app is active, independently of profile, offers and earnings. Profile/earnings failures no longer block recovery. Shipper cancellation and other-device progress arrive through these reads. Read failures show a retry message instead of pretending the account has no trips; mutations still require server confirmation.
- The recent-history endpoint keeps the compatible `data` array (at most 100 records) and adds `activeTrip`, even if its booking was created before the current history window. A compound captain/creation-date index supports history reads. The new owner-scoped detail endpoint lets saved links recover older trips directly. Both responses use `Cache-Control: no-store` and exclude ownership internals and handover secrets.
- Trip responses include creation/update timestamps. List, detail and successful mutation records merge without undoing newer progress. When concurrent history/active reads return different stages, the newer record wins. Lifecycle mutations now return the full saved trip rather than only its ID/status; the client refreshes both caches from that response.
- The trip page distinguishes loading, missing/unauthorized and temporary failure states, and resets OTP input when the trip/stage changes. Actions target the visible trip ID. Dashboard offers wait until initial trip recovery completes.
- The captain name comes from the signed-in account. Phone-derived demo vehicles, ratings and KYC badges are no longer used by the captain context; unknown vehicle/KYC values remain unregistered/unverified. Later sections describe saved vehicle registration and persisted delivery estimates; document verification and payment settlement remain unfinished. Token storage and server-side session revocation still need further hardening.

Current checks: 69 backend regression tests, 16 real-MongoDB API integration tests, and 16 captain frontend record/session tests (`cd captain/frontend` then `npm test`). Captain TypeScript and production builds pass. Focused lint has no errors and two Fast Refresh export warnings. These checks do not cover complete browser journeys or a production deployment.

Roll out the updated API before or together with this captain frontend: it needs direct-trip reads and complete mutation responses. Changes remain local and uncommitted, alongside the single-active-trip constraint. No deployment or push has been performed.


## Local browser verification — 27 October 2026

`npm run test:browser` now verifies captain recovery through an installed Chrome/Edge browser, the local API and isolated MongoDB. The scenario passed refresh recovery, a persisted lifecycle action, shipper cancellation, account switching in one and two tabs, old direct links, logout, and retry after a simulated API failure. It recorded zero uncaught browser exceptions.

The first run revealed missing pickup/drop-off details on the active-trip screen. The screen now shows the saved addresses and booking ID. See [BROWSER_VERIFICATION.md](BROWSER_VERIFICATION.md) for evidence, reproduction commands and coverage limits. These local browser checks replace the earlier outstanding recovery/account-switch checks; SMS login and production deployment validation remain pending. Changes remain uncommitted and unpushed.


## Saved captain earnings estimates — 28 October 2026

`GET /api/captain/earnings` is now asynchronous, owner-scoped and uncached. It includes only that captain's delivered, non-cancelled bookings. The response keeps `today`, `week`, `month`, `tripsToday`, `incentiveThisWeek` and `ledger`, and adds `timeZone`, `weekly` (seven daily values), and `unknownCompletionTrips`. Online hours and acceptance rate return `null` because they are not measured.

A successful delivery-code verification writes `completedAt` and `payoutSnapshot` in the same conditional update that changes the trip to delivered and consumes the code. Failed verification and repeated completion cannot create earnings. Periods use the saved completion date, never `updatedAt`: today, Monday–Sunday and the calendar month are calculated in `Asia/Kolkata`. Later record changes do not alter a saved payout. Values are estimates, not a payment balance or proof of settlement.

The summary aggregates all qualifying deliveries, independent of the 100-trip history limit, with bounded daily groups and the latest 20 ledger entries. A compound owner/lifecycle/completion-date index supports the query, and aggregation has a five-second execution limit. Database failures produce an error rather than fabricated zero totals.

Existing delivered records are not backdated or rewritten. If a completion date or payout snapshot was never saved, the record is excluded from dated totals and counted in `unknownCompletionTrips`. Recent legacy entries remain visible; where a snapshot is absent, their estimate is explicitly labelled as calculated using current payout rules. Completion time cannot be reliably reconstructed from a general modification timestamp.

Fare, commission and incentives are rounded to whole rupees before net is calculated, so displayed components add up exactly. For example, a ₹2,050 full-load fare has ₹308 commission and ₹1,742 estimated net. Commission/incentive percentages are unchanged, and already saved payout snapshots remain authoritative.

The captain UI uses server totals without adding session-only earnings. It refreshes after delivery, on focus, and periodically, with loading/error/retry states. It replaces sample chart data, the fixed `+12%` badge and the unimplemented ₹500 bonus offer with saved estimates. Untracked statistics are labelled accordingly. Deploy the updated API before or with this frontend; only subsequent verified deliveries gain completion metadata automatically.

Validation: 75 backend regression tests, 24 isolated MongoDB integration tests and 18 frontend tests pass, covering rounding, IST boundaries, owner isolation, more than 100 completed records, legacy data and exactly-once delivery recording. The browser suite also exercises delivery verification and saved earnings across refresh/account changes; see `BROWSER_VERIFICATION.md` for its final result. Changes in this earnings batch remain local and uncommitted.


## Captain vehicle registration — 28 October 2026

- `GET /api/captain/me` reads the signed-in captain from MongoDB instead of returning a sample profile. It includes masked phone, joined month and owner-scoped completed-delivery count. Ratings are untracked and KYC remains false.
- `PATCH /api/captain/vehicle` accepts only `vehicleNumber`, `truckTypeId` and `city`. The number is uppercased and spaces/hyphens removed, then checked for 6–15 alphanumeric characters containing a letter and digit. This is format validation, not a government registration check. Truck types come from the shared catalogue; operating city is stored as self-reported text and does not provide geographic matching. Unknown fields, including identity and verification claims, are rejected. Writes are captain-only, owner-scoped and rate-limited.
- The Account page saves these fields, restores them after reload and offers retry states for profile/catalogue failures. Documents show **Not submitted**; document upload and verification are not yet available.
- Unregistered captains see no offers and receive `409 VEHICLE_REQUIRED` when attempting acceptance. Both the offer query and atomic booking claim require the exact booked truck type and a positive load weight within its catalogue capacity. A forged or stale offer cannot bypass those checks.
- Each accepted booking snapshots the vehicle read for that assignment. Subsequent profile edits apply to future assignments and do not rewrite existing trips. Existing trips remain recoverable and can progress without registering again. Vehicle ownership/uniqueness is not verified by this flow.
- Deployment: release the updated API before/with the captain frontend. Existing users need to register a vehicle before accepting new loads. No backfill of vehicle or KYC data is performed. These changes remain local pending commit/push review.
- Validation: 75 backend regression tests, 32 isolated MongoDB integration tests, 18 frontend tests and a browser scenario with 13 checkpoints passed. The browser saves a vehicle, reloads, checks MongoDB and historical trip snapshots, and switches accounts. TypeScript and the captain production build pass. Focused correctness lint has no errors and two existing Fast Refresh warnings; formatting is checked for the new component, while existing files retain their formatting.

## Token validation — 30 October 2026

Protected API routes now reject signed tokens missing a nonempty account ID, a supported role or an expiry. Verification accepts only HS256, matching application-issued tokens. Only account ID and role are attached to the request, and protected responses use `Cache-Control: no-store`, including authentication failures. Existing application-issued bearer and cookie tokens remain compatible; an invalid bearer cannot fall back to a valid cookie.

Validation: 84 backend regression tests (including nine new token tests) and 32 isolated MongoDB integration tests passed. This does not implement token revocation or production SMS delivery. Changes are local pending review and are not deployed.

## Review fixes — 30 October 2026

- Shipper cancellation now also accepts legacy accepted bookings whose `tripStatus` is stored as `null`. The active-trip index already counted these as active, so before this fix such a captain stayed blocked until the captain cancelled.
- `distanceKm` is capped at 5,000 km on booking creation, the shipper estimate and the captain quote. Before this fix a client could store an arbitrarily large distance and fare.
- Both portals' ESLint configs now ignore `.vercel`, `.tanstack` and `.nitro` build output. Before this, `npm run lint` hung for more than 10 minutes on bundled files.

Validation: 85 backend regression tests, 33 isolated MongoDB integration tests and 27 frontend tests pass. Frontend lint has no errors.

## Server-side booking distance — 30 October 2026

`POST /api/bookings` now derives `distanceKm` on the server from the pickup and drop places (city, falling back to label), using the same deterministic estimate the shipper app shows. A client-supplied `distanceKm` is accepted for older clients but ignored, so a shipper can no longer shorten the route to lower the fare. Real geocoding is still pending.

Validation: backend regression tests cover client distances of 1 km, 1e9 km and none, plus the label fallback.
