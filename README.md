# Gourmet au Catering

A complete catering website by **Pranav, Priya, Jyoti**, upgraded in the existing repository for the university third evaluation. It uses HTML, CSS, vanilla JavaScript, Node.js, Express and MongoDB/Mongoose. The original page names, branding and six menu dishes are preserved.

## Quick start (Windows PowerShell)

For a fresh clone, use the commands below. If already cloned, open PowerShell in the repository folder and begin with `npm.cmd ci`; do not clone inside the existing folder.

```powershell
git clone https://github.com/priya25cse-star/HTML-project-1.git
Set-Location -LiteralPath '.\HTML-project-1'
npm.cmd ci
npm.cmd run setup
npm.cmd start
```

Open **http://localhost:3000**. If `PORT` differs in `.env`, use that port. Open `/Admin.html` or use **Staff sign in** in the footer. Read `ADMIN_USERNAME` and `ADMIN_PASSWORD` privately from `.env`.

`setup` preserves existing values and appends missing settings. It generates a random admin password and session secret; it never writes them into frontend files or prints them. Your existing MongoDB URI is retained. `.env` is ignored by Git. On a fresh machine, setup supplies a local MongoDB URI: install/start MongoDB Community Server or replace that URI with your Atlas connection string.

Use `npm.cmd`, since PowerShell may block `npm.ps1`. Use Express rather than opening HTML directly or using Live Server.

## Vercel frontend with the existing Render backend

Vercel publishes only the generated static frontend; Express remains at `https://gourmet-catering-backend.onrender.com`. In the **existing** Vercel project's Build and Deployment settings, use:

| Setting | Value |
| --- | --- |
| Framework Preset | **Other** |
| Build Command | `npm run build:frontend` |
| Output Directory | `frontend-dist` |
| Root Directory | **repository root** (leave blank/default) |

`vercel.json` pins Other with `framework: null`, the build command and output directory. Keep `.html` URLs: `cleanUrls` is disabled. The build retains the original page names and creates lowercase `index.html` for `/`. It copies only the five public pages, `style.css`, `script.js`, `admin.js`, and allowlisted image/font/media files under `assets/`; asset source notes, `.env`, MongoDB credentials, backend code, menu storage, dependencies and private source files are excluded. `frontend-dist/` is generated and Git-ignored. When adding a new public script or stylesheet, add it to the explicit build allowlist.

The sole API rewrite proxies `/api/:path*` to `https://gourmet-catering-backend.onrender.com/api/:path*`. Browser requests stay on the frontend origin, preserving the existing cookie/CSRF admin flow, INR prices, cart, orders and bookings. No backend credentials or `API_BASE_URL` override are needed on Vercel. Render's configuration and customer records are unchanged by this frontend build.

```powershell
npm.cmd run build:frontend
npm.cmd run test:frontend
npm.cmd run check
npm.cmd test
npm.cmd run test:frontend:browser
```

The frontend unit tests need no database. Full API/database and browser tests need MongoDB and use isolated test collections; set `TEST_MONGODB_URI` to a separate test database if desired. The frontend browser command serves **generated static files** on one port and proxies API requests to an isolated local Express fixture on another. This checks the same-origin integration without sending test orders to Render. GitHub Actions repeats these checks on Linux with a disposable MongoDB service, including the case-sensitive `Index.html` and `index.html` paths.

See [deployment diagnosis and verification](docs/VERCEL-STATIC-DEPLOYMENT.md) for confirmed configuration faults, runtime-log limitations and production verification steps. After merging, redeploy the existing Vercel project from the updated `main` branch.

## Prerequisites and dependencies

Install Node.js 24 or newer (npm is included). Use a MongoDB Atlas database user/connection string or a running local MongoDB server. Chrome or Edge is needed for browser tests; Postman is optional for API demonstrations.

`npm.cmd ci` installs the versions in `package-lock.json`: Express, Mongoose, dotenv, Helmet and express-rate-limit at runtime, plus Supertest, Playwright and html-validate for development/testing. No global npm packages are required.

## Features

