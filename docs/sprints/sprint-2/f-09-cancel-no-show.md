# F-09 Cancel and No-show

Issue #63. Author MacOverlorD, reviewer TauForge. Requirements: FR-13, FR-14, BR-04 (Sprint 2 transitions), BR-07, BR-09, BR-11, BR-12, BR-13. Depends on: F-03, F-05, F-06, F-08a, F-08b.

## 1. Behavior

Two new final transitions finish the queue lifecycle:

- **Cancel** (FR-13, BR-12): a customer cancels their own entry while it is `WAITING`. The entry becomes `CANCELLED` and leaves the queue; people behind move up.
- **No-show** (FR-14, BR-13): an operator assigned to the entry's queue marks a `CALLED` entry as `NO_SHOW` when the customer does not come to the counter. The counter becomes free, so **Call next** works again. This removes Sprint 1 gap G-01 (a called customer who never arrives blocks the queue).

Both statuses are final (BR-11): nothing moves out of them, and the customer may join the same queue again with a new number (the D-13 index only covers active statuses). Each change writes one `EntryEvent` in the same transaction, like F-06.

Ownership and roles are enforced on the backend (F-03 guards). Hidden buttons are not the protection.

## 2. Allowed transitions (Sprint 2)

| From \ action | call-next | start | complete | cancel (customer, owner) | no-show (operator, assigned) |
|---|---|---|---|---|---|
| `WAITING` | to `CALLED` (lowest number) | 409 | 409 | **to `CANCELLED`** | 409 |
| `CALLED` | n/a | to `SERVING` | 409 | 409 | **to `NO_SHOW`** |
| `SERVING` | n/a | 409 | to `COMPLETED` | 409 | 409 |
| `COMPLETED`, `CANCELLED`, `NO_SHOW` | n/a | 409 | 409 | 409 | 409 |

409 is `INVALID_TRANSITION`. The single pure function `nextStatus(current, action)` from F-06 gains the actions `cancel` and `noShow`; it stays the only place the rules live.

## 3. API specification

### POST /api/me/entries/:id/cancel (customer, owner only)

No body. Guard: `customer` (session + `CUSTOMER` role) in the F-03 route matrix.

- The entry is looked up by `id` **and** `customerId = caller`. A missing id, a malformed id and another customer's entry all return **404 `NOT_FOUND` "Ticket not found."** (same as F-05, BR-07: existence is not leaked).
- Conditional update in one transaction: `UPDATE "QueueEntry" SET status = 'CANCELLED' WHERE id = $1 AND "customerId" = $2 AND status = 'WAITING'`. Zero rows for an owned entry gives **409 `INVALID_TRANSITION`** "Only a waiting ticket can be cancelled." and the entry is unchanged.
- On success: one `EntryEvent` (`WAITING` → `CANCELLED`, actor = customer). `handledByOperatorId` is not changed.

Response 200, the customer entry shape of F-05:

```json
{ "entry": { "id": 21, "queueId": 2, "queueName": "Finance Desk", "number": 7, "status": "CANCELLED",
             "peopleAhead": null, "createdAt": "2026-11-25T03:00:00.000Z" } }
```

### POST /api/entries/:id/no-show (operator assigned to the entry's queue)

