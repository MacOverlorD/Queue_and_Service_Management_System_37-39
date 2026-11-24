# Sprint 3 Hardening

Issue #68. Author TauForge, reviewer MacOverlorD. Sprint 3, **contract only** for Deliverable 2 (planned, not implemented). Requirements: NFR-10, NFR-11, NFR-01, NFR-05, NFR-07. Closes known gaps G-03, G-04, G-10 and Lab 6 findings #56, #57. Depends on: F-02 (sessions, login), F-03 (guards), Lab 5 (CI, deploy).

## 1. Behavior

Sprint 3 closes the security, operations and quality gaps that earlier sprints recorded. Nothing here adds a user feature. Six items, each independent, so they can be built and merged one by one:

| Item | Source | Summary |
|---|---|---|
| H-01 Security headers | Lab 6 #56 | Standard security response headers on every reply; no `X-Powered-By`. |
| H-02 Production CORS | Lab 6 #57 | In production, no cross-origin access unless `CLIENT_ORIGIN` is set on purpose. |
| H-03 Login rate limit | G-03 | Repeated failed logins for one account and client are refused for a while. |
| H-04 Session cleanup | G-04 | Expired session rows are removed regularly. |
| H-05 Coverage gate | NFR-11 | CI fails when server domain/service coverage is below 80% lines. |
| H-06 Performance check | NFR-10, G-10 | A script measures p95 latency with 200 active entries; a check proves the 10 s default refresh. |

## 2. Specification

### H-01 Security headers (#56)

Applied by one middleware before all routes, so API replies, static files, the SPA fallback and error replies all carry them.

| Header | Value | Where |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | all replies |
| `X-Frame-Options` | `DENY` | all replies |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | only when `NODE_ENV=production` |
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data:; frame-ancestors 'none'` | HTML replies (the SPA `index.html`) |
| `Referrer-Policy` | `no-referrer` | all replies |
| `X-Powered-By` | removed (`app.disable("x-powered-by")`) | all replies |

Implementation may use a small hand-written middleware or the `helmet` package; the table is the contract. The built client must still load under the CSP (no inline scripts); the e2e journeys are the check.

### H-02 Production CORS (#57)

- `NODE_ENV=production` and `CLIENT_ORIGIN` unset or empty: the CORS middleware is **not mounted**. No `Access-Control-Allow-*` header is sent. The client is served from the same origin (Lab 5), so nothing needs CORS.
- `CLIENT_ORIGIN` set: only that exact origin is allowed, with credentials (unchanged behavior).
- Not production: default stays `http://localhost:5173` for local development.
- `.env.example` and `docs/deployment` describe the rule; no real values.

### H-03 Login rate limit (G-03)

- Key: normalized email plus client IP. A successful login clears the counter for that key.
- After **10** failed attempts for a key within **15 minutes**, further `POST /api/auth/login` for that key return **429 `TOO_MANY_ATTEMPTS`** with a `Retry-After` header (seconds), without checking the password. Other keys are unaffected.
- The 429 body is the shared error shape and gives no hint whether the email exists. A valid user cannot be locked out by another client's IP.
- Store: in memory (one process). Cloud Run may run several instances, so the limit is per instance; this is stated as a known limitation, not hidden.
- Settings come from `LOGIN_MAX_ATTEMPTS` (default 10) and `LOGIN_WINDOW_MINUTES` (default 15), listed in `.env.example`, so tests and demos can use small values.

### H-04 Session cleanup (G-04)

