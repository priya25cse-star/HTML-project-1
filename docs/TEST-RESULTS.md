# Historical test results - 19 November 2026

> These execution results retain their original date. Process IDs, Git/publication state and test counts below describe that historical run. The baseline was subsequently committed, pushed and merged. See [current changes and verification](FINAL-IMPROVEMENTS.md).

Verification completed on **19 November 2026**, Windows PowerShell, Node.js **v24.22.3**, npm **11.19.1**. These results describe actual executions in the local repository, not assumed functionality.

| Check | Actual result |
| --- | --- |
| Dependency installation | Completed; `package-lock.json` generated |
| `npm.cmd run check` | Passed JavaScript syntax, recommended HTML validation and project JSON parsing |
| `npm.cmd test` | **19 passed, 0 failed, 0 skipped**, including startup regression tests and real MongoDB CRUD |
| `npm.cmd run test:db` | **1 passed, 0 failed, 0 skipped**, against real configured MongoDB |
| `npm.cmd run test:browser` | **17 scenario groups passed**, using installed headless Chrome and real MongoDB |
| Live Express startup | Verified on `http://localhost:3000` |
| Live health | HTTP 200, `{ "status": "ok", "database": "connected" }` |
| Actual configured admin credentials | Login 200, authenticated session 200, logout 204; no credentials printed |
| Live external recipes | HTTP 200; three real TheMealDB suggestions returned and rendered in the browser |
| Dependency audit | Zero vulnerabilities after updating the development HTML validator |
| Private files | `.env`, source, database JSON, package files and node_modules returned 404 through HTTP |
| Git ignore checks | `.env`, node_modules, .vscode and browser artifacts are ignored; none were tracked |

## API and storage coverage

- All five JSON menu endpoints: list, detail, create, full update and delete.
- Actual file changes, persistence using a newly created store/application, duplicate IDs, immutable IDs, missing records and invalid prices/availability/images.
- Twenty concurrent creates retained all twenty new records. A failed mutation did not poison the write queue.
- Missing, malformed, non-array and duplicate-ID storage returned 503 and was never overwritten.
- Admin authorization on private lists/detail and modification routes; invalid login, signed HttpOnly/SameSite cookies, missing/incorrect CSRF, cross-origin writes, logout invalidation and login rate limits.
- Input validation for bookings, impossible/past dates, phone numbers, guest bounds, long requirements, invalid record IDs and unsupported fields.
- Empty orders, unknown/unavailable menu items, invalid/duplicate quantities, and tampered client prices and totals.
- Malformed JSON, oversized requests, unknown endpoints, security headers and static file restrictions.
- External recipe field normalization, caching, empty results and provider failure, using controlled upstream responses for those specific edge cases.

## Real MongoDB coverage

Booking and order CRUD used the existing configured MongoDB service. Tests created uniquely named `evaluation_bookings_*` and `evaluation_orders_*` collections in the configured database, then removed only those collections. Normal application records and the original menu were preserved.

Created bookings/orders were read from lists and individual endpoints, updated, independently read using a second Mongoose client, deleted, and verified absent. Orders sent with a fake client price were persisted with the actual menu prices and correct total. Timestamps were checked. Success was not simulated.

The tests use isolated collections in the configured database and completed successfully. `TEST_MONGODB_URI` was not separately configured; no database target or credentials were changed. Readiness is now strict: after bounded retries, an unavailable database fails both integration and browser commands with a sanitized error and nonzero exit code. There is no silent database skip.

## Startup regression coverage

Nine additional checks cover a successful HTTP bind; the actual Express failure callback receiving EADDRINUSE while `address()` is null; safe listener rejection; a duplicate CLI launch exiting 1 before opening MongoDB; port/permission/address errors; graceful shutdown and signal-handler cleanup; environment loading independently of the working directory; sanitized nested Atlas error classification; bounded transient retries and no repeated authentication attempts. Intentional missing-configuration tests print a CONFIGURATION diagnostic without changing `.env`.

The existing PID 45228 was verified to run `node  server.js` from this repository and was reused on port 3000. A real `npm.cmd start` duplicate launch exited 1 with an actionable EADDRINUSE message and no TypeError. The corrected `npm.cmd start` also ran successfully on temporary OS-selected port 57877, passed an authenticated MongoDB ping, and served the homepage, admin page and six-item JSON menu. That temporary server was stopped; the original port-3000 process was left running.

Atlas SRV/TXT DNS and TCP probes initially passed. Independent authenticated connections exposed an intermittent `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`; one separate short DNS preflight also failed while the authenticated driver check subsequently passed. These are observed network/TLS/DNS symptoms, not proof of invalid credentials. The exact remote cause of a TLS internal alert cannot be established locally. Final CRUD and browser runs passed against real MongoDB. See [startup troubleshooting](STARTUP-TROUBLESHOOTING.md) for safe diagnostics and manual actions.

`npm.cmd run diagnose:db` passed its authenticated ping. Source/documentation and local Git-history scans found no matches for current credential values. Hash comparisons verified `.env` and the application menu file were unchanged. TLS certificate verification was not disabled.

## Browser coverage

1. Homepage live featured menu and desktop screenshot.
2. Menu loading, search, category filters and empty state.
3. Cart add, increment, decrement, totals and persistence after reload.
4. Cart removal, empty checkout guard and live daily special.
5. Real external recipe cards, separated from the purchasable menu.
6. Failed order displays an error and preserves the cart.
7. Successful checkout persists a real MongoDB order and clears the cart.
8. Failed booking keeps form data, stays on the form and submits exactly once; pending submissions disable the button.
9. Successful booking persists in MongoDB before redirect and shows a receipt.
10. Direct thank-you visits do not claim a saved booking.
11. Admin login and actual summary counts.
12. Admin menu add/edit/availability/delete confirmation and actual JSON file changes.
13. Booking/order status changes and deletion persist in MongoDB.
14. Logout clears the authenticated dashboard.
15. All five pages checked for horizontal overflow at 375, 768 and 1440 px.
16. Mobile navigation open/close, Escape key, page navigation and mobile screenshot.
17. No uncaught browser JavaScript errors.

Success paths use actual Express APIs and MongoDB. Only deliberate failure cases intercept responses with 503. Screenshots in `test-results/home-desktop.png` and `test-results/home-mobile.png` were visually inspected; a Windows encoding issue affecting decorative symbols was corrected and the screenshots regenerated. The directory is ignored by Git.

## Limits and manual steps

- Atlas/network connectivity was intermittent during startup. The server recovered through its automatic retry; the final live health check showed connected. Booking/order APIs return 503 during a database outage. Keep working network access and Atlas permissions for your demonstration.
- The generated 27-request Postman collection was validated as JSON; the Postman desktop runner was not used. Automated API/browser tests independently exercised the CRUD endpoints. Set credentials locally before running the collection.
- Chrome was used for browser execution; Firefox and Safari were not tested. Responsive checks cover the stated widths, not every physical device.
- No payment, email/SMS or hosted deployment is included. No Git commit or push was performed.
- A production deployment needs HTTPS, appropriate environment settings, and external session/file coordination if multiple Node processes are used. Local `.env` already contains generated admin credentials; read them privately before demonstrating staff access.
