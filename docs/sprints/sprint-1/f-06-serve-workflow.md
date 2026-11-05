# F-06 Serve Workflow

Issue #8. Author MacOverlorD, reviewer TauForge. Requirements: FR-08, FR-09, FR-10, FR-11, BR-03, BR-04, BR-05, BR-06, BR-09, BR-11. Depends on: F-03.

## 1. Behavior

An operator works one counter for a queue assigned to them. They call the next waiting customer, start serving them, and complete the service. Each step is a status change that is recorded in the entry history.

- Call next always takes the `WAITING` entry with the lowest number (BR-03). No endpoint calls a specific entry.
- While a queue has an entry in `CALLED` or `SERVING`, call next is rejected (BR-05, single counter).
- Only `WAITING -> CALLED`, `CALLED -> SERVING`, `SERVING -> COMPLETED` are allowed (BR-04). Final statuses never change (BR-11).
- Only operators may use these routes (BR-09, `requireRole("OPERATOR")`), and only on queues assigned to them (BR-06, `requireQueueOperator` from F-03; for entry routes the queue is the entry's queue).

This feature also adds `GET /api/operator/queues`, the list the operator console (F-08b) needs, because `GET /api/queues` is customer-only (F-03 matrix).

## 2. Allowed transitions

| From \ action | call-next | start | complete |
|---|---|---|---|
| `WAITING` | to `CALLED` (lowest number only) | 409 | 409 |
| `CALLED` | n/a | to `SERVING` | 409 |
| `SERVING` | n/a | 409 | to `COMPLETED` |
| `COMPLETED`, `CANCELLED`, `NO_SHOW` | n/a | 409 | 409 |

409 here is `INVALID_TRANSITION`. The rule lives in one pure function `nextStatus(current, action)` that returns the new status or null.

## 3. API specification

### GET /api/operator/queues (operator)

Response 200, only queues linked to the caller in `OperatorQueue`, ordered by name:

```json
{ "queues": [ { "id": 1, "name": "Registrar Desk", "isOpen": true, "waitingCount": 2,
                "current": { "entryId": 17, "number": 5, "status": "SERVING" } } ] }
```

`current` is the `CALLED` or `SERVING` entry, or null.

### POST /api/queues/:id/call-next (operator assigned to the queue)

No body. In one transaction: lock the queue row (`SELECT ... FOR UPDATE`); if an entry is `CALLED` or `SERVING`, 409 `QUEUE_BUSY`; if no entry is `WAITING`, 409 `NO_WAITING_ENTRY`; otherwise set the lowest-numbered `WAITING` entry to `CALLED`, set `calledAt` and `handledByOperatorId`, and insert an `EntryEvent`.

Response 200:

```json
{ "entry": { "id": 18, "queueId": 1, "number": 6, "status": "CALLED", "customerName": "Customer Two",
             "calledAt": "2026-11-06T04:00:00.000Z", "servingAt": null, "completedAt": null } }
```

### POST /api/entries/:id/start and POST /api/entries/:id/complete

No body. The middleware loads the entry's `queueId` and applies `requireQueueOperator`. An unknown entry id gives 403 `FORBIDDEN_QUEUE` for operator routes, matching F-03 (existence is not leaked).

The update is conditional: `UPDATE "QueueEntry" SET status = 'SERVING', "servingAt" = now() WHERE id = $1 AND status = 'CALLED'` (complete: `'COMPLETED'`, `"completedAt"`, from `'SERVING'`). Zero rows updated gives 409 `INVALID_TRANSITION` with the entry unchanged. On success an `EntryEvent` is inserted in the same transaction and the response is 200 with the entry in the shape above.

Responses include `customerName` (the operator needs it to serve the person) but never customer email or password hash.

## 4. Data and UI

Data: uses `QueueEntry` time columns, `handledByOperatorId` and `EntryEvent` from F-01. No schema change.
UI: none in this feature (operator console is F-08b).

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F06-01 | Call next on an assigned queue with no current entry changes the lowest-numbered `WAITING` entry to `CALLED` and returns it; other waiting entries are unchanged. |
| AC-F06-02 | Call next on an assigned queue with no `WAITING` entry and no current entry returns 409 `NO_WAITING_ENTRY` and changes nothing. |
| AC-F06-03 | Call next while the queue has a `CALLED` or `SERVING` entry returns 409 `QUEUE_BUSY` and changes nothing. Two simultaneous call-next requests on a free queue produce exactly one `CALLED` entry. |
| AC-F06-04 | Start on a `CALLED` entry changes it to `SERVING`, sets `servingAt`, and returns it. |
| AC-F06-05 | Complete on a `SERVING` entry changes it to `COMPLETED`, sets `completedAt`, and returns it; the queue is then free for the next call. |
| AC-F06-06 | Start on a non-`CALLED` entry and complete on a non-`SERVING` entry return 409 `INVALID_TRANSITION` and leave the entry unchanged. |
| AC-F06-07 | Start or complete on an entry in a final status (`COMPLETED`, `CANCELLED`, `NO_SHOW`) returns 409 `INVALID_TRANSITION`; the status stays final. |
| AC-F06-08 | Every successful call, start and complete writes exactly one `EntryEvent` with the old status, new status, acting operator id and time, in the same transaction as the change. Rejected actions write no event. |
| AC-F06-09 | A customer calling call-next, start or complete gets 403 `FORBIDDEN_ROLE` and nothing changes. |
| AC-F06-10 | An operator calling call-next on a queue not assigned to them, or start/complete on an entry of such a queue, gets 403 `FORBIDDEN_QUEUE` and nothing changes. |
| AC-F06-11 | `GET /api/operator/queues` returns only the caller's assigned queues with waiting count and current entry; a customer gets 403 `FORBIDDEN_ROLE`. |

## 6. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F06-01 | AC-F06-01 | unit | Entries with numbers 9, 4, 7 in `WAITING` | Call `pickNext(entries)` | Returns number 4 |
| TEST-F06-01b | AC-F06-01 | api | Queue B (operator1) has `WAITING` numbers 3 and 4 inserted out of order, no current entry | POST call-next on B as operator1 | 200; entry number 3 is `CALLED` with `calledAt` and `handledByOperatorId` set; number 4 still `WAITING` |
| TEST-F06-02 | AC-F06-02 | api | Queue B has no `WAITING` and no current entry | POST call-next on B as operator1 | 409 `NO_WAITING_ENTRY`; no event written |
| TEST-F06-03 | AC-F06-03 | api | Seed queue A has a `CALLED` or `SERVING` entry and `WAITING` entries | POST call-next on A as operator1 | 409 `QUEUE_BUSY`; statuses and event count unchanged |
| TEST-F06-03b | AC-F06-03 | integration | Queue B free with two `WAITING` entries | Send two call-next requests on B at the same time | One 200 and one 409 `QUEUE_BUSY`; exactly one `CALLED` entry in B |
| TEST-F06-04 | AC-F06-04 | api | Entry in B is `CALLED` | POST start on it as operator1 | 200; status `SERVING`; `servingAt` set |
| TEST-F06-05 | AC-F06-05 | api | Entry in B is `SERVING`; another entry `WAITING` | POST complete on it, then POST call-next on B | Complete 200, status `COMPLETED`, `completedAt` set; call-next 200 (queue free) |
| TEST-F06-06 | AC-F06-06 | unit | All status and action pairs | Call `nextStatus(status, action)` for each pair in the table in section 2 | Only the three allowed pairs return a status; all others return null |
| TEST-F06-06b | AC-F06-06 | api | Entry `WAITING`; entry `CALLED` | POST start on the waiting entry; POST complete on the called entry | Both 409 `INVALID_TRANSITION`; statuses unchanged |
| TEST-F06-07 | AC-F06-07 | api | Seed queue A has `COMPLETED`, `CANCELLED` and `NO_SHOW` entries | POST start and complete on each as operator1 | All 409 `INVALID_TRANSITION`; statuses unchanged |
| TEST-F06-08 | AC-F06-08 | api | Fresh entry in B joined by customer3 | call-next, start, complete as operator1; then one rejected start | `EntryEvent` rows for the entry: null to `WAITING`, `WAITING` to `CALLED`, `CALLED` to `SERVING`, `SERVING` to `COMPLETED`, each with operator1 as actor (except the join); the rejected start adds no row |
| TEST-F06-09 | AC-F06-09 | api | Logged in as customer1 | POST call-next on A; start and complete on an A entry | Each 403 `FORBIDDEN_ROLE`; DB unchanged |
| TEST-F06-10 | AC-F06-10 | api | operator2 is assigned only to C | POST call-next on A; start and complete on an A entry as operator2 | Each 403 `FORBIDDEN_QUEUE`; DB unchanged |
| TEST-F06-11 | AC-F06-11 | api | operator1 assigned to A and B; operator2 to C | GET /api/operator/queues as operator1, operator2, customer1 | operator1: A and B only, with `waitingCount` and `current`; operator2: C only; customer1: 403 `FORBIDDEN_ROLE` |

Queue B is used for state-changing tests so the seed state of queue A stays available for F-05 and F-07 tests; the test DB is reseeded before the suite.

TDD: TEST-F06-03 and TEST-F06-06 are committed failing before the implementation; their failing and passing output goes in the PR.

## 7. Definition of Done

All AC implemented; TEST-F06-01..11 executed and passing at the PR head with failing-first output in the PR; transition rules live only in `nextStatus`; reviewer ran an invalid transition by hand and saw 409; the F-03 route matrix is updated with `GET /api/operator/queues` in the same PR if F-03 has merged.

## 8. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version; adds `GET /api/operator/queues` for F-08b | Deliverable 1 |
