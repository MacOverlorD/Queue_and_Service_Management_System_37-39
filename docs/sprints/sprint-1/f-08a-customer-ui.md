# F-08a Customer UI

Issue #10. Author TauForge, reviewer MacOverlorD. Requirements: FR-01..FR-06 (UI side), NFR-08. Depends on: F-02, F-04, F-05.

## 1. Behavior

A customer signs in, sees the service queues, joins one, and follows their ticket status. The UI only calls the API; authorization stays on the server.

## 2. Screens and navigation

| Route | Screen | Content |
|---|---|---|
| `/login` | Login | Email, password, submit. Shows API error text on failure. |
| `/queues` | Queue list | Each queue: name, service, open/closed, waiting count, **Join** button (disabled when closed). |
| `/my-ticket` | My tickets | Active entries with queue name, ticket number, status badge, people ahead for waiting entries. Auto-refresh every 10 seconds. |

Shared header: current user name, role, **Log out**. Unauthenticated visits to `/queues` or `/my-ticket` redirect to `/login`. An operator who opens a customer screen is shown a "not available for your role" message (the server still enforces 403).

Shared UI states: loading indicator, empty state (for example "You are not in any queue"), and an error banner showing the API `error.message`.

## 3. API used

`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/queues`, `POST /api/queues/:id/entries`, `GET /api/me/entries`. No new endpoints or schema changes.

## 4. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F08a-01 | A customer can log in, reach the queue list, and log out; after logout, `/my-ticket` redirects to `/login`. Wrong credentials show an error and no session. |
| AC-F08a-02 | A customer can join an open queue from the queue list and is taken to their ticket showing the new number and status WAITING. |
| AC-F08a-03 | The ticket screen shows the saved entry (number, status, people ahead) after a full page reload, proving it comes from the database. |
| AC-F08a-04 | Loading, empty and error states are shown: empty list message, join error (for example duplicate) shown from the API message. |
| AC-F08a-05 | The ticket screen refreshes at least every 10 seconds so a status change made by an operator appears without a manual reload. |

## 5. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F08a-01 | AC-F08a-01 | e2e | Seeded customer1 | Visit `/my-ticket` (redirect), log in with a wrong then correct password, log out, visit `/my-ticket` again | Wrong password shows error; correct login shows queue list; after logout redirected to `/login` |
| TEST-F08a-02 | AC-F08a-02 | e2e | customer1 has no active entry in queue A | Click Join on queue A | Ticket screen shows next number and status WAITING |
| TEST-F08a-03 | AC-F08a-03 | e2e | After TEST-F08a-02 | Reload the page | Same entry, number and status still shown |
| TEST-F08a-04 | AC-F08a-04 | e2e | customer1 already waiting in queue A; customer with no entries | Click Join on queue A again; open `/my-ticket` as the empty customer | Duplicate error message shown, no second entry; empty-state text shown |
| TEST-F08a-05 | AC-F08a-05 | e2e | customer1 waiting; operator advances the entry through the API | Wait for the refresh interval (test sets a short interval) | Ticket screen shows the new status without reload |

## 6. Definition of Done

All AC implemented; TEST-F08a-01..05 executed and passing with output in the PR; a screenshot of each screen is saved for Part F; manual check of loading/error states recorded (labeled as manual).

## 7. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version | Deliverable 1 |
| 5 Nov 2026 | TEST-F08a-02/03 use customer3 (customer1 already holds a waiting ticket in queue A in the seed); the duplicate-join case in TEST-F08a-04 uses customer1. The empty state uses customer5, an extra customer with no entries that the e2e reset script adds (the seed itself is unchanged). TEST-F08a-05 uses customer4 joining queue B and the operator calling next through the API. The refresh interval is read from `VITE_REFRESH_MS` (default 10 s) so the test can use 1.5 s. | Match the seed and make the journeys deterministic |
