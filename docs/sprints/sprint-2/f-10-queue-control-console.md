# F-10 Queue Control and Multi-queue Console

Issue #64. Author MacOverlorD, reviewer TauForge. Requirements: FR-15, FR-16, BR-06, BR-09, BR-10, NFR-08. Fixes Lab 6 UAT finding #55. Depends on: F-03, F-06, F-08b.

Revised 26 Nov 2026 for Lab 7 change request CR-01 (#82): the same PATCH also sets a queue's waiting limit, and the console shows and edits it. Design and tests: `docs/maintenance/cr-01-queue-capacity.md` sections 3.2 to 3.4 and 6.

## 1. Behavior

- **Open and close a queue** (FR-15): an operator assigned to a queue can close it for new joins and open it again. A closed queue rejects new joins (BR-10, already enforced by F-04 with 409 `QUEUE_CLOSED`); entries already in it stay and can still be called, served, completed, cancelled or marked no-show.
- **One console for all assigned queues** (FR-16): the operator console shows every assigned queue at once, each with its open/closed state, waiting count and current entry, plus an Open/Close control. The operator picks a queue to work in its serve panel (F-08b panel, unchanged rules).
- **Selection survives reload** (Lab 6 #55): the selected queue is kept in the URL (`/operator?queue=<id>`), so F5, a restored tab or a shared link opens the same queue.

Only assigned operators may change a queue (BR-06, `requireQueueOperator`); customers get 403 (BR-09). The UI only calls the API; the server decides.

## 2. API specification

### PATCH /api/queues/:id (operator assigned to the queue)

Guard: `operatorOnQueueParam` (session + `OPERATOR` + `requireQueueOperator`), same as call-next. A malformed or unknown queue id gives 403 `FORBIDDEN_QUEUE` (F-03 rule, existence not leaked).

Request body, exactly:

```json
{ "isOpen": false }
```

- `isOpen` must be a boolean; any other body (missing field, string, extra fields) gives **400 `VALIDATION_ERROR`** "isOpen must be true or false." and nothing changes.
- **(CR-01)** Alternatively the body is exactly `{ "maxWaiting": <whole number 1..200 or null> }`. A `maxWaiting` body with any other value gives 400 `VALIDATION_ERROR` "maxWaiting must be a whole number from 1 to 200, or null." Every other invalid body keeps the message above. Lowering the limit below the current waiting count removes nobody.
- The update is idempotent: setting the current value again returns 200 with the queue unchanged.
- Entries in the queue are not touched.

Response 200:

```json
{ "queue": { "id": 2, "name": "Finance Desk", "isOpen": false, "maxWaiting": null } }
```

The F-03 route matrix gains `patch /api/queues/:id` → `operatorOnQueueParam` (the `Method` type in `routes/access.ts` gains `"patch"`).

### GET /api/operator/queues (no change)

Already returns, for the caller's assigned queues only: `id`, `name`, `isOpen`, `waitingCount`, `current` (F-06). **(CR-01)** Gains `maxWaiting`.

### Errors

| Case | Status / code |
|---|---|
| No session | 401 `UNAUTHENTICATED` |
| Customer | 403 `FORBIDDEN_ROLE` |
| Operator not assigned / unknown or malformed id | 403 `FORBIDDEN_QUEUE` |
| Bad body | 400 `VALIDATION_ERROR` |
| Customer joins a closed queue (existing F-04) | 409 `QUEUE_CLOSED` |

## 3. Data and UI

**Data:** no schema change; `Queue.isOpen` exists (F-01). No audit table for open/close in Sprint 2 (not required by FR-15); recorded as a possible Sprint 3 item.

**UI (operator console, `/operator`):**

1. **Overview** at the top: one row per assigned queue (from `GET /api/operator/queues`, polled like F-08b, NFR-08): queue name, **Open/Closed** badge, waiting count, current number and status or "No one is being served", a **Close queue** / **Open queue** button, and a **Select** action. The selected row is highlighted.
2. **Serve panel** below for the selected queue: the F-08b panel (Now serving, Call next, Start, Complete) plus F-09's No-show. Unchanged rules.
3. **URL:** selecting a queue sets `?queue=<id>` (history replace, not push). On load, if `queue` is an assigned id it is selected; if it is missing, malformed or not assigned, the first queue by name is selected and the URL is corrected. No data from a non-assigned queue is ever requested.
4. While an Open/Close request runs, that button is disabled; a rejected request shows the API message in the overview.
5. **(CR-01)** Each row shows "`n` / `max` waiting" (or "`n` waiting" without a limit) and a **Waiting limit** input (1 to 200, empty means no limit) with **Save**; same disabled and error behaviour as Open/Close.

Customer side: no change. The queue list already shows a closed queue with a disabled **Closed** button (F-08a), and the server rejects joins anyway.

## 4. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F10-01 | An assigned operator sending `{ "isOpen": false }` gets 200 with `isOpen: false`; afterwards a customer join on that queue returns 409 `QUEUE_CLOSED` and no number is used. |
| AC-F10-02 | An assigned operator sending `{ "isOpen": true }` on a closed queue gets 200 with `isOpen: true`; a customer can then join. |
| AC-F10-03 | Closing a queue does not change its entries: waiting entries stay, and call-next, start, complete, no-show and customer cancel still work on them. |
| AC-F10-04 | A customer gets 403 `FORBIDDEN_ROLE`; an operator not assigned to the queue, or using an unknown/malformed id, gets 403 `FORBIDDEN_QUEUE`; no session gets 401; nothing changes. |
| AC-F10-05 | A body without a boolean `isOpen` (missing, `"false"`, `null`, extra fields) gets 400 `VALIDATION_ERROR`; nothing changes. |
| AC-F10-06 | Setting the value a queue already has returns 200 and the queue is unchanged. |
| AC-F10-07 | The console shows every assigned queue at once with its open/closed state, waiting count and current entry, and nothing about other queues. |
| AC-F10-08 | The operator can close and reopen a queue from the console; the badge and the customer queue list reflect it after the next refresh. |
| AC-F10-10 | (CR-01) Only an assigned operator can set `maxWaiting` to 1..200 or `null`; invalid values give 400 with the `maxWaiting` message; customer 403, other operator 403, no session 401; nothing changes on a refusal; `GET /api/operator/queues` returns `maxWaiting`. |
| AC-F10-11 | (CR-01) The console shows each queue's waiting count against its limit and lets the operator set or clear it. |
| AC-F10-09 | The selected queue is kept in `?queue=<id>`: after F5 the console shows the same queue (fixes #55). An unassigned or invalid `queue` value falls back to the first assigned queue. |

## 5. Software Test Specification

Seed: queues A Registrar Desk and B Finance Desk (operator1), C Student Affairs (operator2, closed). State-changing tests use B; the suite reseeds before running.

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F10-01 | AC-F10-01 | api | B open | operator1 PATCH B `{isOpen:false}`; customer3 POST join B | 200 `isOpen:false`; join 409 `QUEUE_CLOSED`; B `lastNumber` unchanged |
| TEST-F10-02 | AC-F10-02 | api | B closed | operator1 PATCH B `{isOpen:true}`; customer3 POST join B | 200 `isOpen:true`; join 201 |
| TEST-F10-03 | AC-F10-03 | api | B has two `WAITING` entries (customer3, customer4) | Close B; operator1 call-next, start, complete; customer4 cancel | All succeed as in F-06/F-09; B still closed |
| TEST-F10-04 | AC-F10-04 | api | B open | customer1 PATCH B; operator2 PATCH B; operator2 PATCH 999999 and `abc`; no session PATCH B | 403 `FORBIDDEN_ROLE`; 403 `FORBIDDEN_QUEUE` ×3; 401; B still open |
| TEST-F10-05 | AC-F10-05 | api | B open | operator1 PATCH B with `{}`, `{isOpen:"false"}`, `{isOpen:null}`, `{isOpen:false, name:"X"}` | Each 400 `VALIDATION_ERROR`; B still open, name unchanged |
| TEST-F10-06 | AC-F10-06 | api | B open | operator1 PATCH B `{isOpen:true}` | 200 `isOpen:true`; row unchanged |
| TEST-F10-07 | AC-F10-07 | e2e | Reseeded; operator1 logged in | Open `/operator` | Overview has exactly two rows, Finance Desk (Open, 0 waiting, no one served) and Registrar Desk (Open, 2 waiting, current #4 Serving); no row or text for Student Affairs |
| TEST-F10-08 | AC-F10-08 | e2e | operator1 logged in; customer3 in another context | Close B from the console; customer3 opens queue list; reopen B | Badge "Closed"; customer sees B as Closed; after reopen badge "Open" and customer can join |
| TEST-F10-09 | AC-F10-09 | e2e | operator1 logged in; C's id looked up by name ("Student Affairs") through the API, never hardcoded | Select Registrar Desk, press F5; open `/operator?queue=<C id>` (not assigned) and `/operator?queue=abc` | After F5 Registrar Desk still selected and URL has `queue=<its id>`; both bad URLs show the first queue (Finance Desk), the URL is corrected, and no request is made for C's entries |

| TEST-F10-10 | AC-F10-10 | api | B open, no limit | see `docs/maintenance/cr-01-queue-capacity.md` section 6 | 200, 200, 400 ×4, 403, 403, 401; list shows `maxWaiting` |

AC-F10-11 is checked by TEST-F04-13 (e2e, CR-01). Revised for CR-01: TEST-F10-01 expects `maxWaiting: null` in the PATCH response. TEST-F10-05 is unchanged.

TDD: TEST-F10-01, TEST-F10-04 and TEST-F10-09 are committed failing before the implementation; failing and passing output with commit IDs goes in the PR.

## 6. Definition of Done

- AC-F10-01..09 implemented; TEST-F10-01..09 executed and passing at the PR head; full server suite and e2e pass (0 failed; any skip explained).
- F-03 route matrix updated (`routeAccess` and the F-03 contract table) in the same PR.
- `docs/traceability.md` rows for FR-15, FR-16, BR-10 point to the tests and results; Lab 6 #55 is linked as fixed by this PR (`Closes #64`, and a comment on #55 with the retest).
- Reviewer closed and reopened a queue by hand and tried PATCH as operator2 on B (403).

## 7. Revisions

| Date | Change | Reason |
|---|---|---|
| 24 Nov 2026 | First version; includes the #55 fix (queue in URL) | Sprint 2, Deliverable 2 |
| 26 Nov 2026 | PATCH accepts `{ maxWaiting }`; console shows and sets the limit; AC-F10-10, AC-F10-11, TEST-F10-10 added; TEST-F10-01 response revised | Lab 7 change request CR-01 (#82), contract `docs/maintenance/cr-01-queue-capacity.md` |
| 24 Nov 2026 | TEST-F10-07 is e2e against the seed (no client unit runner, no stubs); TEST-F10-09 looks up C's id by name and uses Registrar Desk for the reload check | Review of #70 by TauForge |
