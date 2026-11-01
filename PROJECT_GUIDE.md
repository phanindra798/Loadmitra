# LoadMitra: The Complete Project Guide (Beginner → Advanced)

> **Who this is for:** anyone opening this repository for the first time, including people who have never built a web app. Every section explains **what** something is, **why** it exists, and **how** it works, and points to the real file in the code.
>
> **How to read it:** Parts 1–3 need no programming knowledge. Parts 4–9 walk through the code. Parts 10–13 cover the advanced engineering decisions (security, race conditions, live updates, testing, deployment).

---

## Table of contents

1. [What is LoadMitra? (the idea)](#1-what-is-loadmitra-the-idea)
2. [The people in the system](#2-the-people-in-the-system)
3. [Core concepts you must know first](#3-core-concepts-you-must-know-first)
4. [The big picture: architecture](#4-the-big-picture-architecture)
5. [Repository tour: every folder explained](#5-repository-tour-every-folder-explained)
6. [Technology stack: what each tool is and why it was chosen](#6-technology-stack-what-each-tool-is-and-why-it-was-chosen)
7. [Running the project on your computer](#7-running-the-project-on-your-computer)
8. [The backend (server/) in depth](#8-the-backend-server-in-depth)
9. [The frontends (shipper/ and captain/) in depth](#9-the-frontends-shipper-and-captain-in-depth)
10. [A complete journey, step by step](#10-a-complete-journey-step-by-step)
11. [Pricing and earnings math, with worked examples](#11-pricing-and-earnings-math-with-worked-examples)
12. [Security, explained](#12-security-explained)
13. [Advanced engineering: races, consistency and live updates](#13-advanced-engineering-races-consistency-and-live-updates)
14. [Testing](#14-testing)
15. [Deployment and configuration](#15-deployment-and-configuration)
16. [What is real and what is still a placeholder](#16-what-is-real-and-what-is-still-a-placeholder)
17. [How to make common changes](#17-how-to-make-common-changes)
18. [Glossary](#18-glossary)

---

## 1. What is LoadMitra? (the idea)

**LoadMitra** ("Mitra" means *friend* in Hindi) is a **freight marketplace for India**. Think of it as "Uber/Rapido, but for moving goods in trucks".

- A business or person with goods to move (the **Shipper**) opens the app, enters a pickup and a drop location, picks a truck, sees a transparent price estimate, and books.
- A truck driver or owner (the **Captain**) opens a different app, goes "online", sees the loads that fit their truck, accepts one, drives to pickup, loads it, drives to drop, and delivers.
- Both sides see the same booking update **live**.

### Why does this matter?

Indian road freight has three classic problems, and LoadMitra has a feature for each:

| Problem | LoadMitra feature | Booking "mode" in code |
|---|---|---|
| Small shippers can't fill a whole truck, so they overpay | **Shared load**: pay only for your share of the truck | `"shared"` |
| Trucks drive home empty after a delivery (wasted fuel and money) | **Return load**: a discounted trip on a truck heading back anyway | `"return"` |
| Prices are opaque and negotiated by phone | **Transparent per-tonne estimate** with a low–high range | all modes |
| Normal case | **Full load**: you get the whole truck | `"full"` |

These three words, `full`, `shared` and `return`, appear all over the code (`server/src/types/index.ts`: `type BookingMode = "full" | "shared" | "return"`).

> **Money note:** this version does **not** process payments. Prices are estimates and are settled offline (cash/UPI between parties). See `README.md`.

---

## 2. The people in the system

There are exactly **two roles**, defined in `server/src/middleware/auth.ts`:

```ts
export type Role = "shipper" | "captain";
```

| Role | Who | What they can do | Their app |
|---|---|---|---|
| **shipper** | Customer with goods | Get price estimates, create bookings, track, cancel, issue handover codes | `shipper/frontend` (port **8080**) |
| **captain** | Truck driver/owner | Register vehicle, see job board, accept loads, move trip through stages, see earnings | `captain/frontend` (port **8081**) |

The **same phone number can be both** a shipper and a captain. They are treated as two separate accounts (identity = country code + phone + role).

---

## 3. Core concepts you must know first

If you are new to web development, read this section. Everything else builds on it.

### 3.1 Frontend vs backend

- **Frontend** = what runs in the user's **browser**: the screens, buttons and forms. Written in React here.
- **Backend** (also "server" or "API") = a program running on a server machine. It owns the **truth**: it stores data in a database, checks passwords, calculates prices, and refuses anything not allowed.

**Golden rule used throughout this project:** *never trust the browser.* Anyone can edit what the browser sends. So the server recalculates prices, distances and identities itself instead of accepting them from the client. You'll see this idea repeatedly.

### 3.2 API, HTTP, JSON

- The frontend talks to the backend over **HTTP**, the same protocol your browser uses for websites.
- Each request has a **method** (`GET` = read, `POST` = create/do, `PATCH` = partial update) and a **path** like `/api/bookings`.
- Data travels as **JSON**, a text format: `{ "phone": "9876543210", "role": "shipper" }`.
- The server answers with a **status code**:

| Code | Meaning | Example in LoadMitra |
|---|---|---|
| 200 | OK | Reading your bookings |
| 201 | Created | A booking was created / a load was accepted |
| 400 | Bad request (your input is wrong) | Invalid phone number |
| 401 | Not authenticated (who are you?) | No token or expired token |
| 403 | Forbidden (I know you, but you can't do this) | A shipper calling a captain endpoint |
| 404 | Not found | Booking ID doesn't exist or isn't yours |
| 409 | Conflict (the state doesn't allow this) | Load already taken by another captain |
| 429 | Too many requests | Asking for OTP too often |
| 500 | Server bug | Unexpected error |
| 503 | Temporarily unavailable | SMS not configured in production; database down |

### 3.3 Database

A **database** stores data permanently. This project uses **MongoDB**, which stores **documents** (JSON-like objects) inside **collections** (like folders). LoadMitra has four collections:

| Collection | What one document represents | File |
|---|---|---|
| `users` | An account (shipper or captain) | `server/src/models/user.model.ts` |
| `otps` | A pending login code challenge | `server/src/models/otp.model.ts` |
| `bookings` | A load: created by a shipper, accepted and driven by a captain | `server/src/models/booking.model.ts` |
| `revokedtokens` | A logged-out session, so it can't be reused | `server/src/models/revoked-token.model.ts` |

An **index** is like the index of a book: it makes lookups fast and can also **enforce rules** (for example "no two users with the same phone and role"). LoadMitra uses indexes heavily for correctness, not just speed.

### 3.4 Authentication: OTP and JWT

- **OTP (One-Time Password):** a 6-digit code. You enter your phone, the server creates a code, you type it back, and that proves you control the phone.
- **JWT (JSON Web Token):** after the OTP succeeds, the server gives you a signed "ticket" (a long string). The browser sends it with every request (`Authorization: Bearer <token>`). The server checks the signature to know who you are without asking for the OTP again. The ticket lasts 30 days.

### 3.5 Real-time updates

When a captain accepts your load, how does the shipper's screen find out? Two techniques are used together:

1. **Polling:** the browser asks "anything new?" every few seconds.
2. **Server-Sent Events (SSE):** the browser keeps one connection open and the server pushes a small message like `{"type":"booking","id":"LM-..."}` the moment something changes.

SSE is fast; polling is the safety net if SSE drops. More detail in [§13](#13-advanced-engineering-races-consistency-and-live-updates).

---

## 4. The big picture: architecture

```
     ┌─────────────────────────┐        ┌─────────────────────────┐
     │  SHIPPER PORTAL (web)   │        │  CAPTAIN PORTAL (web)   │
     │  shipper/frontend       │        │  captain/frontend       │
     │  localhost:8080         │        │  localhost:8081         │
     │  React + TanStack Start │        │  React + TanStack Start │
     └───────────┬─────────────┘        └────────────┬────────────┘
                 │  HTTPS + JSON (fetch)              │
                 │  + live SSE stream /api/events     │
                 └──────────────┬─────────────────────┘
                                ▼
                 ┌─────────────────────────────────┐
                 │   SHARED API  (server/)         │
                 │   Node.js + Express + TypeScript│
                 │   localhost:4000                │
                 │   validation (Zod), auth (JWT), │
                 │   pricing, trip state machine,  │
                 │   live events                   │
                 └──────────────┬──────────────────┘
                                ▼ Mongoose
                 ┌─────────────────────────────────┐
                 │   MongoDB (Atlas or local)      │
                 │   users · otps · bookings ·     │
                 │   revokedtokens                 │
                 └─────────────────────────────────┘
```

### Why two frontends and one backend?

- **Two frontends:** shippers and captains have completely different jobs, screens and devices. Separate apps keep each one simple, can be deployed independently (e.g. `app.loadmitra.com` and `captain.loadmitra.com`), and a bug in one doesn't break the other.
- **One backend:** both sides must look at **the same booking**. A shipper creates it, a captain accepts it, and both watch its status. One API with one database is the "single source of truth". The **`bookings` collection is the bridge between the two portals.**

The portals link to each other with plain URLs (`shipper/frontend/src/lib/portals.ts`), e.g. the "Become a captain" button on the shipper site opens the captain site.

---

## 5. Repository tour: every folder explained

```
Loadmitra/
├── package.json            ← root shortcuts: npm run dev, dev:api, install:all …
├── README.md               ← short overview
├── PROJECT_GUIDE.md        ← this file
│
├── server/                 ← THE BACKEND (one API for both portals)
│   ├── package.json        ← server dependencies + scripts (dev, build, test)
│   ├── tsconfig.json       ← TypeScript compiler settings
│   ├── .env.example        ← template for secrets/config (copy to .env)
│   ├── README.md           ← API reference and auth change log
│   ├── BROWSER_VERIFICATION.md ← report of end-to-end browser test runs
│   ├── src/
│   │   ├── index.ts        ← entry point: start HTTP server, connect DB
│   │   ├── app.ts          ← builds the Express app (middleware + routes)
│   │   ├── config/
│   │   │   ├── env.ts      ← reads & validates environment variables
│   │   │   └── db.ts       ← connects to MongoDB with retry, installs indexes
│   │   ├── routes/index.ts ← the URL map: which path calls which function
│   │   ├── middleware/     ← code that runs BEFORE controllers
│   │   │   ├── auth.ts         ← JWT sign/verify, requireAuth, requireRole
│   │   │   ├── rate-limit.ts   ← "max N requests per window" protection
│   │   │   ├── async-handler.ts← forwards async errors to the error handler
│   │   │   └── error.ts        ← 404 + central error responses
│   │   ├── controllers/    ← one function per endpoint (the "what to do")
│   │   │   ├── auth.controller.ts      ← send/verify OTP, me, logout
│   │   │   ├── bookings.controller.ts  ← shipper: create/list/get/cancel, handover code
│   │   │   ├── requests.controller.ts  ← captain: job board
│   │   │   ├── trips.controller.ts     ← captain: accept, list, status changes
│   │   │   ├── captain.controller.ts   ← captain profile + vehicle registration
│   │   │   ├── earnings.controller.ts  ← captain earnings summary + quote
│   │   │   ├── pricing.controller.ts   ← public price estimate
│   │   │   ├── trucks.controller.ts    ← truck catalogue
│   │   │   └── events.controller.ts    ← live SSE stream
│   │   ├── services/       ← reusable business logic (the "how")
│   │   │   ├── pricing.service.ts        ← the price formula
│   │   │   ├── earnings.service.ts       ← captain payout formula
│   │   │   ├── earnings-summary.service.ts ← today/week/month totals (IST)
│   │   │   ├── handover-otp.service.ts   ← pickup/drop verification codes
│   │   │   ├── active-trip.service.ts    ← "one active trip per captain" index
│   │   │   ├── identity-index.service.ts ← migration to country-code identity
│   │   │   ├── booking-view.service.ts   ← safe public shape of a booking
│   │   │   └── live-events.service.ts    ← SSE connection manager
│   │   ├── models/         ← MongoDB document shapes (Mongoose schemas)
│   │   ├── data/
│   │   │   ├── trucks.ts   ← truck catalogue, rate card, city distance table
│   │   │   └── captain.ts  ← old seed/sample data (not used by live routes)
│   │   ├── types/index.ts  ← shared TypeScript types
│   │   └── utils/logger.ts ← tiny timestamped logger
│   └── tests/              ← automated tests (unit, integration, browser)
│
├── shipper/
│   ├── package.json        ← lets `cd shipper && npm run dev` work
│   ├── PROJECT_REVIEW.md   ← original code audit (25 Oct 2026)
│   ├── TODAY_PROGRESS.md   ← what was fixed since the audit
│   └── frontend/           ← THE SHIPPER WEB APP
│       ├── vite.config.ts  ← dev server (port 8080) + build settings
│       ├── src/
│       │   ├── routes/     ← one file per page (file-based routing)
│       │   ├── components/ui/  ← generic building blocks (button, dialog… from shadcn/ui)
│       │   ├── components/app/ ← LoadMitra-specific widgets (map, captain card…)
│       │   ├── features/shipper/ ← domain logic: types, pricing, booking state, i18n
│       │   ├── hooks/      ← reusable React hooks (theme, geolocation…)
│       │   ├── lib/        ← API client, session, storage, live events
│       │   └── styles.css  ← Tailwind + design tokens (colors, light/dark)
│       └── tests/          ← frontend unit tests
│
└── captain/
    ├── package.json
    └── frontend/           ← THE CAPTAIN WEB APP (same structure as shipper)
        └── src/features/captain/ ← captain state, earnings, trip merge logic
```

### The layered pattern on the server

Every request flows through the same layers. Learn this once and the whole server makes sense:

```
Request → routes/index.ts → middleware (rate limit, auth, role) → controller → service/model → MongoDB
                                                                       │
Response ←──────────────────────────────────────────────────────────── ┘
```

- **Route:** "POST /api/bookings goes to `createBooking`".
- **Middleware:** "Is this person logged in? Are they a shipper? Have they sent too many requests?"
- **Controller:** "Validate the input, then do the thing."
- **Service:** "Here's the reusable formula/logic" (e.g. pricing).
- **Model:** "Here's how a booking looks in the database."

**Why split it like this?** Each piece has one job, so it's easier to read, test and change. The pricing formula, for example, lives in one service and is used by the estimate endpoint, booking creation and captain payouts.

---

## 6. Technology stack: what each tool is and why it was chosen

### Backend (`server/package.json`)

| Tool | What it is | Why it's used here |
|---|---|---|
| **Node.js** | Runs JavaScript on a server | Same language as the frontend, so one language for the whole project |
| **TypeScript** | JavaScript plus types (e.g. "this is a number") | Catches mistakes before running; types are shared mentally between server and apps |
| **Express 4** | Minimal web framework for defining routes | Simple, popular, huge ecosystem |
| **MongoDB + Mongoose** | Document database + a library that defines schemas | Bookings are naturally nested JSON (pickup, drop, captain snapshot, price snapshot) |
| **Zod** | Runtime input validation | TypeScript types vanish at runtime; Zod actually checks incoming JSON |
| **jsonwebtoken** | Create/verify JWTs | Stateless login sessions |
| **helmet** | Sets secure HTTP headers | Cheap protection against common web attacks |
| **cors** | Controls which websites may call the API | Only the two portals' origins are allowed |
| **cookie-parser** | Reads cookies | The token is also set as an httpOnly cookie |
| **morgan** | Logs each request in development | Debugging |
| **dotenv** | Loads `.env` into `process.env` | Keeps secrets out of code |
| **tsx** | Runs TypeScript directly with auto-reload | Fast dev loop (`npm run dev`) |

### Frontends (`shipper/frontend/package.json`, same for captain)

| Tool | What it is | Why |
|---|---|---|
| **React 19** | UI library: you build screens from components | Industry standard |
| **TanStack Start** | Full-stack React framework with **server-side rendering (SSR)** | The first page arrives as ready HTML (fast, SEO-friendly), then becomes interactive |
| **TanStack Router** | Type-safe, **file-based** routing | A file in `src/routes/` is a page; URLs and params are type-checked |
| **TanStack Query** | Fetching, caching and auto-refreshing server data | Handles loading/error states and polling for captain data |
| **Vite** | Dev server and bundler | Instant reload during development |
| **Tailwind CSS 4** | Utility CSS classes (`px-4 rounded-xl`) | Fast, consistent styling; light/dark via CSS variables |
| **Radix UI + shadcn/ui** | Accessible unstyled primitives + pre-styled copies in `components/ui/` | Dialogs, menus, OTP input etc. that work with keyboard and screen readers |
| **lucide-react** | Icon set | Icons such as Truck, MapPin |
| **sonner** | Toast notifications | "Booking cancelled" pop-ups |
| **react-hook-form, recharts, date-fns…** | Forms, charts, dates | Available for screens like earnings charts |
| **Nitro** | Server runtime used when building for deployment | Outputs a Vercel-ready build (`vite.config.ts`) |
| **Lovable config** | `@lovable.dev/vite-tanstack-config` | The project was scaffolded with Lovable; this preset wires Vite plugins together |

---

## 7. Running the project on your computer

### Prerequisites
- **Node.js 20+** and npm
- A **MongoDB** database: either free **MongoDB Atlas** (cloud) or MongoDB installed locally

### Steps

```bash
# 1. Install dependencies for all three apps (from the repo root)
npm run install:all

# 2. Configure the API
cp server/.env.example server/.env
#    open server/.env and set MONGODB_URI, e.g.
#    MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/loadmitra
#    (Atlas: allow your IP under "Network Access")

# 3. Start each piece in its own terminal
npm run dev:api        # API      → http://localhost:4000  (start this first)
npm run dev            # Shipper  → http://localhost:8080
npm run dev:captain    # Captain  → http://localhost:8081
```

Check the API is alive: open `http://localhost:4000/health`, which returns `{"status":"ok",...}`.

### Environment variables (`server/src/config/env.ts`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | Port the API listens on |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `MONGODB_URI` | **required** | Database connection string |
| `JWT_SECRET` | `dev-only-change-me` | Key that signs tokens and hashes OTPs. **Must** be ≥16 chars and non-default in production, or the server refuses to start |
| `CORS_ORIGIN` | `http://localhost:8080,http://localhost:8081` | Comma-separated websites allowed to call the API |
| `OTP_TTL_SECONDS` | `300` | Login code lifetime (5 min) |

Frontend variables (`VITE_` prefix, public):

| Variable | Default |
|---|---|
| `VITE_API_URL` | `http://localhost:4000` |
| `VITE_SHIPPER_PORTAL_URL` | `http://localhost:8080` |
| `VITE_CAPTAIN_PORTAL_URL` | `http://localhost:8081` |

**Why Zod for env?** If `MONGODB_URI` is missing, the server stops at boot with a clear error instead of crashing mysteriously later. This is called **fail fast**.

### Logging in during development

There is no SMS provider yet. In development, `POST /api/auth/send-otp` returns the code as `devOtp`, and the login screen shows "Development verification code: 123456". Type it in. In **production** the OTP endpoints return **503** until a real SMS adapter is added; that's deliberate, so nobody can log in without proving phone ownership.

### Trying the whole flow yourself
1. Shipper (8080): log in as a shipper, search Hyderabad → Warangal, pick **Tata Ace**, weight 500 kg, book.
2. Captain (8081): log in with a different number as a captain, go to **Account**, register vehicle (e.g. `TS09AB1234`, type **Tata Ace**, city Hyderabad). Go online and the load appears. Accept.
3. Shipper screen switches to "Captain found" automatically.
4. Captain: "Head to pickup" → "Arrived". Shipper: generate the **pickup code** on the track screen and tell it to the captain. Captain enters it → "picked". Repeat for drop → "delivered". The captain's earnings update.

---

## 8. The backend (server/) in depth

### 8.1 Startup: `index.ts`, `app.ts`, `config/db.ts`

`index.ts`:
```ts
const app = createApp();
app.listen(env.PORT, ...);     // 1. start serving HTTP immediately
void connectDbWithRetry();     // 2. connect to MongoDB in the background
```
**Why start HTTP before the DB?** If Atlas is briefly unreachable, the API still answers `/health` and the frontends can show a proper error, rather than the whole API being down. `connectDbWithRetry` tries every 10 s forever and never throws.

After connecting, `connectDb` installs two index sets:
- `ensureIdentityIndexes()`: unique `(dialCode, phone, role)` for users and OTPs (and a safe migration from the older `(phone, role)` index).
- `ensureActiveTripIndex()`: the "one active trip per captain" rule (see [§13.2](#132-one-active-trip-per-captain-enforced-by-the-database)).

`app.ts` assembles the middleware in order:
```ts
app.use(helmet());                                         // security headers
app.use(cors({ origin: env.corsOrigins, credentials: true })); // only our portals
app.use(express.json({ limit: "1mb" }));                   // parse JSON, cap size
app.use(cookieParser());                                   // read cookies
if (!env.isProd) app.use(morgan("dev"));                   // dev request logs
app.use(routes);                                           // all endpoints
app.use(notFound);                                         // unknown path → 404
app.use(errorHandler);                                     // crashes → clean 500
```
`createApp()` is separate from `index.ts` so **tests can build the app without starting a real server**.

### 8.2 The complete endpoint list (`routes/index.ts`)

| Method & path | Who | Rate limit | What it does |
|---|---|---|---|
| `GET /health` | anyone | – | Liveness check |
| `POST /api/auth/send-otp` | anyone | 5 / hour per IP+phone | Create a login code |
| `POST /api/auth/verify-otp` | anyone | 10 / 10 min per IP+phone | Check code → token (+ create account) |
| `GET /api/auth/me` | logged in | – | Who am I |
| `PATCH /api/auth/me` | logged in | – | Update name/email |
| `POST /api/auth/logout` | anyone | – | Revoke the token |
| `GET /api/events` | logged in | 30 / min per user | Live SSE stream |
| `GET /api/trucks` | anyone | – | Truck catalogue |
| `POST /api/pricing/estimate` | anyone | – | Price estimate |
| `POST /api/bookings` | shipper | 20 / min | Create a booking |
| `GET /api/bookings` | shipper | 120 / min | My bookings (paginated) |
| `GET /api/bookings/:id` | shipper | 120 / min | One of my bookings |
| `POST /api/bookings/:id/cancel` | shipper | 20 / min | Cancel (before pickup) |
| `POST /api/bookings/:id/handover-otp` | shipper | 5 / 10 min per booking | Generate pickup/drop code |
| `GET /api/captain/me` | captain | – | Captain profile |
| `PATCH /api/captain/vehicle` | captain | 20 / min | Register/update vehicle |
| `GET /api/captain/requests` | captain | – | Job board (matching loads) |
| `POST /api/captain/requests/:id/accept` | captain | – | Accept a load |
| `GET /api/captain/trips` | captain | – | Trip history + active trip |
| `GET /api/captain/trips/:id` | captain | – | One of my trips |
| `POST /api/captain/trips/:id/status` | captain | – | Move trip to next stage |
| `GET /api/captain/earnings` | captain | – | Earnings summary |
| `POST /api/captain/earnings/quote` | captain | – | What would I earn on a load |

### 8.3 Middleware, one by one

**`requireAuth` (`middleware/auth.ts`)**
1. Sets `Cache-Control: no-store` so private data is never cached by browsers or proxies.
2. Reads the token from `Authorization: Bearer …` or the `lm_token` cookie.
3. `verifyToken` checks: signature valid, algorithm is exactly `HS256`, `userId` is a sane string, `role` is shipper/captain, `exp` (expiry) and `jti` (unique session id) exist.
4. Looks up `jti` in `revokedtokens`. If found, the user logged out: 401.
5. If the database is down: **503, not "let them in"**. A security check must "fail closed".
6. Attaches `req.auth = { userId, role }` for the controller.

**`requireRole("captain")`**: if `req.auth.role` isn't the required role → 403. It stops a shipper token from accepting loads.

**`rateLimit` (`middleware/rate-limit.ts`)**: an in-memory "fixed window" counter. Example: `send-otp` allows 5 requests per hour per `IP:phone`. The 6th gets 429 with a `Retry-After` header. **Why?** It prevents brute-forcing codes and "SMS bombing" someone's phone. **Limitation:** counters live in this process's memory. With several server instances you'd move this to Redis (noted in the code).

**`asyncHandler`**: Express 4 doesn't catch errors thrown by `async` functions. Without this wrapper a database error would leave the request hanging forever. It catches the error and passes it to `errorHandler`.

**`errorHandler`**: malformed JSON → 400 "Invalid JSON body"; anything else → logs it and returns a generic 500 (never leaks stack traces to users).

### 8.4 Data models

#### User (`models/user.model.ts`)
```
role       "shipper" | "captain"
name       string
email      string (optional)
phone      "9876543210"  (national number, no country code)
dialCode   "+91"
vehicle    { vehicleNumber, truckTypeId, city }   ← captains only, after registration
createdAt / updatedAt (automatic)
```
Unique index on `(dialCode, phone, role)`. **Why include dialCode?** The digits `5551234567` in the US and in another country are different people.

`publicUser()` returns only safe fields. Internal fields never leak.

#### Otp (`models/otp.model.ts`)
```
dialCode, phone, role
codeHash     HMAC of the code (the code itself is NEVER stored)
attempts     how many guesses so far (max 5)
expiresAt    MongoDB auto-deletes the document after this (TTL index)
```

#### Booking (`models/booking.model.ts`): the heart of the system
```
bookingId            "LM-<UUID>"  human-friendly ID created by the shipper app
shipperId            who owns it (from the token, never from the body)
requestFingerprint   SHA-256 of the load details (for safe retries)
customerName         from the shipper's account
mode                 full | shared | return
pickup, drop         { label, address, city }
distanceKm           computed by the SERVER
truckTypeId/Name     validated against the catalogue
loadWeightKg         must be ≤ truck capacity
goodsType
agreedPrice          computed by the SERVER
priceSnapshot        full price breakdown frozen at booking time
status               "open" → "accepted" | "cancelled"      (marketplace state)
tripStatus           accepted → enroute_pickup → at_pickup → picked
                     → enroute_drop → delivered  (or cancelled)  (driving state)
acceptedByCaptainId  which captain claimed it
captain              snapshot of captain + vehicle shown to the shipper
handoverOtp          { stage, codeHash, expiresAt, issuedAt, attempts }
completedAt          set only on verified delivery
payoutSnapshot       captain's payout frozen on delivery
```

**Why two status fields?** `status` answers "is this load still on the market?" while `tripStatus` answers "where is the truck in the delivery process?". Keeping them separate makes queries like "show the job board" (`status: "open"`) simple.

**Why "snapshots"?** Prices and captain details can change later (a new rate card, the captain changes trucks). A snapshot freezes the values *as they were at that moment*, so history and earnings never silently change.

`bookingToRequest()` and `bookingToTrip()` convert a stored booking to the shapes the captain app expects. `shipperBookingView()` (`services/booking-view.service.ts`) converts it to the shape the shipper app sees and **deliberately leaves out** `shipperId`, `requestFingerprint` and `handoverOtp`.

#### RevokedToken
`{ jti, expiresAt }`. When you log out, your token's unique id goes here until it would have expired anyway; then a TTL index deletes it automatically.

### 8.5 Controllers, explained

#### Auth (`controllers/auth.controller.ts`)

**send-otp**
1. In production with no SMS → 503 (fail closed).
2. Zod validates `phone`, `role`, `dialCode` (one of `+91, +1, +44, +971, +65, +61, +966`). Indian numbers must match `^[6-9]\d{9}$`.
3. Generates a random 6-digit code with `crypto.randomInt` (cryptographically secure, not `Math.random`).
4. Stores **only** `HMAC-SHA256(JWT_SECRET, phone:role:code)`, resets attempts, sets expiry. Upsert means a resend replaces the previous code.
5. Returns `{ sent: true, devOtp }` (dev only).

**verify-otp**
1. Atomically finds a challenge that is unexpired with `attempts < 5`, **and increments attempts in the same operation**. Every guess, right or wrong, costs an attempt.
2. Compares hashes. Wrong → 401.
3. If no account exists and no `name` was given → 409 `registration_required`. The app then shows the "your name/email" step and calls verify again.
4. **Atomically deletes** the challenge (`findOneAndDelete`). If two requests race with the same code, only one can delete it, so only one wins.
5. Creates or updates the user, signs a JWT, sets the `lm_token` httpOnly cookie, and returns `{ token, user }`.

**logout**: records the token's `jti` in `revokedtokens`, closes any live streams for that session (`endSession`), and clears the cookie.

#### Bookings (`controllers/bookings.controller.ts`)

**createBooking**: the most "never trust the client" function in the project:
1. Validates the body (`bookingId` must look like `LM-xxxxxx`).
2. Looks up the truck; rejects unknown trucks or `loadWeightKg > capacityKg`.
3. **Ignores the client's `distanceKm`** and recomputes it from the cities. Otherwise someone could claim 1 km to pay less.
4. **Ignores the client's `agreedPrice`** and recomputes it with `estimatePrice`.
5. Takes `customerName` from the database account, not the body.
6. Computes a fingerprint (hash of the load details).
7. `findOneAndUpdate(..., { $setOnInsert }, { upsert: true })` keyed on `bookingId + shipperId + fingerprint`:
   - First time → inserts.
   - Retry of the *same* request (e.g. flaky network) → returns the existing booking unchanged. This property is called **idempotency**.
   - Same ID but different owner/details → the unique index throws code `11000` → 409.
8. Publishes a live event: the shipper's booking changed, and all captains' job boards changed.

**listBookings**: cursor pagination. Returns up to 50 newest, plus `nextCursor` (the last `_id`). The next page asks `?before=<id>`. **Why cursors and not page numbers?** New bookings arriving don't shift pages or cause duplicates.

**cancelBooking**: one atomic update that only matches if you own it **and** the goods are not yet picked up (`tripStatus` in `accepted / enroute_pickup / at_pickup`, or none). After pickup, cancel → 409.

**issueHandoverOtp**: the shipper's "show code to driver" button.
- Only allowed when `tripStatus` is `at_pickup` (code for stage `picked`) or `enroute_drop` (code for stage `delivered`).
- A 30-second cooldown is enforced in the database filter.
- Stores only an HMAC hash; returns the plain code once, to the owner.

#### Captain side

**updateVehicle** (`captain.controller.ts`): normalizes `"ts-09 xy 7654"` → `"TS09XY7654"`, requires letters and digits, 6–15 characters, a valid truck type and a city. It's a format check only, not document (KYC) verification.

**listRequests** (`requests.controller.ts`): the job board. Shows only bookings that are `open`, have an owner, use **the same truck type as the captain's registered vehicle** and fit its capacity. No vehicle → empty list.

**acceptRequest** (`trips.controller.ts`):
1. Captain must have a registered vehicle → otherwise 409 `VEHICLE_REQUIRED`.
2. Makes sure the active-trip index exists (else 503; never accept without the safety net).
3. **One atomic update**: "find booking X *where status is still open and truck matches*, and set it to accepted with me as captain". If two captains click at the same instant, only one update can match; the other gets 409 "This load is unavailable".
4. If the captain already has an active trip, the unique index rejects the write → 409 `ACTIVE_TRIP_EXISTS`.
5. Captain identity comes from the token. Any `captain` object in the body is ignored.

**updateTripStatus**: the **trip state machine**:

```
accepted ──► enroute_pickup ──► at_pickup ──► picked ──► enroute_drop ──► delivered
   │               │                │      (OTP!)                    (OTP!)
   └───────────────┴────────────────┴──► cancelled
```
```ts
const transitions = {
  accepted:       ["enroute_pickup", "cancelled"],
  enroute_pickup: ["at_pickup", "cancelled"],
  at_pickup:      ["picked", "cancelled"],
  picked:         ["enroute_drop"],
  enroute_drop:   ["delivered"],
};
```
- You can't skip stages, go backwards, or cancel after goods are on the truck.
- Moving to `picked` or `delivered` needs the 6-digit **handover code** from the shipper. This proves the captain is physically with the shipper/receiver.
- Code checking is done in three atomic steps: (1) reserve an attempt (`attempts < 5`, unexpired, right stage); (2) compare hashes in **constant time** (`timingSafeEqual`); (3) apply the transition only if the *same* challenge is still there.
- On `delivered`, the server writes `completedAt` and `payoutSnapshot`. These are what earnings are computed from.
- Every update includes the *current* `tripStatus` in its filter, so a stale request (from an old tab) can't overwrite a newer state → 409 "Trip changed; refresh and retry".

**getEarnings** (`services/earnings-summary.service.ts`): one MongoDB aggregation over the captain's delivered trips:
- Groups by day **in India time (Asia/Kolkata)** regardless of the server's timezone.
- Computes today / this week (Monday start) / this month, trips today, incentive this week, a 7-day chart, and the 20 latest ledger entries.
- Old trips without `completedAt`/`payoutSnapshot` are counted as `unknownCompletionTrips` and **not** invented into totals.
- `onlineHoursToday` and `acceptanceRate` return `null` because they aren't tracked yet; the app shows "–" rather than fake numbers.

### 8.6 The truck catalogue and distance (`data/trucks.ts`)

| id | Name | Capacity | ₹/km | Base fare |
|---|---|---|---|---|
| `ace` | Tata Ace | 750 kg | 18 | 250 |
| `pickup8` | Pickup 8 ft | 1,200 kg | 24 | 320 |
| `tata407` | Tata 407 | 2,500 kg | 30 | 480 |
| `truck14` | 14 ft Truck | 3,500 kg | 36 | 650 |
| `truck17` | 17 ft Truck | 5,000 kg | 44 | 850 |

`PRICING_CONFIG`: return discount 25%, share discount 20%, range spread ±8%, `surgeMultiplier` 1.0 (a placeholder for future dynamic pricing), CO₂ 0.85 kg/km.

**Distance** (`estimateDistanceKm`): there's no maps API yet, so:
- Known city pairs use a lookup table (e.g. Hyderabad–Warangal = 145 km, Hyderabad–Bengaluru = 575 km).
- Same city → a stable 8–31 km derived from a hash of the text.
- Unknown pair → a stable 60–619 km from a hash.
- "Bangalore" is normalized to "bengaluru", "Vizag" to "visakhapatnam".

**Why a hash, not random?** The same input always gives the same distance, so prices never jump between page loads, and the server and browser compute the same number.

---

## 9. The frontends (shipper/ and captain/) in depth

Both apps share the same skeleton, so learn it once.

### 9.1 How a TanStack Start app is organized

- **`src/routes/`**: **file-based routing**. The file name *is* the URL:

| File | URL |
|---|---|
| `index.tsx` | `/` (marketing landing page) |
| `login.tsx` | `/login` |
| `app.tsx` | layout wrapping every `/app/*` page (sidebar, bottom nav, providers) |
| `app.index.tsx` | `/app` |
| `app.track.$id.tsx` | `/app/track/LM-123…` (`$id` is a URL parameter) |
| `__root.tsx` | the HTML shell around everything (meta tags, fonts, CSS, `<Outlet/>`) |

  `routeTree.gen.ts` is **auto-generated** from these files. Never edit it by hand.

- **`<Outlet />`**: "render the child page here". The root renders the layout, the layout renders the page.
- **SSR:** the server renders HTML first; then React "hydrates" it in the browser (attaches click handlers). Because the server can't see `localStorage` or the browser window, all browser-only code runs inside `useEffect`. That's why you'll see comments like "SSR-safe" everywhere.
- `src/server.ts` and `src/start.ts` wrap the SSR handler so a crash shows a friendly error page instead of raw JSON.

### 9.2 Shipper screens (`shipper/frontend/src/routes/`)

| Page | File | What happens |
|---|---|---|
| Landing | `index.tsx` | Marketing page, language/theme switch, links to login and captain portal |
| Login | `login.tsx` | Phone + country code → OTP → (new user: name/email) → token saved → `/app` |
| Home | `app.index.tsx` | Map-first home, choose mode (full/shared/return), saved places, detect location |
| Search | `app.search.tsx` | Choose pickup & drop (suggestions, current location, swap) |
| Quote | `app.quote.tsx` | Pick truck (smallest that fits is recommended), weight, goods type; see price range; **Book** |
| Matching | `app.matching.tsx` | Radar animation while waiting; shows the captain card when accepted; cancel |
| Track | `app.track.$id.tsx` | Status timeline, map, captain info, **handover code** at pickup/drop, share trip |
| Bookings | `app.bookings.tsx` | History with "load more" (cursor pagination), details dialog |
| Offers | `app.offers.tsx` | Promotions page |
| Account | `app.account.tsx` | Profile edit, language, theme, logout |

### 9.3 Captain screens (`captain/frontend/src/routes/`)

| Page | File | What happens |
|---|---|---|
| Dashboard | `app.index.tsx` | Online/offline switch, GPS location, incoming offer cards with a **30-second countdown** (accept/skip), today's earnings |
| Trip | `app.trip.$id.tsx` | Step-by-step buttons: Head to pickup → Arrived → Enter pickup OTP → Start drive → Enter drop OTP; SOS; payout card |
| Trips | `app.trips.tsx` | History |
| Earnings | `app.earnings.tsx` | Today/week/month, weekly chart, ledger |
| Account | `app.account.tsx` | Profile, **vehicle registration**, KYC status, language, logout |

### 9.4 The API client (`src/lib/api.ts`)

One small `request()` function used by every call:
1. Adds `Content-Type: application/json` and `Authorization: Bearer <token>`.
2. `fetch(BASE_URL + path, { credentials: "include" })`.
3. Network failure → `ApiError(0, "Can't reach the server. Is the API running?")`.
4. Non-2xx → throws `ApiError(status, message)` so screens can react (e.g. 409 `registration_required` → show the profile step).

`api` holds auth calls, `shipperApi` holds booking calls (`createBooking`, `getBooking`, `cancelBooking`, `issueHandoverOtp`, `estimate`…), and the captain app has `captainApi` (`requests`, `accept`, `updateStatus`, `trips`, `earnings`…).

### 9.5 Session handling (`lib/api.ts`, `lib/session.ts`, `lib/storage.ts`)

- The token is stored via `writeStored("lm-token")`, which writes a cookie **and** a localStorage copy (`lib/storage.ts`). Cookies are used because the server-rendered page can read them.
- `setToken`/`clearToken` fire a custom `loadmitra:session-changed` event. `subscribeSession` also listens to the `storage` event (**another tab** logged in/out) and window focus.
- `useSessionKey()` turns the token into a React **`key`**. When you log out or switch accounts, the key changes and React **throws away the whole booking/captain state tree and rebuilds it**. This guarantees account A's data is never shown to account B. The "initial" trick keeps the key stable during the first hydration, so the page doesn't remount right after loading.
- `clearSession()` removes the token locally immediately, then tells the server to revoke it in the background.

### 9.6 State management

**Shipper: `features/shipper/booking-context.tsx`**

A React Context + `useReducer` holding:
- `draft`: the booking being assembled across screens (mode, pickup, drop, truck, weight, goods). It lives in the `/app` layout, so it survives navigation between Home → Search → Quote.
- `bookings`: the list loaded from the API.

`mergeBookings()` (`booking-record.ts`) combines pages, polls and live updates **without ever moving a booking backwards** (it compares `updatedAt` and the stage order). A late, stale response can't undo "delivered".

`useStoredBooking(id)` powers matching/track pages: it loads that one booking and **polls** it every **3 s**, or every **30 s** when the live stream is connected, until it's delivered or cancelled.

**Captain: `features/captain/captain-context.tsx`**

Uses **TanStack Query** with separate queries:

| Query key | Endpoint | Refresh (no live / live) |
|---|---|---|
| `captain-trips` | `/api/captain/trips` | 3 s / 30 s |
| `captain-offers` | `/api/captain/requests` (only when no active trip) | 6 s / 30 s |
| `captain-earnings` | `/api/captain/earnings` | 15 s / 60 s |
| `captain-account` | `/api/captain/me` | cached 60 s |

`mutateTrip()` wraps accept/status changes: it allows only one at a time, cancels in-flight reads (so an old read can't overwrite the fresh result), updates the caches, refreshes earnings after delivery, and shows a toast on error.

`trip-record.ts` → `latestTrip()` and `mergeTrips()` work like the shipper's merge: the newest `updatedAt` wins, otherwise the further stage wins.

### 9.7 Live updates in the browser (`lib/live.ts`, `lib/use-live-events.ts`)

- Uses `fetch` with a streaming body instead of the built-in `EventSource`, **because EventSource can't send an `Authorization` header**.
- `parseEventStream()` splits the text stream into `data:` messages; `toLiveEvent()` validates them.
- Reconnects with **exponential backoff + jitter**: 1 s, 2 s, 4 s … up to 30 s, randomized ±25% so many tabs don't reconnect at the same moment.
- 401/403 → stops (session ended).
- After any reconnect it emits a local `resync` event, so the app reloads everything in case it missed messages.
- **Closes the stream when the tab is hidden.** Browsers allow only ~6 connections per server over HTTP/1.1; idle background streams would block normal API calls.

What each app does with a signal:
- Shipper: `booking` → re-fetch that booking; `resync` → reload history.
- Captain: `offers` → refresh the job board; `trip` → refresh trips and earnings; `resync` → refresh all.

### 9.8 Pricing on the client (`features/shipper/pricing.ts`, `features/captain/earnings.ts`)

The **same formula** as the server is duplicated in the browser. **Why?** The quote screen shows a price **instantly** (even during SSR, or if the API is down), then TanStack Query fetches the server's estimate and replaces it. The server number is the one actually saved. The comments say "byte-for-byte equivalent" because if they drift, the shipper would see a different price on screen than the one stored.

### 9.9 Languages, theme, map, location

- **i18n** (`features/*/i18n.tsx`, `translations.ts`): 6 languages: English, Hindi, Telugu, Tamil, Kannada, Malayalam. `t("key", {vars})` looks up the active language, falls back to English, then to the key itself. The choice is saved in the `lm-lang` cookie.
- **Theme** (`hooks/use-theme.ts`): light/dark saved in `lm-theme`, defaulting to the OS preference; toggles the `dark` class on `<html>`. Colors are CSS variables in `styles.css`.
- **Map** (`components/app/map-canvas.tsx`): a **fake map** drawn with CSS/SVG (street grid, blocks, route line, moving marker). There's no Google Maps key needed; a real tile layer can be added behind it later.
- **Geolocation** (`hooks/use-geolocation.ts`): the browser's GPS, plus a free key-less reverse-geocoding service (bigdatacloud) to turn coordinates into a city name. It falls back to raw coordinates.
- **`usePersistedState`**: like `useState` but saved to storage (e.g. sidebar open/closed).
- **Responsive layout:** sidebar on large screens, bottom tab bar on phones.

---

## 10. A complete journey, step by step

Here is everything that happens, across both apps, the server and the database.

```
SHIPPER APP                       SERVER                               CAPTAIN APP
───────────                       ──────                               ───────────
1. Login
 POST /auth/send-otp ───────────► make code, store HMAC
 ◄─ devOtp
 POST /auth/verify-otp ─────────► check, consume, create user
 ◄─ JWT token (stored)                                                 (captain logs in the same way)
                                                                       2. Register vehicle
                                                                        PATCH /captain/vehicle
3. Home → Search → Quote
 POST /pricing/estimate ────────► estimatePrice()
 ◄─ price range
4. Book
 POST /bookings ────────────────► recompute distance & price,
                                  insert status=open
                                  SSE → shipper {booking}
                                  SSE → all captains {offers} ───────► refresh job board
5. Matching screen polls/waits                                         GET /captain/requests
                                                                        ◄─ matching open loads
                                                                       6. Offer card (30 s) → Accept
                                  ◄──────────────── POST /requests/:id/accept
                                  atomic open→accepted,
                                  captain snapshot saved
 SSE {booking} ◄─────────────────  SSE → shipper, captain, job board
 GET /bookings/:id → captain card
7. Track screen                                                        7. Head to pickup → Arrived
                                  ◄──────────────── POST /trips/:id/status (enroute_pickup, at_pickup)
 ◄─ SSE {booking} (status shown)
8. At pickup: "Generate code"
 POST /bookings/:id/handover-otp ► store HMAC, return code once
 shipper tells code to driver ─────────────── (in person) ───────────► 9. Enter code
                                  ◄──────────────── POST /trips/:id/status {picked, otp}
                                  verify (5 attempts, 10 min) → picked
                                                                       10. Start drive → enroute_drop
11. At drop: generate drop code ─────────────── (in person) ─────────► 12. Enter code → delivered
                                  completedAt + payoutSnapshot saved
 ◄─ "Delivered"                   SSE → both                           13. Earnings refresh
```

---

## 11. Pricing and earnings math, with worked examples

### 11.1 Shipper price (`server/src/services/pricing.service.ts`)

```
distanceCharge = distanceKm × truck.ratePerKm
subtotal       = (truck.baseFare + distanceCharge) × surgeMultiplier (1.0)

full   : estimate = subtotal
return : estimate = subtotal × (1 − 0.25)
shared : sharePct = clamp(loadWeightKg / capacityKg, 0.10, 1.00)
         estimate = sharePct × subtotal × (1 − 0.20)

low  = round to ₹10 of estimate × 0.92
high = round to ₹10 of estimate × 1.08
loadTons = max(0.1, weightKg / 1000)
perTon   = estimate / loadTons (rounded to ₹10)
co2SavedKg (return)  = distance × 0.85
co2SavedKg (shared)  = distance × 0.85 × (1 − sharePct)
```

**Example A: Full load.** Tata Ace, Hyderabad → Warangal (145 km), 500 kg.
- distanceCharge = 145 × 18 = ₹2,610
- subtotal = 250 + 2,610 = **₹2,860** = estimate
- range = ₹2,630 – ₹3,090
- per tonne = 2,860 / 0.5 = ₹5,720/t

(This exact ₹2,860 is asserted in `server/tests/bookings.test.cjs`.)

**Example B: Return load.** Tata 407, same route.
- subtotal = 480 + 145 × 30 = ₹4,830
- estimate = 4,830 × 0.75 ≈ **₹3,623** (saves about ₹1,208, and 123 kg CO₂ because the truck was going back anyway)

**Example C: Shared load.** Tata 407, same route, 1,000 kg of a 2,500 kg truck.
- sharePct = 0.4
- estimate = 0.4 × 4,830 × 0.8 ≈ **₹1,546**

**Why a range and not one number?** Indian freight is negotiated. The range is an honest "market band", and `perTon` makes comparison easy for traders used to ₹/tonne.

### 11.2 Captain payout (`server/src/services/earnings.service.ts`)

```
commission = fare × 15%
incentive  = fare × 6% (return) | 4% (shared) | 0 (full)
net        = fare − commission + incentive
perKm      = net / distanceKm
```

**Example A again (full, ₹2,860):** commission ₹429 → net **₹2,431** (≈ ₹16.8/km).

**Example B (return, ₹3,623):** commission ₹543, incentive ₹217 → net **₹3,297**.

**Why an incentive for return/shared?** The platform wants to reward captains for filling empty or half-empty trucks, which is the core mission. The captain's payout is computed from **the same fare the shipper sees**, so both sides agree.

---

## 12. Security, explained

This project went through a security audit (`shipper/PROJECT_REVIEW.md`), and most findings were fixed (`shipper/TODAY_PROGRESS.md`). Here is every protection, why it's there and where it is.

| Threat | Protection | Where |
|---|---|---|
| Guessing login codes | Random 6-digit codes, 5 attempts, 5-min expiry, rate limits (5 sends/hour, 10 verifies/10 min) | `auth.controller.ts`, `routes/index.ts` |
| Database leak exposing codes | Only HMAC-SHA256 hashes stored, keyed with the server secret | `hashOtp`, `handoverOtpHash` |
| Same code used twice at once | Atomic `findOneAndDelete` consumption | `verifyOtp` |
| Logging in in production without SMS | Endpoints return 503 when `NODE_ENV=production` | `deliveryAvailable` |
| Forged tokens | HS256 signature, algorithm pinned, claims validated, strong secret required in production | `middleware/auth.ts`, `config/env.ts` |
| Stolen token after logout | `jti` revocation list; live streams closed | `logout`, `RevokedToken`, `endSession` |
| DB outage turning revocation off | Auth returns 503 instead of allowing | `requireAuth` |
| Shipper acting as captain | `requireRole` → 403 | `routes/index.ts` |
| Reading/changing someone else's booking | Every query includes `shipperId` or `acceptedByCaptainId` from the token; strangers get 404 | all booking/trip controllers |
| Underpaying by faking distance or price | Server recomputes distance and price | `createBooking` |
| Overloading a truck / fake truck | Catalogue + capacity checks | `createBooking`, `acceptRequest` |
| Booking-ID hijack / replay | Fingerprint + unique index → 409 | `createBooking` |
| Captain claiming delivery without being there | Shipper-issued handover code, 5 attempts, 10-min life, 30 s cooldown, constant-time comparison | `handover-otp.service.ts`, `updateTripStatus` |
| Timing attacks on code comparison | `crypto.timingSafeEqual` | `matchesHandoverOtp` |
| Private responses cached | `Cache-Control: no-store` | `requireAuth`, controllers |
| Leaking internal fields | Explicit public views (`publicUser`, `shipperBookingView`) | models/services |
| Other websites calling the API | CORS allow-list | `app.ts` |
| Common web attacks (clickjacking, sniffing) | `helmet` headers | `app.ts` |
| Huge request bodies | `express.json({ limit: "1mb" })` | `app.ts` |
| Too many live connections | 5 per user, 2,000 total, 64 KB buffer cap, 1-hour max | `live-events.service.ts` |
| Cookie theft via JavaScript | `lm_token` cookie is `httpOnly`; `SameSite=None; Secure` in production | `setAuthCookie` |

**Known remaining gaps** (honest list from the docs and code):
- The frontends also keep the token in a JS-readable cookie/localStorage (`lib/storage.ts`), which is weaker against XSS than an httpOnly-only design.
- No real SMS provider; no real KYC/document verification.
- Rate limiter and live events are in-memory (single server only).
- Some npm audit findings remained at last review.

---

## 13. Advanced engineering: races, consistency and live updates

This section is for those who want to understand the *hard* parts.

### 13.1 Atomic operations and why "read then write" is dangerous

A naive accept would be:
```js
const b = await Booking.findOne({ id });     // read: status is "open"
if (b.status === "open") { b.status = "accepted"; await b.save(); } // write
```
If two captains run this at the same millisecond, **both** read "open" and **both** accept. The fix used everywhere is a **conditional atomic update**: put the condition *in the write itself*:
```js
Booking.findOneAndUpdate({ bookingId, status: "open", ... }, { $set: { status: "accepted", ... } })
```
MongoDB applies it to a single document atomically: only one captain's filter can still match. The same pattern protects: OTP consumption, cancellation, every trip transition (the filter includes the current `tripStatus`), handover attempts and the cooldown.

### 13.2 One active trip per captain, enforced by the database

A captain must not hold two active trips. Checking "do I already have one?" and then accepting is again a race (two tabs, two servers). Instead, the booking model declares a **partial unique index** (`models/booking.model.ts`):

```js
{ acceptedByCaptainId: 1 }, {
  name: "one_active_trip_per_captain",
  unique: true,
  partialFilterExpression: {
    status: "accepted",
    acceptedByCaptainId: { $type: "string" },
    tripStatus: { $in: [null, "accepted", "enroute_pickup", "at_pickup", "picked", "enroute_drop"] },
  },
}
```

Meaning: "among bookings that are *currently active*, each captain ID may appear at most once." A second accept fails with duplicate-key error `11000`, which `isActiveTripConflict()` turns into 409 `ACTIVE_TRIP_EXISTS`. When a trip becomes delivered/cancelled, it leaves the filter automatically, so the captain is free again. `ensureActiveTripIndex()` installs it explicitly and accept refuses to run (503) if it isn't installed. **The database is the final referee.**

### 13.3 Idempotent booking creation

The shipper app generates `bookingId` once per draft (`requestRef` in `app.quote.tsx`). If the network fails and the user taps Book again, the same ID and same fingerprint are sent, and `$setOnInsert` makes the retry harmless. No duplicate bookings, and an accepted booking can't be "re-opened" by a retry.

### 13.4 Never going backwards on the client

Responses can arrive out of order (an old poll finishing after a new live update). `mergeBookings` and `latestTrip` keep the newer `updatedAt`, or the later stage, so the UI never flips from "picked" back to "at pickup".

### 13.5 Server-Sent Events design (`server/src/services/live-events.service.ts`)

- **Signals, not data.** Events only say `{type:"booking", id}`. The client then re-reads through the normal **owner-checked** endpoints. So the stream can't leak data, and permission logic lives in one place.
- `publishBookingChange` notifies: the shipper (by `shipperId`), the assigned captain, and, if the job board changed, **every** connected captain.
- Heartbeat comment `: ping` every 25 s keeps proxies from closing idle connections; `X-Accel-Buffering: no` stops nginx from buffering.
- Streams end at token expiry or after 1 hour max, so revocation and expiry are re-checked on reconnect.
- A slow client whose buffer exceeds 64 KB is dropped instead of eating memory.
- **Scaling note:** streams are tracked in a `Set` in one process. Multiple API instances would need a shared bus (Redis pub/sub).

### 13.6 Belt and braces: live + polling

Live events make the UI instant; polling (3–6 s without live, 30–60 s with live) guarantees correctness if the stream is blocked by a firewall or drops. The `resync` on reconnect covers missed messages.

### 13.7 Timezone-correct earnings

The earnings aggregation groups by `$dateToString` with `timezone: "Asia/Kolkata"`, and `earningsWindow()` computes Monday/month starts with a fixed +5:30 offset. A server running in UTC (as in the cloud) still reports "today" the way an Indian captain expects.

### 13.8 Safe index migration

`identity-index.service.ts` moved identity from `(phone, role)` to `(dialCode, phone, role)`: fill missing `dialCode` with `+91` → create the new unique index → only then drop the old one. Uniqueness is enforced at every moment, and it's safe to run on every boot (**idempotent**).

---

## 14. Testing

| Suite | Command (in `server/`) | What it uses | What it checks |
|---|---|---|---|
| Unit/regression | `npm test` | Stubs replacing database methods; local HTTP | Auth, tokens, bookings, ownership, pricing, handover codes, earnings, identity, live events |
| Integration | `npm run test:integration` | A temporary **real** MongoDB (`MONGOD_BINARY`) | Atomic accept and the one-active-trip index under real conditions |
| Browser end-to-end | `npm run test:browser` | Temporary MongoDB + API + Vite dev server + installed Chrome driven over the DevTools Protocol | Full shipper journey; captain recovery after reloads, account switches, outages (`BROWSER_VERIFICATION.md`) |
| Frontend unit | `npm test` in each `frontend/` | Node test runner | Live-stream parsing, merge logic, earnings math, session API |

Tests use Node's built-in `node:test`, so no extra test framework is needed. Server tests run against the compiled `dist/` output (`npm run build` first). None of them touch the real Atlas database.

Example of what a test proves (`server/tests/bookings.test.cjs`): "a retry cannot reopen or reprice an accepted booking", "another shipper cannot read booking status", "overcapacity loads are rejected".

Other quality tools: `npm run typecheck` (server), `npm run lint` and `npm run format` (ESLint + Prettier, frontends).

---

## 15. Deployment and configuration

- **Frontends → Vercel.** `vite.config.ts` forces Nitro's `vercel` preset (`.vercel/output`). Override with `NITRO_PRESET` (e.g. `node-server`, `cloudflare-module`). Ports are pinned with `strictPort` so the shipper can never accidentally take the captain's port 8081.
- **API → any Node host** (Render, Railway, Fly…): `npm run build` then `npm start` (`node dist/index.js`). Set `NODE_ENV=production`, a strong `JWT_SECRET`, `MONGODB_URI` and `CORS_ORIGIN` = your two portal URLs.
- **Cookies across domains:** in production the cookie is `SameSite=None; Secure` because the frontends and API are on different domains.
- **Single instance assumption:** rate limiting and SSE are in-memory. Run one API instance, or add Redis before scaling out.
- Dependency security: TanStack packages are pinned to patched versions (see `TODAY_PROGRESS.md`, CVE fix on 26 Oct 2026).

---

## 16. What is real and what is still a placeholder

| Feature | State |
|---|---|
| Phone OTP login, sessions, logout revocation | **Real** (dev shows code; production needs an SMS adapter) |
| Bookings, ownership, cancellation, history | **Real**, stored in MongoDB |
| Job board, atomic accept, one active trip | **Real** |
| Trip lifecycle with handover codes | **Real** |
| Earnings from verified deliveries | **Real** |
| Live updates (SSE + polling) | **Real** (single instance) |
| Vehicle registration | **Real** format check; no document/KYC verification |
| Distance | **Approximation** (lookup table + stable hash), no maps API |
| Map | **Visual placeholder** (CSS/SVG) |
| Chat sheet, SOS, offers, ratings | **UI only** / partial |
| Payments | **Not implemented** by design (offline settlement) |
| Surge/dynamic pricing | Hook exists (`surgeMultiplier = 1.0`), not implemented |
| `server/src/data/captain.ts`, `features/*/mock-data.ts` | Seed/sample data from early phases; trucks/goods lists are still used by the UI |

---

## 17. How to make common changes

**Change a price or add a truck**
1. Edit `server/src/data/trucks.ts` (`TRUCK_TYPES` / `PRICING_CONFIG`).
2. Make the **same** change in `shipper/frontend/src/features/shipper/mock-data.ts` / `pricing.ts` and `captain/frontend/src/features/captain/mock-data.ts` / `earnings.ts`, so instant client prices match the server.
3. Run `npm test` in `server/` (pricing tests assert exact numbers).

**Add a new API endpoint**
1. Write a controller function in `server/src/controllers/` (validate input with Zod first).
2. Register it in `server/src/routes/index.ts` with the right middleware (`requireAuth`, `requireRole`, `rateLimit`, `asyncHandler`).
3. Add a method in the frontend's `src/lib/api.ts`.
4. Add a test in `server/tests/`.

**Add a new page**
Create `src/routes/app.something.tsx` with `createFileRoute("/app/something")`. The route tree regenerates automatically when the dev server runs. Add it to `components/app/nav-items.ts` to show it in the navigation.

**Add a translation**
Add the key to every language in `features/*/translations.ts`, then use `t("your.key")`.

**Add a real SMS provider**
In `auth.controller.ts`, replace the `deliveryAvailable` production 503 with a call to your SMS service in `sendOtp`, and stop returning `devOtp` in production.

---

## 18. Glossary

| Term | Plain meaning |
|---|---|
| **API** | The set of URLs the frontend calls to talk to the server |
| **Atomic** | Happens completely or not at all, with nobody able to sneak in between |
| **Captain** | Truck driver/owner role |
| **CORS** | Browser rule about which websites may call an API |
| **Cursor pagination** | "Give me items older than X" instead of "page 3" |
| **Fail closed** | When unsure (e.g. DB down), deny rather than allow |
| **Fingerprint** | A hash summarizing the booking's details to detect changed retries |
| **Handover OTP** | The 6-digit code the shipper gives the captain at pickup and drop |
| **HMAC** | A keyed hash: you can't reverse it or compute it without the secret |
| **Hydration** | React attaching interactivity to server-rendered HTML |
| **Idempotent** | Doing it twice has the same effect as doing it once |
| **Index (DB)** | Lookup structure for speed, and for rules like uniqueness |
| **JWT** | Signed login ticket the browser sends with each request |
| **jti** | Unique ID inside a JWT, used to revoke one session |
| **Middleware** | Code that runs before your endpoint (auth, rate limit…) |
| **Mode** | `full`, `shared` or `return` load |
| **OTP** | One-time password (6-digit code) |
| **Partial index** | An index that only covers documents matching a filter |
| **Polling** | Asking the server repeatedly for updates |
| **Rate limiting** | Capping how many requests someone can make in a time window |
| **SSE** | Server-Sent Events: one-way live messages from server to browser |
| **SSR** | Server-Side Rendering: HTML generated on the server first |
| **Shipper** | Customer role that books trucks |
| **Snapshot** | A frozen copy of values at a moment in time (price, captain, payout) |
| **State machine** | A fixed set of states plus the allowed moves between them |
| **TTL index** | Makes MongoDB auto-delete documents after a time |
| **Zod** | Library that checks data shapes at runtime |
