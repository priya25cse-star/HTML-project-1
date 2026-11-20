# Final verification before publication - 20 November 2026

This record documents verification actually performed before the final publication commit. Commit IDs, pull-request decisions and merge results are verified separately during publication and are available in GitHub history and the final task report. No future merge is assumed in these test results.

## Changes reviewed

The already implemented local improvements were preserved and reviewed rather than rebuilt:

- Customer name and 10-digit contact number at checkout, validated in the browser and on the server, stored with new MongoDB orders and displayed only in authenticated staff views.
- Existing orders without contact fields remain readable and support status updates/deletion without a migration. Public creation receipts omit contact fields, and private GET routes require admin authorization.
- Server-authoritative menu prices, quantities, item IDs, totals, statuses and timestamps are preserved. Client-supplied food prices cannot reduce the saved total.
- `PROJECT_CHARTER.md` replaces the obsolete `Projrct Charter` placeholder and preserves the team credits **Pranav, Priya, Jyoti**.
- Reusable Windows setup, Atlas configuration, all API endpoints, admin operation, customer flow and Postman guidance are documented. The evaluation guide explains how to inspect `bookings` and `orders` in Atlas/Compass without exposing credentials or real customer records.
- The existing Postman v3 workspace and 27 YAML requests replace the removed old JSON export. Order requests 17 and 23 include the new required contact fields; shared credentials remain empty.
- Tests accommodate the actual menu length. The user's seventh sample menu item is preserved rather than removed to satisfy hardcoded counts.
- Historical reports keep their original execution dates and are explicitly labelled. The README no longer describes an uncommitted review branch as the current publication state.

The existing branding, colours, images, USD currency, navigation, booking flow, architecture and security protections remain intact. No extra services or dependencies were introduced.

## Fresh results

Executed on 20 November 2026 with Windows PowerShell, Node.js v24.22.3 and npm v11.19.1:

| Command | Result |
| --- | --- |
| `npm.cmd run check` | JavaScript syntax, HTML validation and JSON checks passed |
| `npm.cmd test` | **21 passed, 0 failed, 0 skipped** |
| `npm.cmd run test:browser` | **20 scenario groups passed, 0 failed, 0 skipped** |
| `npm.cmd audit --json` | **0 vulnerabilities** |
| `git diff --check` | Passed; Windows line-ending notices are informational |

The automated suite covers real JSON disk writes and fresh-store persistence, 20 concurrent menu creates, invalid/corrupt storage, booking/order validation, authentication, CSRF, authorization, startup failure handling, environment loading and bounded connection retries. All 27 Postman JSON request bodies parse, and updated order examples follow the server contract.

Real MongoDB CRUD verifies bookings and orders through Express, including list/detail reads, customer field persistence, status updates, deletion, timestamps, independent-client persistence reads, private contact access and genuine legacy-format documents. Database readiness is strict; no database test silently skips. Only uniquely named disposable test collections are cleaned up.

Browser execution verifies menu search/filtering, cart totals/quantities/persistence, invalid contact fields, request failure states, duplicate-submission guards, actual order persistence, successful booking redirect/receipt, admin sign-in/out, menu JSON CRUD, new and legacy order management, mobile/keyboard navigation and responsive widths of 375, 768 and 1440 px. Real TheMealDB suggestions are fetched and displayed separately from purchasable dishes. HTML, CSS, JavaScript and image requests passed; no uncaught browser errors were found.

The Postman desktop/CLI runner was not executed. Its request bodies and contract were checked independently, and the API/browser suites exercised the actual HTTP/database behavior.

## Four evaluation parameters

| Parameter | Verification |
| --- | --- |
| External API fetching/display | Real TheMealDB results rendered in the browser; timeout/empty/failure handling covered |
| Node.js and Express | Existing server, middleware, routing and startup checks passed |
| Local JSON APIs | Menu GET/POST/PUT/DELETE use actual disk storage; persistence and concurrent writes passed |
| MongoDB CRUD | Real booking and order Create/Read/Update/Delete passed with private access controls |

## Data and security

The final task preserves `.env`, credentials and the user's seven-item menu. Normal MongoDB customer records are neither migrated, deleted nor reset. Write tests use temporary menu copies and isolated disposable collections; success is not mocked. Earlier credential-rotation confirmation is retained, and this task performs no automatic credential changes.

Tracked, untracked and staged publication content is scanned without printing secret values. Credentials, private connection strings, private keys, dependencies, runtime backups, test screenshots and database dumps must remain excluded. Dummy credentials in negative tests are explicitly synthetic; current configured secrets are not included. Original history and contributors are preserved.

## Run locally

Stop any older project server from its own terminal with Ctrl+C before restarting it, so the new order contract is loaded. Then run from the repository root:

```powershell
npm.cmd ci
npm.cmd start
```

Use `http://localhost:3000`, or the configured local port. Preserve any existing `.env`; fresh clones should follow the general setup in [README.md](../README.md). Atlas availability and the client's approved network access remain external requirements.
