# LoadMitra review — 25 October 2026

This document preserves the original audit baseline. Several findings have since been addressed; see [TODAY_PROGRESS.md](TODAY_PROGRESS.md) for completed work and current limitations.

## Scope and baseline

Reviewed the repository inventory, backend handlers/models/services, frontend booking and trip flows, session handling, configuration, and supporting screens. Inventory: 246 tracked files (107 shipper, 105 captain, 31 server, 3 root). Generated dependencies and build output were excluded from source review; reusable UI wrappers were considered as a group. This is not a claim of exhaustive browser or production validation.

GitHub: https://github.com/phanindra798/Loadmitra. Local HEAD and GitHub main both point to `dcc6d5f73026d9464880d68a631c399123431285`. GitHub showed one branch, no returned PRs, and no Actions runs. The 128 existing modified files have no differences when line endings are ignored. Application source was not changed during this review.

## Architecture understood

- Shipper: React 19, TanStack Start/Router/Query, TypeScript, Vite, Tailwind and Radix UI. Routes cover login, location search, quote, matching, tracking, bookings, offers and account.
- Captain: the same frontend stack, with dashboard, requests, active trip, history, earnings and account.
- Shared API: Express 4, Zod, Mongoose/MongoDB, JWT and cookies. Models currently cover users, OTP records and bookings. The OTP model is not used by the login handlers.
- Bookings bridge the portals through MongoDB and polling. React reducers still own much of the displayed state. There is no implemented socket transport, persistent chat, payment processing or actual map routing.
- Strengths worth retaining: separate role experiences, typed domain structures, Zod validation, API/app separation, role middleware, production JWT-secret validation, reusable components, and explicit pricing breakdowns.

## Verification results

| Check | Result |
| --- | --- |
| Server production build | Passed |
| Shipper production build | Passed |
| Captain production build | Passed |
| Both frontend TypeScript checks | Passed |
| Shipper source/config lint | 5,773 formatting errors; 13 refresh warnings |
| Captain source/config lint | 4,819 formatting errors; 9 refresh warnings |
| Committed tests / CI workflow files | None found |
| npm audit, production dependency graph, shipper | 15 affected package entries: 6 critical, 7 high, 1 moderate, 1 low |
| npm audit, production dependency graph, captain | Same severity totals as shipper |
| npm audit, production dependency graph, server | 7 affected package entries: 1 critical, 2 high, 4 moderate |

Lint counts are formatting diagnostics, including CRLF line endings, not thousands of functional defects. Advisory counts include transitive/inherited findings and do not prove exploitability in this application. Review affected paths and compatible fixes before upgrading; do not apply a blind forced update.

Isolated checks used synthetic data and replaced database methods. They did not connect to Atlas or modify real records. They confirmed:

1. An arbitrary six-digit login code issues a token even with NODE_ENV=production.
2. Reposting a booking ID changes an accepted booking back to open and overwrites its fare while retaining the old captain association.
3. A different captain can jump an accepted booking directly to delivered with an arbitrary four-digit OTP.
4. Accepting an already-owned/delivered booking returns 201 and an accepted trip response.
5. Updating a nonexistent trip returns 200.
6. Anonymous booking creation accepts an unknown truck type and excessive load weight.
7. An async database error in login produces an unhandled rejection and leaves the HTTP request unanswered in the isolated Express test.
8. Captain endpoints correctly return 401 without a token and 403 for a shipper token. Role checks exist; ownership checks remain missing.

Not verified: real SMS, live MongoDB connectivity, deployed cookies/CORS, full browser interactions, mobile/accessibility behavior, or production load.

## Priority fixes

### 1. Authentication and authorization

`server/src/controllers/auth.controller.ts:37` and `:57` implement demo OTP acceptance without a production guard. Implement generated, expiring, single-use codes, attempt limits and a test SMS adapter. Normalize phone numbers with country code; current lookup uses phone and role while the UI supports different countries.

`server/src/routes/index.ts:41` exposes booking creation and status reads without authentication. Bind bookings to the authenticated shipper. In `trips.controller.ts:28` and `:87`, derive captain identity from the authenticated account and enforce ownership, vehicle eligibility and valid lifecycle transitions. Never accept ratings, verification badges or captain identity as trusted client input.

Both frontend `lib/api.ts` files store the JWT through `lib/storage.ts`, which copies it into a JavaScript-readable cookie and localStorage. Choose one deliberate session design, handle expiry, add route guards and clear account-specific query state on logout. If using cookies for cross-site mutations, design CSRF protection explicitly.

### 2. Booking correctness and persistence

Replace the unrestricted booking upsert in `server/src/controllers/bookings.controller.ts:37` with creation and owner-scoped idempotency. Replays must not reopen accepted/cancelled/delivered records. Generate unpredictable IDs server-side.

Replace read-then-save acceptance with a conditional atomic update against an open booking. Return a conflict when another captain has already claimed it. Enforce active-trip limits and status transitions on the server, including pickup/drop OTP checks and terminal states.

Add authenticated booking history/detail/cancel endpoints and real captain trip history. Reloading currently loses newly created shipper bookings and the captain's active trip because reducers initialize from samples. The existing booking status response is too small to restore the full booking.

