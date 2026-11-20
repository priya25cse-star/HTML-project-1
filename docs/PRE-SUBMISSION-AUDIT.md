# Historical pre-submission audit - 19 November 2026

> This audit retains its original execution date. Process IDs, publication status and counts below are historical. The baseline was subsequently committed, pushed and merged. See [current changes and verification](FINAL-IMPROVEMENTS.md).

Audited on **19 November 2026** using Windows PowerShell, Node.js **v24.22.3** and npm **11.19.1**. This report records actual local checks. No commit, staging, push, credential reset or `.env` overwrite was performed.

## Evaluation requirements

| University parameter | Verified implementation | Actual verification |
| --- | --- | --- |
| External API fetching and display | `src/routes/recipes.js` fetches real TheMealDB data; `script.js` renders separate recipe inspiration cards. | The live endpoint returned HTTP 200 with three suggestions. Browser verification rendered three real recipe cards. Failure, empty-result and caching behavior also passed API tests. |
| Node.js and Express | `server.js`, `src/app.js`, environment loading, JSON middleware, modular routing, validation, centralized errors and restricted frontend hosting. | Current source started on port 3000. Startup/port-conflict/shutdown regression tests passed. Homepage, menu, contact and admin pages loaded. |
| Express local JSON save/fetch | All five `/api/menu` CRUD endpoints use `fs/promises` and actual `data/menu.json` storage. Writes are serialized and replaced atomically. | Create/read/update/delete, actual disk contents, fresh-store/application persistence, invalid storage and 20 concurrent writes passed. Browser admin CRUD also changed and verified a temporary menu file. |
| Complete MongoDB CRUD through Express | Five booking endpoints and five order endpoints; authenticated private reads, status updates and deletion; server-authoritative order prices. | Real MongoDB creation, list/detail reads, status updates, independent-client persistence reads, deletion and missing-record verification passed. Browser booking/order submission and admin status/delete flows passed. |

All four evaluation parameters are implemented and verified.

## Exact test results

| Command/check | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| `npm.cmd run check` | JavaScript, HTML and JSON validation passed | 0 | 0 |
| `npm.cmd test` | **19 tests** | **0** | **0** |
| `npm.cmd run test:browser` | **17 browser scenario groups** | **0** | **0** |
| Additional live configured-server browser audit | **7 checks** | **0** | **0** |
| `npm.cmd audit --json` | Completed; **0 vulnerabilities** | 0 | 0 |
| `npm.cmd ls --depth=0` | All eight direct dependencies resolved | 0 | 0 |
| `git diff --check` | Passed; only normal Windows line-ending notices | 0 | 0 |

The automated suite includes nine API/storage/authentication tests, one real MongoDB integration test covering both resources, and nine startup/environment/diagnostic regression tests. Database readiness is strict: an unavailable database fails rather than silently skipping verification.

Browser coverage includes menu search/filtering, empty states, quantities, cart persistence, unavailable-service handling, single booking submissions, redirect after actual persistence, receipts, admin login/logout and CRUD, external recipe rendering, keyboard/mobile navigation and 375/768/1440 px layouts. No uncaught browser JavaScript errors were observed.

The seven additional live checks used the actual port-3000 server and configured credentials privately: homepage/featured menu, JSON-backed menu, booking form, staff login, authenticated booking/order lists, staff logout and absence of uncaught browser errors. No real booking or order was edited or deleted by these live checks.

## Latest backend fixes are active

The original PID 45228 had started before the latest backend source changes, so it was still running older code. Its working directory and complete command line were verified, and there were no established HTTP connections. That older Windows process had no safely targeted graceful-control channel available; only the verified idle project process was stopped.

`npm.cmd start` then launched the current source on port 3000 as PID **28148**. Its creation time follows the backend file changes, and its output used the new categorized TLS diagnostic and bounded retry behavior. It recovered from one transient TLS handshake error and printed **MongoDB connected and authenticated ping passed**. The new server remains running for local demonstration. PIDs are observational and must be rechecked before any later process action.

Live HTTP results:

| Path | Result |
| --- | --- |
| `/api/health` | 200, `status: "ok"`, `database: "connected"` |
| `/` and `/Admin.html` | 200 |
| `/api/menu` | 200, six original menu items |
| `/api/recipes` | 200, three real TheMealDB suggestions |
| `/.env`, `/server.js`, `/data/menu.json`, `/node_modules/express/package.json` | 404 |

## Data and configuration preservation

- `.env` was not overwritten and credentials were not rotated.
- Hash comparisons confirmed `.env`, the actual `data/menu.json`, all five frontend pages, both frontend scripts and the stylesheet remained unchanged during the audit.
- CRUD tests used temporary menu files and uniquely named disposable MongoDB collections, cleaned after verification. Normal bookings/orders were not modified or deleted.
- `TEST_MONGODB_URI` is not separately configured. Existing tests therefore use isolated collections in the configured database. No database target was changed.
- Authentication, TLS certificate verification, existing routes and the visual design were preserved.

## Git and secret audit

The tracked files, non-ignored untracked commit candidates, staged content and local Git history were inspected without printing secret values. Checks used exact configured-secret comparisons plus patterns for credential-bearing MongoDB URLs, private keys, provider access tokens, JWTs and literal password assignments.

- **No real credential findings** in the audited submission files or local history.
- Three pattern matches were reviewed: one negative-login test literal and two intentionally dummy connection strings in startup tests. None matched configured credentials.
- `.env`, `.env.*` except the placeholder `.env.example`, `node_modules/`, `.runtime/`, `.vscode/`, test screenshots/results, coverage and logs are ignored.
- No ignored sensitive/dependency/runtime path is tracked. No files are staged.
- Postman collection credential/session variables are empty. Its 27 requests were parsed and checked; the Postman desktop runner was not used.
- A `git add --dry-run .` check succeeded without including protected files or changing the index.
- `.gitignore`, `package.json`, the lockfile, backend modules, tests and documentation are intentionally untracked additions and must be included in the eventual project commit.

This is a local audit, not a claim that every possible historical credential can be detected. No remote push was attempted.

## Documentation and confirmed fixes

README coverage includes project overview, stack, folder structure, installation, environment configuration, commands, all 20 API endpoints, storage/authentication behavior, testing, evaluation mapping and linked demonstration instructions. The evaluation guide and Postman collection are present. Local documentation links were checked.

The confirmed audit issues were the stale running backend process and a README file tree that omitted recently added diagnostics/startup files. The process was refreshed and the tree/diagnostic command documented. This audit added its report; no application-code or visual changes were needed.

## Remaining actions and readiness

The **audited repository contents are ready for a safe Git commit and push** with the current ignore rules. Nothing has been staged, committed or pushed.

The previously disclosed Atlas password still requires **manual rotation before public submission or deployment**, unless already rotated separately. Update the credential portion of the ignored local URI privately and restart. This audit did not reset credentials. The absence of credentials in the repository does not undo an earlier disclosure.

Atlas connectivity remains externally dependent and showed a transient TLS alert during startup. Bounded retries recovered, and final real CRUD/browser/live checks passed. Keep the current-IP Atlas access rule and working network available for evaluation. Do not disable TLS or broaden access rules to hide a connection failure.

The website is already available at **http://localhost:3000**. Do not start a duplicate instance. After stopping this project from its own terminal, the normal start command is:

```powershell
npm.cmd start
```

For the professor walkthrough, use [EVALUATION.md](EVALUATION.md). For a recurring Atlas/startup failure, use [STARTUP-TROUBLESHOOTING.md](STARTUP-TROUBLESHOOTING.md) and `npm.cmd run diagnose:db`.
