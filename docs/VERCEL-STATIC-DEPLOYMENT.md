# Vercel static frontend deployment

## Diagnosis (21 November 2026)

Inspected GitHub `main` at `1c605f1a971fdaad05fee176f51378c951349977`, the matching clean checkout, `package.json`, lockfile, `vercel.json`, `render.yaml`, `.gitignore`, server entry points and frontend paths.

Confirmed source configuration faults:

- No frontend build or dedicated static output directory was configured. The same repository contains Express dependencies, `main: server.js`, `start: node server.js`, and `src/app.js`.
- The API rewrite pointed to the literal placeholder `REPLACE_WITH_YOUR_RENDER_URL.onrender.com`.
- `cleanUrls: true` redirected existing `.html` links to extensionless URLs, contrary to the desired original page URLs.
- The homepage was named `Index.html`; a static deployment needs lowercase `index.html` for `/` on Vercel's case-sensitive filesystem.

The reported `500 FUNCTION_INVOCATION_FAILED` means a function was invoked. The likely explanation is an Express framework selection/detection rather than static hosting. Vercel's [Express documentation](https://vercel.com/docs/frameworks/backend/express) lists `server.js` and `src/app.js` as Express entry points. Here, `src/app.js` exports a factory object, while `server.js` starts its listener only as the main module and exports lifecycle helpers. These are appropriate to the existing long-running Render startup, but do not provide an exported Express app for a function import.

**The exact thrown exception and dashboard framework selection are unconfirmed.** No Vercel credentials, linked project metadata or connected Vercel access were available, and GitHub exposed no deployments for the inspected main commit. Runtime/build logs and the failing Vercel URL were unavailable. Do not attribute the function crash specifically to MongoDB, missing secrets or an export error without those logs. The placeholder proxy and clean-URL redirects are separate confirmed faults; they do not explain an invocation failure at `/` by themselves.

## Fix and settings

| Setting in the existing Vercel project | Required value |
| --- | --- |
| Framework Preset | Other |
| Build Command | `npm run build:frontend` |
| Output Directory | `frontend-dist` |
| Root Directory | repository root (blank/default) |

`vercel.json` explicitly sets `framework: null` (Vercel's documented value for Other), the build command, the output directory and `cleanUrls: false`. There are no Express builders, function handlers, catch-all page rewrites or SPA fallbacks. Only `/api/:path*` is externally rewritten to the unchanged Render backend. See [Vercel's configuration reference](https://vercel.com/docs/project-configuration/vercel-json) and [external rewrites](https://vercel.com/docs/routing/rewrites).

The build uses Node built-ins, resolves inputs relative to the repository rather than the terminal's working directory, rejects symbolic links for published inputs, validates required files, removes stale output, and copies an explicit browser-file allowlist. Original HTML/JS/CSS bytes are preserved. Lowercase `index.html` is created first; Linux output also retains `Index.html`. On case-insensitive Windows both names resolve to the same lowercase output file. Navigation continues using the original `.html` links.

No MongoDB/admin credentials are required by the static Vercel deployment. Do not publish the repository root or copy `.env` into the output. Backend API access remains same-origin from the browser, so existing HttpOnly cookies, CSRF headers and authenticated requests continue through the proxy. No Render configuration or backend source changes are included.

## Verification

Frontend regression tests cover the output allowlist, stale-file cleanup, lowercase root entry, unchanged frontend bytes, every HTML link/fragment/static asset and menu image, private-file 404s, exact static settings, API paths/queries, and proxy forwarding of methods, JSON bodies, cookies, CSRF headers, Set-Cookie and status codes.

The browser regression command `npm run test:frontend:browser` serves only `frontend-dist/` and proxies requests to the existing Express test fixture, with isolated MongoDB collections. It exercises INR prices, cart quantities/persistence, order and booking validation/failure/success, receipt navigation, admin login/session/logout and CRUD, legacy orders, mobile navigation, responsive layouts, missing assets and uncaught JavaScript errors. This local proxy verifies the integration contract; it does not claim to emulate Vercel's edge runtime.

GitHub Actions runs syntax/HTML/JSON checks, the full test suite, and browser checks against a disposable MongoDB service on Linux. It never uses production credentials.

Local results: static build passed from both the repository root and a different working directory; all five frontend regression tests passed; syntax/HTML/JSON checks passed; the full suite passed **26/26** with isolated local MongoDB 8.0.16; the generated-frontend browser run passed **20/20**, including actual database success flows. No browser JavaScript errors or failed static assets were observed. The CI workflow YAML parsed successfully.

A separate read-only local-proxy smoke test forwarded `/api/menu?verification=readonly`, `/api/health` and `/api/auth/me` to the configured Render destination and returned the expected 200, 200 and 401 responses. This confirms reachability and the path/query contract from this environment; an actual Vercel deployment still requires verification in the existing project.

Read-only checks against Render returned menu HTTP 200 (Bread Basket INR 250), unauthenticated `/api/auth/me` HTTP 401, and `/api/health` HTTP 200 with `database: "unavailable"`. The configured Atlas database also failed local integration testing with a sanitized TLS-handshake error. These observations do not establish the cause of the Vercel function crash. Existing live booking/order success cannot be claimed while Render reports its database unavailable; restoring that connection is separate backend work outside this change.

After merging, redeploy the **existing** Vercel project from current `main`. Confirm the build uses Other and publishes `frontend-dist` with no functions. Check `/`, `/Index.html`, `/Menu.html`, `/Contact.html`, `/Admin.html`, `/thankyou.html`, `/assets/hero.jpg`, and `/api/menu`. A read-only `/api/health` request should match Render's response; `/api/auth/me` should return 401 while signed out. Check the real admin flow only with authorized credentials. No live order, booking or customer-record mutation is needed to verify the static deployment/proxy.
