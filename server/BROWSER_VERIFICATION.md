# Captain recovery, earnings and vehicle browser verification — 28 October 2026

**Result: passed.** One end-to-end browser scenario completed thirteen checkpoints, with zero uncaught browser exceptions. This ran in headless Chrome at 1280×900 against the local captain app, Express API and a separate temporary MongoDB 8.0 instance. Existing databases, browser profiles and deployed services were not used.

**Story:** A signed-in captain opens a saved trip, reloads, advances its status, sees a shipper cancellation, changes accounts across tabs, recovers an older trip, verifies delivery, reloads saved earnings, saves a vehicle and retries after API outages without displaying another account's records.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Browser renders saved trip | Passed | Direct navigation and reload showed the correct trip ID, saved pickup/drop-off addresses and available action. |
| Browser → API | Passed | Clicking “Head to pickup” sent the lifecycle request; the UI displayed the arrival action after success. |
| API → MongoDB | Passed | Reading the isolated database confirmed `tripStatus: enroute_pickup`. |
| External update → browser | Passed | Shipper cancellation appeared automatically as “Trip cancelled”; the advance action disappeared. |
| Same-tab account switch | Passed | Switching Alpha to Beta removed Alpha's details; Beta's trip survived reload. |
| Cross-tab account switch | Passed | A second tab switched accounts; the original tab cleared Beta's trip and loaded Alpha's history. |
| Old direct link | Passed | A delivered trip older than the latest 100 records loaded through the owner-scoped detail endpoint. |
| Logout | Passed | Private trip details disappeared and the sign-in state appeared. |
| API error → retry | Passed | A simulated 503 showed an error instead of empty history; Retry recovered saved trips. |
| Delivery → saved earnings | Passed | Entering the real delivery challenge in the browser saved a ₹1,742 payout snapshot and completion timestamp. Reloading earnings retained ₹1,742 without doubling it. |
| Earnings account isolation | Passed | A second tab changed to the other account; its period total was ₹0 and the completed trip from the previous captain was absent. |
| Legacy earnings | Passed | 102 old completed fixtures were labelled as missing completion metadata; no dates or period totals were invented. |
| Earnings error → retry | Passed | A simulated earnings 503 hid the amount and displayed an error; Retry restored the correct summary. |
| Vehicle → API → MongoDB → reload | Passed | Saving `ts-09 xy 7654` restored `TS09XY7654` and the operating city after reload; MongoDB matched, the earlier booking kept its original vehicle, and account switches displayed only the current captain’s vehicle. Documents stayed unverified. |
| Browser runtime | Passed | No uncaught exceptions recorded by the browser protocol. |

## Issue found and fixed

The initial browser check showed that the active trip page restored the trip but did not display pickup/drop-off addresses. The page now includes a labelled route section with the saved addresses and booking ID. Long addresses wrap instead of being truncated. The corrected browser journey passed, and the changed screen passed TypeScript and focused lint checks.

## Reproduce

Install MongoDB and Chrome or Edge locally. From `server`, in PowerShell:

```powershell
$env:MONGOD_BINARY = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe"
$env:BROWSER_BINARY = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:browser
```

The harness uses Node's built-in WebSocket support to drive the installed browser through Chrome DevTools Protocol. It starts isolated processes with temporary data and a fresh browser profile, and shuts them down after the test. It requires the project's existing dependencies and an installed browser/database; it does not download additional packages.

Artifacts are stored in the ignored `server/node_modules/.cache/loadmitra-browser/` directory:

- `results.json`: successful checkpoints and uncaught browser errors.
- `cancelled-trip.png`: the corrected route section and cancelled-trip state.
- `recovered-history.png`: successful history recovery after the simulated outage.
- `saved-earnings.png`: saved delivery estimate after a browser reload.
- `saved-vehicle.png`: registered vehicle restored after reload.
- `processes.log`: local browser and dev-server process output.
- `failure.png` / `failure.txt`: diagnostic capture if a run fails (may be retained from an earlier run; use `results.json` for the latest outcome).

## Limits

Accounts and signed sessions were seeded specifically for this isolated test. This does not verify SMS login, mobile layouts, real mapping/navigation, payments, KYC, production hosting or AWS. Payment settlement and online/acceptance statistics remain untracked. Historical deliveries without completion metadata are excluded from dated totals. The API and captain frontend still require coordinated deployment; the earnings and vehicle batches remain local and uncommitted; this verification did not push or deploy it.


## Earnings implementation checks

75 backend regression tests, 32 real-MongoDB integration tests and 18 frontend tests passed. Tests cover IST midnight, Monday/week/month/year boundaries, totals beyond the history-page limit, rounding consistency, rejected/repeated delivery codes, preserved snapshots, missing historical metadata, authorization and database failures. The two existing Fast Refresh export warnings remain; focused correctness lint has no errors with the formatting rule excluded for existing files. The new vehicle component is formatted.