No body. Guard: `operatorOnEntryParam` (session + `OPERATOR` + `requireQueueOperator` on the entry's queue), same as start/complete. An unknown entry id gives 403 `FORBIDDEN_QUEUE` (F-03 rule).

- Conditional update: `... SET status = 'NO_SHOW', "handledByOperatorId" = $op WHERE id = $1 AND status = 'CALLED'`. Zero rows gives **409 `INVALID_TRANSITION`** "Only a called ticket can be marked as no-show." and the entry is unchanged.
- On success: one `EntryEvent` (`CALLED` → `NO_SHOW`, actor = operator).
- The queue then has no `CALLED`/`SERVING` entry, so the next `call-next` succeeds (BR-05).

Response 200, the operator entry shape of F-06 (`customerName`, never email):

```json
{ "entry": { "id": 18, "queueId": 1, "number": 6, "status": "NO_SHOW", "customerName": "Customer Two",
             "calledAt": "2026-11-25T04:00:00.000Z", "servingAt": null, "completedAt": null } }
```

### Errors (shared shape `{ "error": { "code", "message" } }`)

| Case | Status / code |
|---|---|
| No session | 401 `UNAUTHENTICATED` |
| Operator calls cancel; customer calls no-show | 403 `FORBIDDEN_ROLE` |
| Operator not assigned to the entry's queue (or unknown entry) on no-show | 403 `FORBIDDEN_QUEUE` |
| Cancel: missing, malformed or other customer's entry | 404 `NOT_FOUND` |
| Wrong status | 409 `INVALID_TRANSITION` |

Route matrix (F-03 `routeAccess`) gains two rows: `post /api/me/entries/:id/cancel` → `customer`; `post /api/entries/:id/no-show` → `operatorOnEntryParam`.

## 4. Data and UI

**Data:** no schema change. `CANCELLED` and `NO_SHOW` already exist in `EntryStatus` (F-01). The time of the change is the `EntryEvent.at` of the event; `completedAt` stays null. F-13 summaries read these events.

**Effects on existing reads (no code change expected, covered by tests):** `GET /api/queues/:id/entries` and `GET /api/me/entries?status=active` list only active entries, so a cancelled or no-show entry disappears; `waitingCount` (queue list, operator queues, F-07 display) drops after a cancel; `peopleAhead` of later entries drops by one.

**UI:**
- My Ticket (F-08a): a **Cancel ticket** button on each `WAITING` ticket. While the request runs the button is disabled. On success the ticket shows `CANCELLED`, and joining that queue from the queue list works again. A 409 shows the API message.
- Operator console (F-08b): a **No-show** button next to **Start** when the current entry is `CALLED`. On success the current entry clears and **Call next** is enabled.

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F09-01 | A customer cancelling their own `WAITING` entry gets 200 with status `CANCELLED`; the entry no longer appears in active lists, the queue's waiting count drops by one, and `peopleAhead` of later entries drops by one. |
| AC-F09-02 | Cancelling an own entry that is `CALLED`, `SERVING` or final returns 409 `INVALID_TRANSITION` and the entry is unchanged. |
| AC-F09-03 | Cancelling another customer's entry, a missing id or a malformed id returns 404 `NOT_FOUND` and changes nothing. |
| AC-F09-04 | An operator calling cancel gets 403 `FORBIDDEN_ROLE`; no session gets 401; nothing changes. |
| AC-F09-05 | An assigned operator marking a `CALLED` entry as no-show gets 200 with status `NO_SHOW`; the next call-next on that queue succeeds (counter freed). |
| AC-F09-06 | No-show on a `WAITING`, `SERVING` or final entry returns 409 `INVALID_TRANSITION` and the entry is unchanged. |
| AC-F09-07 | No-show by a customer returns 403 `FORBIDDEN_ROLE`; by an operator not assigned to the queue returns 403 `FORBIDDEN_QUEUE`; nothing changes. |
| AC-F09-08 | Every successful cancel and no-show writes exactly one `EntryEvent` with old status, new status, actor and time, in the same transaction; rejected requests write none. |
| AC-F09-09 | After a cancel or a no-show, the same customer can join the same queue again and gets a new, higher number (BR-11). |
| AC-F09-10 | If a cancel and a call-next race for the same entry, exactly one succeeds: the entry ends either `CANCELLED` or `CALLED`, never both, and the loser gets 409. |
| AC-F09-11 | UI: a customer cancels a waiting ticket from My Ticket and sees `CANCELLED`; an operator marks the called entry as no-show from the console and can call the next customer. |

## 6. Software Test Specification

Seed (F-01): queue A Registrar Desk and B Finance Desk assigned to operator1; queue C Student Affairs assigned to operator2; customers 1-4. State-changing tests use queue B and reseed before the suite, as in F-06.

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F09-01 | AC-F09-02, AC-F09-06 | unit | All statuses × actions `cancel`, `noShow` | `nextStatus(status, action)` | Only `WAITING`+`cancel` → `CANCELLED` and `CALLED`+`noShow` → `NO_SHOW`; all other pairs null; F-06 pairs unchanged |
| TEST-F09-02 | AC-F09-01 | api | customer3 and customer4 `WAITING` in B (numbers n, n+1) | customer3 POST cancel on own entry | 200 `CANCELLED`; B `waitingCount` −1; customer4 `peopleAhead` −1; entry absent from `GET /api/queues/B/entries` |
| TEST-F09-03 | AC-F09-02 | api | customer3 owns entries in `CALLED`, `SERVING`, `COMPLETED` | POST cancel on each | Each 409 `INVALID_TRANSITION`; statuses unchanged; no new event |
| TEST-F09-04 | AC-F09-03 | api | customer4 has a `WAITING` entry | customer3 POST cancel on it; on id 999999; on id `abc` | Each 404 `NOT_FOUND`; customer4 entry still `WAITING` |
| TEST-F09-05 | AC-F09-04 | api | customer3 `WAITING` in B | operator1 POST cancel; no session POST cancel | 403 `FORBIDDEN_ROLE`; 401 `UNAUTHENTICATED`; entry unchanged |
| TEST-F09-06 | AC-F09-05 | api | B: one entry `CALLED`, one `WAITING` | operator1 POST no-show on the called entry, then POST call-next on B | No-show 200 `NO_SHOW`; call-next 200 and the waiting entry is `CALLED` |
| TEST-F09-07 | AC-F09-06 | api | Entries in B `WAITING`, `SERVING`, `COMPLETED` | operator1 POST no-show on each | Each 409 `INVALID_TRANSITION`; unchanged |
| TEST-F09-08 | AC-F09-07 | api | `CALLED` entry in queue A | customer1 POST no-show; operator2 POST no-show; operator2 on id 999999 | 403 `FORBIDDEN_ROLE`; 403 `FORBIDDEN_QUEUE`; 403 `FORBIDDEN_QUEUE`; entry still `CALLED` |
| TEST-F09-09 | AC-F09-08 | api | Fresh entries in B | Cancel one (customer3); call-next + no-show another (operator1); then one rejected cancel | Events: `WAITING`→`CANCELLED` actor customer3; `CALLED`→`NO_SHOW` actor operator1; rejected request adds no row |
| TEST-F09-10 | AC-F09-09 | api | customer3 entry in B cancelled; customer4 entry in B no-show | customer3 and customer4 POST join B | Both 201 `WAITING` with numbers higher than their old ones |
| TEST-F09-11 | AC-F09-10 | integration | customer3 is head of line in free queue B | Send cancel (customer3) and call-next (operator1) at the same time, 10 rounds | Each round: exactly one 200 and one 409; the entry is either `CANCELLED` or `CALLED`; one event for the winner only |
| TEST-F09-12 | AC-F09-11 | e2e | Seed; customer3 logged in | Join B, press **Cancel ticket** | Ticket shows `CANCELLED`; joining B again from the queue list succeeds with a new number |
| TEST-F09-13 | AC-F09-11 | e2e | Customer joined B; operator1 console on B | Call next, press **No-show**, press **Call next** | Current entry clears after no-show; next call succeeds or shows "Nobody is waiting in this queue." |

TDD: TEST-F09-01, TEST-F09-02 and TEST-F09-06 are committed failing before the implementation; their failing and passing output (with commit IDs) goes in the PR.

## 7. Definition of Done

- AC-F09-01..11 implemented; TEST-F09-01..13 executed and passing at the PR head; full server suite and e2e pass with 0 failed, 0 skipped (or skips explained).
- Transition rules only in `nextStatus`; both writes are conditional updates with the event in the same transaction.
- F-03 route matrix (`routeAccess` and the F-03 contract table) updated in the same PR.
- `docs/traceability.md` rows for FR-13, FR-14, BR-12, BR-13 point to the tests and results; Sprint 1 known gap G-01 marked resolved by F-09.
- Reviewer tried a cancel on another customer's entry and a no-show on a waiting entry by hand and saw 404 and 409.

## 8. Revisions

| Date | Change | Reason |
|---|---|---|
| 24 Nov 2026 | First version | Sprint 2, Deliverable 2 |
