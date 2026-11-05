# F-08b Operator UI

Issue #11. Author MacOverlorD, reviewer TauForge. Requirements: FR-07, FR-08, FR-09, FR-10 (UI side), NFR-08. Depends on: F-05, F-06 (and the login screen and header from F-08a).

## 1. Behavior

An operator signs in and lands on the operator console. They pick one of their assigned queues, see who is being served and who is waiting, and press Call next, Start and Complete. Rejections from the API are shown as messages. The UI only calls the API; every rule is still enforced on the server.

## 2. Screens and navigation

| Route | Screen | Content |
|---|---|---|
| `/operator` | Operator console | Queue selector (assigned queues only). "Now serving" panel: number, customer name, status, with **Start** (when `CALLED`) or **Complete** (when `SERVING`). Waiting list: number and customer name in order. **Call next** button. Auto-refresh every 10 seconds. |

- After login, an `OPERATOR` is redirected to `/operator`; a `CUSTOMER` who opens `/operator` sees "not available for your role" (the server still returns 403).
- Unauthenticated visits to `/operator` redirect to `/login`.
- Shared header (name, role, Log out) comes from F-08a.
- Buttons are disabled while a request is in flight. Start and Complete appear only for the matching status, but a rejected call still shows the API message.

Shared UI states: loading indicator while the queue loads; empty states "No queues assigned to you" and "No one is waiting"; error banner showing the API `error.message` (for example `QUEUE_BUSY`).

## 3. API used

`GET /api/auth/me`, `GET /api/operator/queues`, `GET /api/queues/:id/entries`, `POST /api/queues/:id/call-next`, `POST /api/entries/:id/start`, `POST /api/entries/:id/complete`, `POST /api/auth/logout`. No new endpoints or schema changes.

## 4. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F08b-01 | An operator who logs in reaches the console, sees only their assigned queues in the selector, and for the selected queue sees the current entry and the waiting entries in number order. |
| AC-F08b-02 | From the console the operator can call the next customer, start serving and complete; after each action the panel shows the new status and the waiting list updates. The completed entry remains `COMPLETED` after a page reload. |
| AC-F08b-03 | Loading, empty and error states are shown: an empty waiting list shows "No one is waiting"; a rejected action (for example call next while busy) shows the API message and changes nothing; the console refreshes at least every 10 seconds so a new customer join appears without a manual reload. |

## 5. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F08b-01 | AC-F08b-01 | e2e | Seeded operator1 (A and B), operator2 (C) | Log in as operator1; open the queue selector; select A | Selector lists A and B only; A shows the current entry and waiting numbers in ascending order |
| TEST-F08b-02 | AC-F08b-02 | e2e | Queue B free; customer3 joined B through the API | As operator1 select B; click Call next, Start, Complete; reload the page | Panel shows `CALLED`, then `SERVING`; after Complete the panel is empty; after reload the entry is not in the active list, and the API reports it `COMPLETED` |
| TEST-F08b-03 | AC-F08b-03 | e2e | Queue A has a current entry; queue B has no waiting entries | Select A and click Call next; select B; then a customer joins B through the API while the console is open (test sets a short refresh interval) | A: error banner with the `QUEUE_BUSY` message, nothing changed; B: "No one is waiting", then the new entry appears after the refresh without reload |
| TEST-F08b-03b | AC-F08b-03 | manual | Throttled network in browser dev tools | Open the console | Loading indicator visible before data; recorded as a manual check with a screenshot |

## 6. Definition of Done

All AC implemented; TEST-F08b-01..03 executed and passing with output in the PR; TEST-F08b-03b recorded and labeled manual; a screenshot of the console in each state saved for Part F; the reviewer checked that hiding a button is not the only protection (the related 403 tests exist in F-03 and F-06).

## 7. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version | Deliverable 1 |