- `purgeExpiredSessions(prisma, now)` deletes every `Session` row with `expiresAt <= now` and returns the number deleted.
- It runs once at server start and then every hour (`setInterval`, cleared on shutdown and unref'd so it never keeps the process or tests alive).
- Live sessions are never touched, and a request with an expired cookie still gets 401 (NFR-05 unchanged).

### H-05 Coverage gate (NFR-11)

- `npm --prefix server run test:coverage` runs Vitest with the v8 coverage provider over `src/services`, `src/middleware`, `src/auth` and `src/http` with thresholds `lines: 80`.
- CI (`CI & Docker Build`) runs it in place of the plain test step and fails the job below the threshold. The coverage summary is kept as a CI log or artifact.
- Rule: raise coverage by adding real tests; no `/* c8 ignore */`, no excluding files to reach the number.

### H-06 Performance and refresh checks (NFR-10, G-10)

- `server/scripts/perf-check.ts`: against a base URL (local or the deployed service), logs in as a seeded operator and customer, prepares 200 active entries, then calls each of join, call-next, list entries and display 100 times, and prints p50/p95/max per operation. Exit code is non-zero when any p95 is 500 ms or more.
- Safety: it runs only against a database or URL the caller names, uses synthetic accounts, and prints no credentials. Credentials come from environment variables, never from the script.
- G-10: an e2e test with the default refresh (no `VITE_REFRESH_MS`) uses Playwright's fake clock to check that `/my-ticket` requests its data again within 10 seconds.

### Errors and permissions

No new roles and no new endpoints. New responses: 429 `TOO_MANY_ATTEMPTS` (H-03). Every existing 401/403/404 behavior is unchanged; the F-03 route matrix does not change.

### Data and UI

Data: no schema change (H-04 only deletes rows). UI: no change, except that the login screen shows the API message when it receives 429.

## 3. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-H01-01 | `GET /api/health`, `GET /` (HTML) and a 404 `/api/...` reply each carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy`, and none carries `X-Powered-By`. |
| AC-H01-02 | The HTML reply carries the CSP of the table; `Strict-Transport-Security` is sent only when `NODE_ENV=production`. |
| AC-H01-03 | With the headers on, the Sprint 1 and Sprint 2 e2e journeys still pass. |
| AC-H02-01 | In production with `CLIENT_ORIGIN` unset, a request with `Origin: https://attacker.example` or `http://localhost:5173` gets no `Access-Control-Allow-Origin`. |
| AC-H02-02 | With `CLIENT_ORIGIN` set, only that origin is echoed; another origin gets none. Outside production the default origin is still `http://localhost:5173`. |
| AC-H03-01 | After the configured number of failed logins for one email and IP, the next login (even with the right password) gets 429 `TOO_MANY_ATTEMPTS` with `Retry-After`. |
| AC-H03-02 | A different email from the same IP, and the same email below the limit, are not blocked; a successful login resets the counter. |
| AC-H03-03 | The 429 reply is identical for a known and an unknown email. |
| AC-H04-01 | `purgeExpiredSessions` deletes expired sessions, keeps live ones and returns the deleted count. |
| AC-H04-02 | A request with a purged or expired cookie gets 401 `UNAUTHENTICATED`. |
| AC-H05-01 | `test:coverage` reports at least 80% lines for the scoped server modules and exits non-zero below the threshold; the CI job runs it. |
| AC-H06-01 | `perf-check.ts` reports p95 under 500 ms for join, call-next, list entries and display with 200 active entries on the local database, and exits non-zero otherwise. |
| AC-H06-02 | The same script is run once against the deployed service and its output is kept as evidence (NFR-10). |
| AC-H06-03 | With the default refresh setting, the customer ticket page re-requests its data within 10 seconds (G-10). |

## 4. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-H01-01 | AC-H01-01 | api | App created for tests | GET `/api/health`, GET `/`, GET `/api/nope` | Each has `nosniff`, `DENY`, `Referrer-Policy`; none has `X-Powered-By` |
| TEST-H01-02 | AC-H01-02 | api | Built client present; app with `NODE_ENV=production` and with development | GET `/` in both | CSP header equals the table value; HSTS present only in production |
| TEST-H01-03 | AC-H01-03 | e2e | Header middleware on | Run all Playwright specs | All pass, 0 failed |
| TEST-H02-01 | AC-H02-01 | api | Production, `CLIENT_ORIGIN` unset | GET `/api/health` with two foreign origins | No `access-control-allow-origin` |
| TEST-H02-02 | AC-H02-02 | api | `CLIENT_ORIGIN=https://app.example.test`; then development | Requests with matching and non-matching origin | Matching origin echoed with credentials; other gets none; dev default is `http://localhost:5173` |
| TEST-H03-01 | AC-H03-01 | api | `LOGIN_MAX_ATTEMPTS=3` | 3 wrong logins, then the correct password | 4th attempt 429 `TOO_MANY_ATTEMPTS`, `Retry-After` present |
| TEST-H03-02 | AC-H03-02 | api | Same setup | 2 wrong logins then a correct one; another email after 3 failures on the first | Correct login 200 and counter reset; other email not blocked |
| TEST-H03-03 | AC-H03-03 | api | Limit reached for a known and an unknown email | Compare both 429 replies | Same status, code and body shape |
| TEST-H04-01 | AC-H04-01 | integration | 2 expired and 1 live session rows | `purgeExpiredSessions` | Returns 2; only the live row remains |
| TEST-H04-02 | AC-H04-02 | api | Session expired and then purged | Request with that cookie | 401 `UNAUTHENTICATED` |
| TEST-H05-01 | AC-H05-01 | ci | Current suite | `npm --prefix server run test:coverage` | Prints per-file and total lines at least 80%; the CI run fails when a threshold is raised above the measured value (checked once, then reverted) |
| TEST-H06-01 | AC-H06-01 | perf | Local database with 200 active entries | `perf-check.ts` against the local server | p95 under 500 ms for all four operations; exit 0 |
| TEST-H06-02 | AC-H06-02 | perf | Deployed URL and synthetic accounts | `perf-check.ts` against the service | Output saved with the revision name; exit 0 or the failure is disclosed |
| TEST-H06-03 | AC-H06-03 | e2e | No `VITE_REFRESH_MS`; fake clock | Open `/my-ticket`, advance the clock 10 s | A second `GET /api/me/entries` was sent |

## 5. Status at Deliverable 2

| Item | Status |
|---|---|
| H-01 .. H-06 | **Planned.** Contract written; no code and no test has been run. Their rows in the traceability matrix say "planned". |
| Target | TauForge, merged and verified by Wed 9 Dec; CI and deployed checks (TEST-H05-01, TEST-H06-02) in the final release. |

## 6. Definition of Done

- Each item merged through its own reviewed PR into the Sprint 3 staging branch; contract merged first; first commit of each is the failing test with saved output.
- AC-H01-01..H06-03 implemented; TEST-H01-01..H06-03 executed and passing; coverage gate active in CI; full server and e2e suites pass with counts saved.
- `.env.example`, `README` and `docs/deployment` list the new variables (`LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MINUTES`); no real secret anywhere.
- Lab 6 Issues #56 and #57 are retested on the deployed URL and commented; G-03, G-04, G-10 marked resolved in `docs/sprints/sprint-1/known-gaps.md` and the change register.

## 7. Revisions

| Date | Change | Reason |
|---|---|---|
| 24 Nov 2026 | First version | Deliverable 2, Sprint 3 contract |