- Warm cream, forest green and terracotta design; local food photography, responsive layouts and shared navigation/footer.
- Homepage story and services, with featured dishes loaded from the menu API.
- Dynamic menu, search, category filters, INR (₹) prices, availability and a daily special derived from actual menu data.
- Cart add/remove, quantity limits, integer-cent totals and persistence across refresh. Only IDs and quantities are stored in the browser; the server computes final prices from the menu file.
- Real MongoDB orders with customer name/contact number, plus booking requests. Booking redirects only after database persistence. Failures retain the form/cart; duplicate clicks are blocked while sending.
- Accessible labels, keyboard controls, focus indicators, skip links, mobile menu, reduced-motion support and live success/error messages.
- Staff dashboard: login/logout, counts, booking/order status changes and deletion with confirmation, menu creation/editing/deletion and availability controls.
- External recipe inspiration via TheMealDB, explicitly separate from purchasable dishes, with a timeout, caching, empty state and failure handling.
- Server-side authorization, HttpOnly signed session cookies, CSRF tokens, same-origin write checks, login/submission rate limits, Helmet headers and a static file allowlist.

This is a catering **request** system, without payments, SMS or email delivery. Pending requests require staff confirmation.

## Structure

```text
HTML-project-1/
  Index.html                 Homepage (original URL preserved)
  Menu.html                  Live menu, cart and recipe ideas
  Contact.html               Booking request form
  thankyou.html              Persisted-booking receipt
  Admin.html                 Staff dashboard
  style.css                  Shared responsive styles
  script.js                  Shared frontend behavior and API calls
  admin.js                   Authenticated dashboard behavior
  server.js                  Startup, DB connection retries and shutdown
  package.json
  package-lock.json
  .env.example               Configuration template, no secrets
  .gitignore
  assets/                    Local photos, favicon and source notes
  data/menu.json             Actual persistent menu data
  src/
    app.js                   Express middleware, routing and public file allowlist
    config.js                Environment loading, including Windows UTF-16 support
    database.js              Actual MongoDB connection and availability guard
    middleware/auth.js       Login, signed cookies, session authorization and CSRF
    models/index.js          Booking and Order Mongoose schemas
    routes/menu.js           JSON menu CRUD
    routes/records.js        Reusable MongoDB booking/order CRUD
    routes/recipes.js        TheMealDB proxy and cache
    utils/errors.js          Centralized JSON errors
    utils/database-errors.js Sanitized Atlas error classification
    utils/menu-store.js      Serialized fs/promises read/modify/write storage
    utils/validation.js      Server validation and authoritative order pricing
  scripts/
    setup.js                 Add only missing environment settings
    check.js                 JavaScript, HTML and JSON validation
    diagnose-db.js           Read-only Atlas DNS and authenticated ping diagnosis
  tests/
    api.test.js              API, JSON storage, validation and auth tests
    mongodb.test.js          Real MongoDB CRUD and independent persistence reads
    browser.cjs              Chrome/Edge end-to-end browser checks
    helpers.cjs              Temporary test menu and test credentials
    database-fixture.cjs     Unique disposable test collections
    startup.test.js          Port conflicts, shutdown, environment and retry tests
  docs/
    EVALUATION.md            Professor demonstration and troubleshooting guide
    TEST-RESULTS.md          Verified results and environment limitations
    STARTUP-TROUBLESHOOTING.md  Backend startup and Atlas troubleshooting
    PRE-SUBMISSION-AUDIT.md  Final evaluation and Git safety audit
    Gourmet au Catering - Third Evaluation/  Postman v3 YAML collection
    FINAL-IMPROVEMENTS.md    Current changes and fresh verification
    PUBLICATION-VERIFICATION.md  Final verification before publication
  README.md
  PROJECT_CHARTER.md         Project scope, architecture, outcomes and team
```

`.env`, `node_modules/`, `.vscode/`, runtime files and browser screenshots in `test-results/` remain local and ignored. Git history and team credits are retained. The third-evaluation improvements include contactable orders, legacy-order compatibility, the project charter and reproducible verification. Historical reports describe their execution-time Git state; use the GitHub branch/PR history for current publication status.

## Environment

`.env.example` documents required settings; optional test/browser overrides are listed below. Alternatively, create `.env` from that template **only if you do not already have one**.