### 3. Honest failure behavior

`shipper/frontend/src/routes/app.quote.tsx:101` swallows booking-save errors. `app.matching.tsx:59` and `:66` invent a match after failures or roughly 20 seconds. `app.track.$id.tsx:114` simulates progress after polling failures. `captain-context.tsx:255` updates local trip state even when API writes fail.

Await authoritative mutation responses; show pending, failed and retry states. Never report accepted/delivered solely because the API is unreachable. Provide an explicit isolated demo mode if simulated behavior is still useful. Shipper cancellation must also update the server, not just local state.

### 4. One pricing and earnings model

`server/src/services/pricing.service.ts:22` uses each truck's ratePerKm; `earnings.service.ts:26` uses 13 multiplied by vehicleFactor. At 100 km for a full Tata Ace load, the shipper fare is INR 2,050 but the captain's underlying fare is INR 1,550, before commission. This contradicts the documentation's shared-fare claim.

Compute an authoritative quote, store its version and agreed amount with the booking, and derive payout from that amount. Validate capacity and truck IDs server-side. Keep currency in integer minor units and test rounding and all modes. Remove the earnings screen's automatic five-second balance increases (`captain/frontend/src/routes/app.earnings.tsx:52`); calculate totals from persisted completed trips and ledger entries.

### 5. Error handling and maintainability

Wrap Express 4 async handlers so rejected promises reach error middleware. Preserve appropriate 400/404/409/503 responses. Add database readiness, bounded request timeouts, structured logs and graceful shutdown.

Normalize line endings in a separate cleanup change, add repeatable lint/typecheck/test/build commands and CI. Review dependency advisories, including TanStack/serialization and server transitive dependencies. There are 62 identical frontend source files and 46 UI wrapper files per portal: share domain contracts and pricing first, then reusable UI where useful. A monorepo with a shared API is sufficient; microservices are not currently justified.

## Features that remain demonstrations or partial implementations

| Feature | Present behavior | Next improvement |
| --- | --- | --- |
| Maps | SVG illustration | Coordinates, real map and route polyline |
| Distance | Known-city table plus string hash | Road-distance service with caching |
| Tracking | Status polling, simulated map/progress | Authenticated GPS updates, freshness indicators and reconnect recovery |
| Matching | Open loads plus seed offers | Availability, vehicle/capacity and geographic filtering |
| Captain identity / KYC | Phone hash selects a sample identity; hardcoded verification labels | Stored captain/vehicle profile and document review |
| Earnings / history | Seed responses plus session state | Persisted trips and auditable ledger |
| Chat / calling | Canned local replies and call toasts | Booking-scoped messaging and real contact integration |
| Offers | Codes displayed; action mainly changes load mode | Validated promotions applied to a quote |
| Captain languages | Preference and html lang change; screens remain English | Translate actual screen text |
| Notifications | Preference controls | Persist preferences and deliver actual notifications |
| Payments | Intentionally offline | Optional later sandbox payment integration |

## Suggested implementation sequence

1. **Reliable foundation:** targeted regression tests for the reproduced bugs; secure authentication, ownership, atomic acceptance, lifecycle rules, server pricing and async errors. Complete compatible dependency fixes and CI.
2. **One real complete journey:** shipper login → quote → persisted booking → actual captain acceptance → verified pickup → verified delivery → history and earnings. Refresh both portals at every stage; also test cancellation, API failure and two captains competing for one load.
3. **Operational features:** genuine maps/routing, GPS updates, persistent chat, captain/vehicle onboarding, document review and notifications. Keep polling if it meets current needs; add sockets when justified.
4. **Freight-specific enhancements:** shared-load capacity reservation and stop planning, return-load matching by route/time window, proof of delivery, scheduled shipments, fleet/admin tools and analytics. Add payments only after booking and ledger correctness.

## Interview preparation and acceptance bar

Be able to draw and explain the request path, ownership model, booking lifecycle, fare calculation and failure handling. Prepare concrete answers for:

- Why two frontends with one API? Role-specific experiences with shared business rules and data.
- Why MongoDB? Explain the booking aggregate and access patterns, and acknowledge the relational constraints a SQL design could simplify.
- What happens when two captains accept? A conditional atomic claim and a conflict response; prove it with a concurrent test.
- What happens on retries or refresh? Owner-scoped idempotency and server-backed state restoration.
- What is authentication versus authorization? Valid identity versus permission for a particular booking.
- How are OTPs protected? Expiry, single use, attempt limits, safe storage and a delivery adapter.
- What belongs in React state versus server state? Draft/UI preferences versus durable bookings, trips and earnings.
- Why polling or sockets? Discuss current traffic, update latency, reconnect behavior and operational cost.
- How would it scale? Measure first; index queries, paginate, use a shared rate-limit store when needed and add background jobs for external integrations.

An interview-ready demo should survive refresh, wrong OTPs, invalid capacity, unauthorized access, duplicate clicks, concurrent acceptance and a temporary API outage. Show actual implemented capabilities, identify demo features clearly, and describe measured tradeoffs. Passing builds alone is not sufficient evidence that the product works end to end.
