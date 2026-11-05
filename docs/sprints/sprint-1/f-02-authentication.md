# F-02 Authentication

Issue #4. Author MacOverlorD, reviewer TauForge. Requirements: FR-01, FR-02, FR-03, NFR-02, NFR-05. Depends on: F-01.

## 1. Behavior

A seeded user logs in with email and password and receives a server-side session in an httpOnly cookie. The user can ask who they are and can log out. A session ends at logout or 8 hours after login, whichever comes first (D-10).

This feature also provides `requireAuth`, the middleware that turns the `sid` cookie into `req.user`. F-02 needs it for `/api/auth/me` and `/api/auth/logout`; F-03 reuses the same middleware on every other protected route and owns the route-wide 401 tests (TEST-F03-01).

## 2. API specification

### POST /api/auth/login (public)

Request:

```json
{ "email": "customer1@example.test", "password": "<demo password from README>" }
```

- `email` and `password` must be non-empty strings, otherwise 400 `VALIDATION_ERROR`.
- Emails are stored lowercase (the seed writes them lowercase). Login trims and lowercases the input email, then looks it up with an exact match on `User.email` (`@unique`, case-sensitive in PostgreSQL) and compares the password with bcrypt.
- Unknown email and wrong password give the same response: 401 `INVALID_CREDENTIALS`, message "Invalid email or password." No session is created and no cookie is set.

Response 200:

```json
{ "user": { "id": 3, "name": "Customer One", "email": "customer1@example.test", "role": "CUSTOMER" } }
```

with header `Set-Cookie: sid=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` (plus `Secure` when `NODE_ENV=production`).

### GET /api/auth/me (logged in)

Response 200: `{ "user": { "id", "name", "email", "role" } }` for the session owner. 401 `UNAUTHENTICATED` without a valid session.

### POST /api/auth/logout (logged in)

Deletes the caller's `Session` row and clears the cookie (`Max-Age=0`). Response 204 with no body. 401 `UNAUTHENTICATED` without a valid session.

### requireAuth middleware

1. Read cookie `sid`. Missing: 401 `UNAUTHENTICATED`.
2. Load `Session` with its user. Not found: 401 `UNAUTHENTICATED`.
3. `expiresAt <= now`: delete the row, 401 `UNAUTHENTICATED`.
4. Otherwise set `req.user = { id, name, role }` and continue.

No user object, password hash or session id appears in any response body. The password hash is never selected into API responses.

## 3. Data specification

Uses `User` and `Session` from F-01. Session id: 32 random bytes from `crypto.randomBytes`, base64url. `expiresAt = now + SESSION_TTL_HOURS` hours (default 8). No schema change.

UI: none in this feature (the login form is F-08a).

## 4. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F02-01 | Valid email and password return 200 with the user's id, name, email and role, set an `HttpOnly`, `SameSite=Lax` `sid` cookie, and store one `Session` row expiring 8 hours later. The response never contains `passwordHash`. |
| AC-F02-02 | A correct email with a wrong password returns 401 `INVALID_CREDENTIALS`, sets no cookie and creates no session. |
| AC-F02-03 | An unknown email returns the same status and body as AC-F02-02. A missing or non-string `email` or `password` returns 400 `VALIDATION_ERROR`. No session is created in either case. |
| AC-F02-04 | `GET /api/auth/me` with a valid session returns the session owner's id, name, email and role; without a session it returns 401 `UNAUTHENTICATED`. |
| AC-F02-05 | Logout returns 204, deletes the session row and clears the cookie. A later request with the old `sid` value gets 401 `UNAUTHENTICATED`. |
| AC-F02-06 | A session whose `expiresAt` has passed is rejected with 401 `UNAUTHENTICATED` and its row is deleted. |

## 5. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F02-01 | AC-F02-01 | api | Seeded customer1 | POST login with the demo password; repeat with the email in mixed case (`Customer1@Example.TEST`) | Both 200; body `user` has id, name, email, role `CUSTOMER` and no `passwordHash`; `Set-Cookie` has `sid`, `HttpOnly`, `SameSite=Lax`; one `Session` row for the user with `expiresAt` within 1 minute of now + 8 h |
| TEST-F02-02 | AC-F02-02 | api | Seeded customer1 | POST login with a wrong password | 401 `INVALID_CREDENTIALS`; no `Set-Cookie`; session count unchanged |
| TEST-F02-03 | AC-F02-03 | api | No user `nobody@example.test` | POST login with that email; then bodies `{}`, `{ "email": 1, "password": true }` | Unknown email: identical status and body to TEST-F02-02. Bad bodies: 400 `VALIDATION_ERROR`. Session count unchanged |
| TEST-F02-04 | AC-F02-04 | api | Logged-in agent for operator1; separate agent without cookie | GET /api/auth/me with each | operator1: 200 with operator1's id and role `OPERATOR`; no cookie: 401 `UNAUTHENTICATED` |
| TEST-F02-05 | AC-F02-05 | api | Logged in as customer1, `sid` value saved | POST logout; then GET /api/auth/me sending the saved `sid` | Logout 204 and cookie cleared; session row gone; me returns 401 `UNAUTHENTICATED` |
| TEST-F02-06 | AC-F02-06 | api | Logged in as customer1; test sets that session's `expiresAt` to 1 minute ago in the DB | GET /api/auth/me | 401 `UNAUTHENTICATED`; the session row is deleted |
| TEST-F02-06b | AC-F02-06 | unit | Session with `expiresAt` equal to now, and one 1 second later | Call the expiry check | Equal to now counts as expired; 1 second later is valid (boundary) |

TDD: TEST-F02-02 and TEST-F02-06 are committed failing before the implementation; their failing and passing output goes in the PR.

## 6. Definition of Done

All AC implemented; TEST-F02-01..06b executed and passing at the PR head with failing-first output in the PR; no endpoint returns `passwordHash` (checked by TEST-F02-01 and by the reviewer); `SESSION_TTL_HOURS` documented in `.env.example`; reviewer logged in and out by hand with a seeded account.

## 7. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version | Deliverable 1 |
| 5 Nov 2026 | Emails stored and matched lowercase; mixed-case login added to TEST-F02-01 | Tau's review on #16 (`@unique` is case-sensitive in PostgreSQL) |
