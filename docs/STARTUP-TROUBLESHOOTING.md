# Backend startup and Atlas connection diagnosis

> Investigation findings below are historical (19 November 2026); process IDs must always be rechecked. The baseline was subsequently committed, pushed and merged. The diagnostic instructions remain useful. See [current changes and verification](FINAL-IMPROVEMENTS.md).

This fix preserves the existing UI, APIs, authentication, `.env` and application data. Commands use Windows PowerShell and `npm.cmd`.

## Findings from the local investigation

- Port 3000 was owned by PID 45228 when rechecked. Its complete command line was `node  server.js`; its executable was `C:\Program Files\nodejs\node.exe`. Reading the process's working directory confirmed this exact repository. The original server was reused and not terminated. PIDs can change: recheck them before any future action.
- The running server returned HTTP 200 for `/`, `/Admin.html` and `/api/menu`; `/api/health` reported `database: "connected"`.
- Installed Express invokes the `app.listen` callback for listen errors, passing the error. The old callback treated every invocation as success and immediately read `server.address().port`. On `EADDRINUSE`, no socket is bound and `address()` returns null. The resulting TypeError ran in an asynchronous callback and escaped the outer startup Promise's catch handler.
- `.env` correctly supplied `MONGODB_URI`; credential values were not printed. It contains an Atlas SRV URI. `TEST_MONGODB_URI` was not separately configured. Environment loading now resolves the repository's `.env` using an absolute path, so launching from another folder does not change which file is read. Existing process-environment overrides retain priority.
- DNS SRV/TXT resolution worked; all three Atlas nodes were reachable over TCP. One independent authenticated ping succeeded; another failed with **`ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`**. This is an intermittent TLS peer/negotiation failure, not evidence that dotenv or the password is invalid. Its precise remote cause cannot be determined from that alert alone. An Atlas current-IP access rule, cluster condition or intervening firewall/VPN needs checking if it recurs.
- The old readiness fixture swallowed all database exceptions and returned null. The integration test then called `t.skip`, so a mostly green run could omit real MongoDB CRUD.

## Changes

`server.js` binds HTTP using explicit `listening` and `error` events before opening MongoDB. It logs the actual address only after a successful bind, handles invalid ports/permissions/address conflicts with fixed safe messages and exits 1 for startup failure. Duplicate launches do not open another MongoDB connection or terminate the existing process. Signal shutdown closes HTTP connections, clears retry timers and disconnects MongoDB. An internal `server.shutdown()` method supports graceful lifecycle verification without an HTTP shutdown endpoint.

`src/database.js` requires both a successful connection and authenticated ping, uses 15-second server-selection and 10-second connect timeouts, and allows up to three attempts for transient failures. An unsuccessful transient startup cycle is retried after 15 seconds. Authentication, malformed-URI and certificate-verification failures need manual correction and are not repeatedly retried. Existing connections retain the driver's reconnection behavior. Raw driver errors are never logged.

`src/utils/database-errors.js` inspects nested driver errors and emits only fixed messages. It distinguishes authentication, authorization, DNS, TLS certificate errors, TLS handshake alerts, connection resets, network access failures, timeouts and invalid configuration. It intentionally omits original errors, connection strings, hostnames and credentials from outward-facing errors. TLS verification and database authentication remain enabled.

Both MongoDB and browser readiness tests now fail with a nonzero exit code if real MongoDB is unavailable after bounded retries. They cannot silently omit database success scenarios. Tests still use temporary menu files and uniquely named disposable collections, leaving normal bookings/orders unchanged. Set `TEST_MONGODB_URI` privately if you want a separate test database; when absent, existing fixtures use isolated test collections in the configured database.

## Check port 3000 safely

```powershell
$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
    Get-CimInstance Win32_Process -Filter ("ProcessId = " + $listener.OwningProcess) |
        Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine |
        Format-List
}
```

If this project is already serving correctly, use **http://localhost:3000**. To apply changed backend source to that existing process, press **Ctrl+C in its original terminal**, then run:

```powershell
npm.cmd start
```

Do not launch a second copy on the same port or terminate a PID merely because it appeared in an older report. If an unrelated process needs port 3000, leave it running and start this project on another available port for that terminal:

```powershell
$env:PORT = '3001'
npm.cmd start
```

Remove the temporary override before using the `.env` port again: `Remove-Item Env:PORT -ErrorAction SilentlyContinue`. This changes only the terminal environment, not `.env`.

## Diagnose Atlas without exposing credentials

```powershell
npm.cmd run diagnose:db
npm.cmd run check
npm.cmd test
npm.cmd run test:browser
```

The diagnostic command is read-only: it reports configuration presence, DNS record count and an authenticated ping. It never prints the URI, credentials or raw driver errors. A failed diagnostic exits 1.

If a failure persists:

| Diagnostic | Manual action |
| --- | --- |
| AUTHENTICATION | Atlas → Database Access: verify the database user and password, correct cluster and authSource. This user differs from the Atlas website login. Percent-encode special characters in URI credentials. |
| AUTHORIZATION | Give the test/application database user only the required roles for its database. Readiness cleanup requires permission to create/drop disposable test collections. |
| DNS | Confirm the cluster exists and is running. Check SRV-capable DNS resolution and VPN/network DNS restrictions. |
| TLS_HANDSHAKE | Confirm your current IP in Atlas Network Access, cluster status and outbound firewall access. Check VPN/security software for TLS interception. Retry on an approved stable network; do not disable TLS checks. |
| TLS_CERTIFICATE | Check system time and certificate trust, and resolve approved network interception/certificate issues. Do not enable invalid-certificate options. |
| NETWORK_ACCESS / NETWORK_RESET / TIMEOUT | Check the specific current-IP access rule, cluster availability, network stability and outbound Atlas connectivity. A timeout alone does not establish that credentials are wrong. |
| CONFIGURATION | Privately check `MONGODB_URI` and any existing process-environment override. The loader preserves those overrides and never rewrites `.env`. |

Because the database password was previously exposed, **rotate it manually in Atlas Database Access**, then update the credential portion of your local URI privately and restart the server. No automatic rotation or credential reset was performed. Do not place credentials in documentation, chat, shell command arguments, screenshots or commits. Keep `.env` ignored.

Reference: [Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/) and [Mongoose connection handling](https://mongoosejs.com/docs/connections.html).