| Variable           | Meaning                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `PORT`             | HTTP port, default 3000                                                                                               |
| `MONGODB_URI`      | Actual MongoDB/Atlas connection string; existing value is preserved                                                   |
| `ADMIN_USERNAME`   | Staff login name, generated as `admin` if missing                                                                     |
| `ADMIN_PASSWORD`   | Your private password, at least 12 characters; setup generates one if missing                                         |
| `SESSION_SECRET`   | At least 32 characters; setup generates a random secret if missing                                                    |
| `NODE_ENV`         | `development` locally; `production` requires HTTPS and enables Secure cookies                                         |
| `TRUST_PROXY`      | Default `0`; use `1` only behind one trusted reverse proxy                                                            |
| `TEST_MONGODB_URI` | Optional environment override for real DB tests; otherwise they use the configured URI with isolated test collections |
| `CHROME_PATH`      | Optional installed browser executable for browser tests                                                               |

For Atlas, grant the database user the required access and allow your IP in Atlas Network Access. Never copy credentials into JavaScript, screenshots, Postman exports or Git.

For a new Atlas setup:

1. Create or select your cluster and create a database user with the required access to your application database. This is different from your Atlas website login.
2. Add your current client IP to the project's Network Access list.
3. Use the Node.js driver connection template from Atlas and fill it privately in `MONGODB_URI` inside ignored `.env`. Percent-encode special characters in credentials. Choose an application database explicitly for a new deployment; preserve an existing working URI.
4. Set your own admin username/password and session secret, or let `npm.cmd run setup` generate missing local settings. Start Express and inspect `/api/health`; a working database reports `connected`.

Do not disable TLS verification to resolve connection problems. See [Atlas troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/) and `npm.cmd run diagnose:db` for safe diagnostics.

If MongoDB is unavailable, the public website, JSON menu and menu administration still work. Booking/order APIs return 503; they do not pretend to save anything. Startup makes up to three attempts for transient failures and retries an unsuccessful transient connection cycle after 15 seconds. Authentication, URI and certificate configuration errors require correction and restart. `/api/health` returns an explicit `database` field. Initial network timeouts are bounded.

## Commands

| Command                    | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `npm.cmd install`          | Install locked dependencies                                         |
| `npm.cmd run setup`        | Add missing local settings without replacing configured values      |
| `npm.cmd start`            | Run the Express server                                              |
| `npm.cmd run dev`          | Node's built-in watch mode                                          |
| `npm.cmd run check`        | JavaScript syntax, recommended HTML validation and JSON parsing     |
| `npm.cmd test`             | Automated API/storage/auth validation plus real MongoDB integration |
| `npm.cmd run test:db`      | Real MongoDB integration only                                       |
| `npm.cmd run test:browser` | Headless installed Chrome/Edge checks and screenshots               |
| `npm.cmd audit`            | Dependency vulnerability audit                                      |
| `npm.cmd run diagnose:db`  | Read-only database diagnosis with sanitized errors                   |

## Local JSON menu APIs

The menu is read from **`data/menu.json` on disk**, seeded with Bread Basket, Belgian Waffle, Blueberry Pancakes, Honey Almond Granola, Scrambled Eggs and Seasonal Garden Plate at their original prices. The menu has no separate hardcoded frontend/server array.

Each object has `id`, `name`, `category`, `description`, `price`, `image`, and `available`. IDs are generated with `crypto.randomUUID()` when omitted; supplied IDs must be unique and cannot change on update. Prices must be positive and have at most two decimal places. Images must be HTTPS URLs or asset paths. Categories are normalized to lowercase.

POST, PUT and DELETE use `fs/promises` to read, validate and modify the file. A Promise queue serializes the complete read/modify/write operation. Changes go to a unique temporary file and are atomically renamed over the original. A failed operation does not block later operations. Corrupt/missing storage returns 503 and is never silently overwritten. Records persist across server restart. Run **one Node process** against the file; the queue does not coordinate multiple independent server processes.

Example body for POST or full replacement with PUT:

```json
{
  "name": "Seasonal Soup",
  "category": "kitchen",
  "description": "A sample seasonal vegetable soup.",
  "price": 8.25,
  "image": "/assets/garden.jpg",
  "available": true
}
```

GET returns an array (collection) or an item object. POST returns the created item and 201, PUT returns the replacement and 200, DELETE returns 204 with no body. Inspect the actual file while using the admin dashboard or Postman.

## MongoDB CRUD

`Booking` and `Order` models use real Mongoose persistence and automatic `createdAt`/`updatedAt` timestamps. The normal collections are `bookings` and `orders` in the database selected by your URI. If the URI omits a database, MongoDB's default database selection applies; specify an explicit application database for a new setup.

