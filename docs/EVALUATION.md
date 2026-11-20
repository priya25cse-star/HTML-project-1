# Third evaluation: demonstration guide

The project is **Gourmet au Catering**, by **Pranav, Priya, Jyoti**.

## Before the demonstration

1. Clone the GitHub repository if needed, then open PowerShell in its folder. See the general setup commands in [README.md](../README.md).
2. Run `npm.cmd ci`, then `npm.cmd run setup`. Setup adds only missing environment values; it does not replace your existing MongoDB connection.
3. Open `.env` privately. Read `ADMIN_USERNAME` and the generated `ADMIN_PASSWORD`. Do not display the MongoDB URI or password on a projector.
4. Run `npm.cmd start`. Open `http://localhost:3000`. Use the port in `.env` if different.
5. Open `http://localhost:3000/api/health`. Check `database: "connected"`. A database failure is reported honestly as `unavailable`; transient startup failures get bounded retries and another cycle after 15 seconds. Configuration/authentication errors need correction and restart.
6. Run `npm.cmd run check`, `npm.cmd test`, and `npm.cmd run test:browser` before presenting.

## Demonstrate each mandatory requirement

| Requirement           | What to show                                                                                                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| External API          | Menu page → **Find recipe ideas**. Explain the Express proxy fetches real TheMealDB data and these recipes cannot be ordered. Show `/api/recipes` in Network.                                                                                                                    |
| Node.js and Express   | `server.js`, `src/app.js`, `package.json`; show `npm.cmd start`, JSON parsing, routing, validation and error middleware.                                                                                                                                                         |
| Local JSON save/fetch | Menu tab in the admin dashboard; keep `data/menu.json` open in VS Code. Add a sample dish, refresh the file, edit its price, mark it unavailable, and delete it. Show `/api/menu` and the individual item endpoint. Restart the server after adding a dish to prove persistence. |
| MongoDB full CRUD     | Submit a booking and an order. Sign in at `/Admin.html`; view both requests, change their statuses, then delete them with confirmation. Show the `bookings` and `orders` collections in MongoDB Compass if available.                                                            |

## A suggested walkthrough

1. **Homepage:** show the responsive design, story, services, live menu and original team credits.
2. **Menu:** search `berry`, select a category, add Bread Basket twice, reduce its quantity and show the total. Refresh to demonstrate cart persistence. Enter a fictional name and 10-digit contact number, send the order request and save its reference.
3. **Booking:** fill a fictional name, a 10-digit sample phone number, a future date, number of guests and dietary requirements. Submit once. Show the thank-you receipt. The redirect occurs only after MongoDB saves the request.
4. **Admin:** sign in with your `.env` credentials. Show counts, bookings and orders; change booking status to Confirmed and order status to Preparing. Delete the sample records with confirmation.
5. **JSON storage:** add, edit and delete a temporary menu item; show the actual file changes. No server restart is necessary to see the new menu.
6. **Authorization:** in a private browser window, request `/api/bookings` and receive 401. Public menu reads work, while menu modifications and private records require an admin session.
7. **Validation:** submit an empty order or a negative menu price using Postman and receive 400. Submit an order with a fake price using the supplied collection; the server uses the price in `menu.json`.
8. **External API:** load recipe suggestions. Explain the timeout, cached results and visible failure message.
9. **Testing:** show the actual test output. API tests use temporary menu files and isolated MongoDB collections; they never overwrite the application’s menu or delete normal customer records.

## Postman demonstration

Open `docs/Gourmet au Catering - Third Evaluation/` in Postman using Native Git/Local View or folder import. This is a v3 collection with `.request.yaml` files and `.resources/definition.yaml` collection variables. The local `.postman/resources.yaml` workspace already references it. See [Postman collection schemas](https://learning.postman.com/docs/collections/collections-schemas).

Order requests 17 and 23 include fictional `customerName` and `customerPhone` fields. Request 23 supplies valid contact fields before testing an empty cart. Contact fields are required for new orders; price/status/CRUD behavior is preserved.

Set collection variables `adminUsername` and `adminPassword` locally, using `.env`. Change `baseUrl` if needed. Run requests in collection order. The login response sets an HttpOnly cookie and the collection stores its CSRF token. Create requests save item/booking/order IDs for later read/update/delete requests. Delete requests remove the sample records they created. Cookies must be enabled. Do not export a collection containing your credentials.

## Troubleshooting on Windows

- **PowerShell blocks npm.ps1:** use `npm.cmd` for every command.
- **Database unavailable:** check Atlas network access, database user permissions, internet access and the URI in `.env`; for local MongoDB, ensure the service is running. Do not interpret an HTTP 200 health response alone as a healthy database: inspect its `database` field.
- **Atlas connects intermittently:** run `npm.cmd run diagnose:db` for safe error categories. Watch for `MongoDB connected and authenticated ping passed.` and refresh `/api/health`. Transient startup errors are retried; database routes return 503 during an outage. Readiness tests now fail rather than skip when MongoDB is unavailable. See [startup troubleshooting](STARTUP-TROUBLESHOOTING.md).
- **Sign-in returns 503:** run `npm.cmd run setup`, then restart. Existing short or blank values need to be corrected manually: password at least 12 characters, secret at least 32.
- **Admin requests return 401/403:** sign in again. Sessions expire after eight hours and are cleared by a server restart; writes require the session’s CSRF token.
- **Menu returns 503:** ensure `data/menu.json` is a valid array with unique IDs and every required field. Invalid storage is never silently replaced. Restore the original seed through Git only after backing up your edits.
- **Browser test cannot find a browser:** it uses installed Chrome or Edge on Windows. Set `$env:CHROME_PATH` to your browser executable if installed elsewhere.
- **Opened HTML with file:// or Live Server:** use the Express URL instead; the pages need the APIs on the same origin.

## Inspecting bookings and orders in MongoDB

In Atlas Data Explorer or MongoDB Compass, open the application database selected by your private `MONGODB_URI`, then inspect the `bookings` and `orders` collections. If your existing URI omits a database name, inspect the driver's default database rather than changing a working URI just for the demo. New order documents include `customerName`, `customerPhone`, item/price snapshots, total, status and timestamps. Older order documents may lack contact fields and remain supported.

For the demonstration, use fictional names/contact numbers and the request IDs returned by the website to find only your own sample requests. Keep the URI/credentials private and avoid projecting actual customer data. Automated tests use uniquely named `evaluation_bookings_*` and `evaluation_orders_*` collections instead of editing normal application records.

## Scope and operational notes

This is a catering request system; it does not process payments, send SMS/email or guarantee an event is confirmed immediately. Confirmation is a real admin status update. Dates follow India time; existing USD menu prices are preserved. The JSON write queue and session store support one Node.js process. Multiple server processes need a shared lock/storage and shared sessions. For internet deployment, configure HTTPS and `NODE_ENV=production`; enable `TRUST_PROXY=1` only behind a trusted single reverse proxy. Admin cookies are Secure in production.
