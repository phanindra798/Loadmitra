# Captain recovery browser verification — 27 October 2026

**Result: passed.** One end-to-end browser scenario completed nine checkpoints, with zero uncaught browser exceptions. This ran in headless Chrome at 1280×900 against the local captain app, Express API and a separate temporary MongoDB 8.0 instance. Existing databases, browser profiles and deployed services were not used.

**Story:** A signed-in captain opens a saved trip, reloads, advances its status, sees a shipper cancellation, changes accounts across tabs, recovers an older trip and retries after an API outage without displaying another account's records.

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
- `processes.log`: local browser and dev-server process output.
- `failure.png` / `failure.txt`: diagnostic capture if a run fails (may be retained from an earlier run; use `results.json` for the latest outcome).

## Limits

Accounts and signed sessions were seeded specifically for this isolated test. This does not verify SMS login, mobile layouts, real mapping/navigation, payments, KYC, production hosting or AWS. Production earnings remain unfinished. The API and captain frontend still require coordinated deployment; no changes were committed, pushed or deployed by this verification.