Booking creation accepts:

```json
{
  "name": "Evaluation Guest",
  "phone": "9000000000",
  "people": 25,
  "date": "2099-12-01",
  "message": "Fictional sample; vegetarian menu requested."
}
```

Names are required, phone numbers contain 10 digits, guests must be integers from 1 to 10000, dates must be real calendar dates today or later in India time, and special requirements allow up to 200 characters. Status defaults to `Pending`; admin PATCH supports `Pending`, `Confirmed`, `Cancelled`.

Order creation accepts:

```json
{
  "customerName": "Evaluation Customer",
  "customerPhone": "9000000000",
  "items": [
    { "menuId": "bread-basket", "quantity": 2 },
    { "menuId": "belgian-waffle", "quantity": 1 }
  ]
}
```

Every new order requires `customerName` (1-100 characters after trimming) and `customerPhone` (a 10-digit string). Both browser and server validate these fields. Contact details are stored in MongoDB and displayed only in authenticated staff views; the public receipt contains no contact fields. They are not stored in browser localStorage. Failed requests retain the form/cart; successful requests clear both. Existing documents without these fields remain readable and their statuses can be updated; the dashboard labels them as legacy orders. No migration or update of old records is performed.

The server verifies each unique menu ID and availability, accepts 1 to 100 servings per item and 1 to 50 distinct items, snapshots item names/prices and calculates the total in integer cents. Client-supplied `price`, item `name` and `total` are ignored. Orders retain their prices if the menu changes later. Admin PATCH supports `Pending`, `Confirmed`, `Preparing`, `Completed`, `Cancelled`.

PATCH updates status only. It rejects unsupported fields to prevent mass assignment. Admins can create through the public POST routes, read lists or individual records, update status and delete records. Public creation returns a minimal receipt (`bookingId`/`orderId`, status, and order total); it does not expose customer record lists.

## Complete endpoint table

| Method | Endpoint            | Access               | Success                            |
| ------ | ------------------- | -------------------- | ---------------------------------- |
| GET    | `/api/health`       | Public               | 200; inspect `database` separately |
| POST   | `/api/auth/login`   | Public, rate limited | 200, cookie and CSRF token         |
| GET    | `/api/auth/me`      | Admin                | 200, username and CSRF token       |
| POST   | `/api/auth/logout`  | Admin + CSRF         | 204                                |
| GET    | `/api/menu`         | Public               | 200, array                         |
| GET    | `/api/menu/:id`     | Public               | 200, item                          |
| POST   | `/api/menu`         | Admin + CSRF         | 201, created item                  |
| PUT    | `/api/menu/:id`     | Admin + CSRF         | 200, full replacement              |
| DELETE | `/api/menu/:id`     | Admin + CSRF         | 204                                |
| POST   | `/api/bookings`     | Public, rate limited | 201, saved receipt                 |
| GET    | `/api/bookings`     | Admin                | 200, array                         |
| GET    | `/api/bookings/:id` | Admin                | 200, record                        |
| PATCH  | `/api/bookings/:id` | Admin + CSRF         | 200, updated record                |
| DELETE | `/api/bookings/:id` | Admin + CSRF         | 204                                |
| POST   | `/api/orders`       | Public, rate limited | 201, saved receipt and total       |
| GET    | `/api/orders`       | Admin                | 200, array                         |
| GET    | `/api/orders/:id`   | Admin                | 200, record                        |
| PATCH  | `/api/orders/:id`   | Admin + CSRF         | 200, updated record                |
| DELETE | `/api/orders/:id`   | Admin + CSRF         | 204                                |
| GET    | `/api/recipes`      | Public, rate limited | 200, normalized external recipes   |

Errors consistently return `{ "message": "..." }`: 400 invalid input/JSON/ID, 401 missing session or incorrect credentials, 403 missing CSRF or disallowed origin, 404 missing record/route, 409 duplicate ID, 413 oversized body, 429 rate limit, 502 recipe provider failure, 503 unavailable storage/database/configuration, and a generic 500 for unexpected errors. Request bodies are limited to 20 KB.

## Admin authentication

Login submits environment-configured credentials to Express. The server compares credentials with timing-safe digest comparison, creates a random opaque session, signs its cookie using `SESSION_SECRET`, and sends it as HttpOnly/SameSite Strict (also Secure in production). Sessions expire after eight hours and are invalidated on logout or server restart. Session state is server-side; no admin secret or session token is stored in localStorage.

