# F-11 Public Display Screen

Issue #65. Author TauForge, reviewer MacOverlorD. Sprint 2. Requirements: FR-17, BR-08, NFR-08. Depends on: F-07 (public display API).

## 1. Behavior

A screen in the service area shows the state of one queue to anyone walking past, without logging in: the queue name, the ticket number now being called or served, and how many people are waiting. The page refreshes by itself, so staff can leave it open on a TV or monitor all day.

Workflow:

1. Staff open `/display/<queueId>` once on the screen in the service area.
2. The page reads `GET /api/queues/:id/display` (F-07) and shows the result.
3. Every refresh interval it reads the API again and updates the numbers in place. No reload, no login, no interaction.
4. When an operator calls, starts or completes an entry, or a customer joins, the screen shows the change on the next refresh.

## 2. UI specification

Route `/display/:queueId`, outside the role-protected routes (no session needed). The header is the shared app header; the display content is large and readable from a distance.

| Element | Content |
|---|---|
| Heading | Queue name from the API (`queueName`) |
| Open flag | "Open" or "Closed" (from `isOpen`). A closed queue still shows its current number and waiting count. |
| Now serving | `currentNumber` in large text with the status label "Called" or "Serving". When `currentNumber` is null: "No one is being served". |
| Waiting | "Waiting: N" (`waitingCount`), including 0. |
| Last updated | Time of the last successful refresh (local time, HH:MM:SS). |

States (NFR-08):

| State | When | Shown |
|---|---|---|
| Loading | First request not answered yet | "Loading..." |
| Not found | API returns 404 (unknown or malformed id, see F-07) | "Queue not found." No numbers. Polling stops. |
| Error | Network failure or 5xx | "Cannot load the display. Retrying." The last good numbers stay on screen; polling continues. |
| Normal | 200 | The elements above |

Refresh: uses the shared `usePolling` hook with `REFRESH_MS` (10 000 ms by default, NFR-08). The end-to-end suite sets `VITE_REFRESH_MS=1500`.

Privacy (BR-08): the page renders only the six fields returned by F-07. It never calls a customer or operator endpoint and never shows names, emails or ids of customers.

## 3. API and data

- API: **no change.** Uses `GET /api/queues/:id/display` exactly as defined in F-07 (public, no session, 404 `NOT_FOUND` for unknown or malformed ids).
- Data: **no change.** Read-only.
- Server: **no change.** In production the built client is served by the API container, and the existing fallback returns `index.html` for `/display/...`.

## 4. Validation, errors and permissions

- Permissions: public by design (D-11, Q-03). No login and no role check. Privacy is enforced by the API returning only safe fields (F-07, TEST-F07-02), not by the page.
- Validation: the page does not validate the id itself; it passes the route value to the API and treats 404 as "Queue not found."
- Errors: as in the states table. A failed refresh never clears the screen.

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F11-01 | Without logging in, `/display/:queueId` for an existing queue shows its name, open/closed flag, the current called or serving number with its status, and the waiting count. |
| AC-F11-02 | The page updates without a reload: after the queue changes (a join or a call next), the new waiting count and current number appear within one refresh interval. |
| AC-F11-03 | The page shows no customer name, email or id, even when the current entry belongs to a customer (BR-08). |
| AC-F11-04 | An unknown or malformed queue id shows "Queue not found." and no numbers. |
| AC-F11-05 | A queue with nobody called or served shows "No one is being served" and its waiting count (0 for an empty queue). |
| AC-F11-06 | When the API cannot be reached, the page shows "Cannot load the display. Retrying.", keeps the last numbers, and recovers by itself on the next successful refresh. |

## 6. Software Test Specification

All tests are end-to-end (Playwright, `e2e/tests/display.spec.ts`) against the real API, client and `queue_test` database, because the behaviour under test is the rendered page and its polling. The client has no unit-test runner, and the data rules are already covered at API level by TEST-F07-01..03. Seed: queue A Registrar Desk (customer4 serving #4, customer1 waiting #5, customer2 waiting #6), queue B Finance Desk (empty).

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F11-01 | AC-F11-01 | e2e | Fresh seed, no browser session | Open `/display/<A id>` | Heading "Registrar Desk", "Open", current number 4 with "Serving", "Waiting: 2"; URL not redirected to `/login` |
| TEST-F11-02 | AC-F11-02 | e2e | Page open on A; refresh 1500 ms | Through the API: customer3 joins A; then operator1 completes #4 and calls next | Without reload, "Waiting: 3" appears; then current number 5 with "Called" appears, each within 5 s |
| TEST-F11-03 | AC-F11-03 | e2e | Page open on A (current entry belongs to customer4) | Read the whole page text | Contains none of the seeded customer names or emails; contains no `customerId`/entry id values |
| TEST-F11-04 | AC-F11-04 | e2e | none | Open `/display/9999` and `/display/abc` | Both show "Queue not found." and no "Waiting:" text |
| TEST-F11-05 | AC-F11-05 | e2e | Queue B empty | Open `/display/<B id>` | "No one is being served", "Waiting: 0" |
| TEST-F11-06 | AC-F11-06 | e2e | Page open on A showing numbers | Block `/api/queues/*/display` with `page.route` (abort); wait one interval; then unblock | Error text "Cannot load the display. Retrying." appears while the last number stays visible; after unblock the error disappears without reload |

Regression: TEST-F07-01..03 and the Sprint 1 e2e journeys (`customer.spec.ts`, `operator.spec.ts`) still pass.

## 7. Definition of Done

- Contract merged to `sprint2-staging` before the feature branch starts.
- First commit on `feature/F-11-public-display-screen` adds TEST-F11-01..06 only, and their failing output is saved with the commit ID.
- All AC implemented; TEST-F11-01..06 pass; full server suite and all e2e tests pass; client builds (`npm run build:client`).
- No new API fields, no schema change, no customer data on the page.
- PR into `sprint2-staging` with `Closes #65`, AC-to-test table, RED and GREEN commit IDs, and a substantive review from MacOverlorD.
- `docs/traceability.md` rows for FR-17 updated in the D2 docs PR (#69).

## 8. Revisions

| Date | Change | Reason |
|---|---|---|
| 24 Nov 2026 | First version | Deliverable 2, Sprint 2 |