After login, authenticated GET `/api/auth/me` can recover the CSRF token after a refresh. Every admin mutation must include `X-CSRF-Token` and the session cookie. The dashboard does this automatically. There is no public default admin password. Login allows ten attempts per IP in 15 minutes; public booking/order submissions share a limit of 30 per IP in 15 minutes. The design supports a single server process; use a shared session store and distributed rate limiter for a larger deployment.

## External API

The menu page loads inspiration on demand using `/api/recipes`. Express fetches TheMealDB's educational endpoint `https://www.themealdb.com/api/json/v1/1/search.php?s=salad`, normalizes three recipe suggestions, applies a six-second timeout and caches results for ten minutes. Concurrent requests share one upstream fetch. Recipes have provider links and cannot be added to the cart. There is no private API key. The public `1` developer key is for educational use: see [TheMealDB documentation](https://www.themealdb.com/api.php).

## Testing and safety of test data

`npm.cmd run check` validates source syntax, HTML and JSON. `npm.cmd test` exercises all API families, auth/CSRF protections, file persistence with a fresh store, 20 concurrent menu mutations, corrupt storage, invalid requests and server price calculations. `mongodb.test.js` connects to real MongoDB and verifies CRUD plus an independent second-client read. Readiness is strict: if MongoDB cannot connect after bounded retries, the test fails with a sanitized diagnosis and a nonzero exit code. It never silently skips real database verification.

Tests use temporary menu files and uniquely named `evaluation_bookings_*` / `evaluation_orders_*` MongoDB collections, cleaned after the run. They do not overwrite `data/menu.json`, drop the application database or delete normal records. The database user needs permission to create/drop these test collections; set `TEST_MONGODB_URI` to a separate test database when appropriate. Test credentials are randomly generated in memory and are unrelated to your real admin password.

Browser tests use an installed Windows Chrome or Edge (or `CHROME_PATH`). They test menu search, filtering, cart quantities/persistence, form failure states, duplicate-submission prevention, real database success flows, admin CRUD, mobile navigation and 375/768/1440 px layouts. Only explicit **failure scenarios** are intercepted; success flows use actual APIs and MongoDB. Screenshots and a result JSON file go to ignored `test-results/`.

Open the folder-based [Postman v3 collection](<docs/Gourmet au Catering - Third Evaluation>) in Postman using Native Git/Local View or folder import. Requests are `*.request.yaml` files; variables are in `.resources/definition.yaml`. This replaces the earlier single-file JSON export, and `.postman/resources.yaml` already references it. Set credentials locally, enable cookies, and run requests in order. Keep shared credential variables blank. Request 17 includes the required customer fields; its fake food price still verifies server-authoritative pricing. The collection captures CSRF and record IDs. The [evaluation guide](docs/EVALUATION.md) provides the walkthrough. See [publication verification](docs/PUBLICATION-VERIFICATION.md) for the final fresh run; the [local review](docs/FINAL-IMPROVEMENTS.md) and [19 November test report](docs/TEST-RESULTS.md) retain their original execution context.

The [Project Charter](PROJECT_CHARTER.md) describes the scope, architecture and original team.

## Third evaluation mapping

| University requirement                      | Implementation                                                      | Demonstration                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Fetch/display external API data if required | `src/routes/recipes.js`, recipe cards in `script.js`                | Menu -> Find recipe ideas; `/api/recipes`                                    |
| Node.js and Express                         | `server.js`, `src/app.js`, modular routes, dotenv, error handling   | `npm.cmd start`; health and JSON API responses                               |
| Save/fetch local JSON through Express       | `data/menu.json`, `src/utils/menu-store.js`, full menu CRUD         | Admin menu edits visibly change the actual file and survive restart          |
| Complete Express + MongoDB CRUD             | Mongoose models and `src/routes/records.js` for bookings and orders | Public create; authenticated list/detail/status update/delete; real DB tests |

For startup failures, safe port handling and Atlas TLS diagnosis, see [startup troubleshooting](docs/STARTUP-TROUBLESHOOTING.md). Run `npm.cmd run diagnose:db` for a read-only, sanitized connection check.

For server behavior reference, see [Express error handling](https://expressjs.com/en/guide/error-handling/) and [Mongoose connections](https://mongoosejs.com/docs/connections.html).
