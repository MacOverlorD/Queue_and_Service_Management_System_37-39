# F-04 Join Queue

Issue #6. Author MacOverlorD, reviewer TauForge. Requirements: FR-04, FR-05, BR-01, BR-02, BR-09, BR-10, BR-11, NFR-03. Depends on: F-03.

## 1. Behavior

A customer sees the service queues and joins an open one. They receive the next ticket number with status `WAITING`. A customer cannot hold two active entries in one queue, cannot join a closed queue, and may join again after their previous entry reaches a final status. Numbers stay unique and consecutive when many customers join at once.

Only customers may list and join queues (BR-09); the role check is `requireRole("CUSTOMER")` from F-03 and its 403 tests are TEST-F03-04.

## 2. Counter decision (resolves SRS Q-02)

**Confirmed: `Queue.lastNumber`** (the last number handed out, default 0), as written in the F-01 contract and the shared conventions. The join runs, inside one transaction:

```sql
UPDATE "Queue" SET "lastNumber" = "lastNumber" + 1
WHERE id = $1 AND "isOpen" = true
RETURNING "lastNumber";
```

The returned value is the new ticket number, so there is no off-by-one. The row lock taken by this `UPDATE` serializes concurrent joins on the same queue. Then the entry and its `EntryEvent` (`fromStatus` null, `toStatus` `WAITING`) are inserted in the same transaction.

If the `UPDATE` returns no row, the service checks whether the queue exists: missing gives 404 `NOT_FOUND`, closed gives 409 `QUEUE_CLOSED`. If the insert violates the D-13 partial unique index, the transaction rolls back (so `lastNumber` does not advance) and the API returns 409 `DUPLICATE_ACTIVE_ENTRY`. The service does not pre-check duplicates; the database constraint is the single source of truth.

## 3. API specification

### GET /api/queues (customer)

Response 200, ordered by name:

```json
{ "queues": [
  { "id": 1, "name": "Registrar Desk", "serviceName": "Registration documents", "isOpen": true, "waitingCount": 2 }
] }
```

`waitingCount` = number of `WAITING` entries in the queue. No entry or customer data is included.

### POST /api/queues/:id/entries (customer)

No request body. `:id` must be a positive integer, otherwise 400 `VALIDATION_ERROR`.

Response 201:

```json
{ "entry": { "id": 41, "queueId": 1, "queueName": "Registrar Desk", "number": 8,
             "status": "WAITING", "peopleAhead": 2, "createdAt": "2026-11-06T03:00:00.000Z" } }
```

Same entry shape as F-05 `GET /api/me/entries`.

| Case | Response |
|---|---|
| Queue does not exist | 404 `NOT_FOUND` |
| Queue closed (BR-10) | 409 `QUEUE_CLOSED` |
| Customer already has a `WAITING`, `CALLED` or `SERVING` entry in this queue (BR-01) | 409 `DUPLICATE_ACTIVE_ENTRY` |

On every rejection nothing is written: no entry, no event, no counter change.

## 4. Data and UI

Data: uses `Queue.lastNumber`, `QueueEntry`, `EntryEvent` and the D-13 index from F-01. No schema change.
UI: none in this feature (queue list and Join button are F-08a).

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F04-01 | A customer listing queues receives every queue with id, name, service name, open flag and waiting count, and no entry or customer data. |
| AC-F04-02 | A customer joining an open queue gets 201 with a `WAITING` entry whose number is the queue's previous `lastNumber` + 1; the entry, one `EntryEvent` and the new `lastNumber` are stored. |
| AC-F04-03 | A customer who already has an active entry in the queue gets 409 `DUPLICATE_ACTIVE_ENTRY`; no entry or event is added and `lastNumber` is unchanged. |
| AC-F04-04 | A customer whose only entry in the queue is final (`COMPLETED`, `CANCELLED` or `NO_SHOW`) can join again and gets a new, higher number. |
| AC-F04-05 | Joining a closed queue returns 409 `QUEUE_CLOSED`; joining an unknown queue returns 404 `NOT_FOUND`; a non-integer id returns 400 `VALIDATION_ERROR`. Nothing is written. |
| AC-F04-06 | 50 different customers joining the same queue at the same time all succeed with 50 distinct, consecutive numbers, and `lastNumber` ends 50 higher. |

## 6. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F04-01 | AC-F04-01 | api | Seed: queues A, B, C (C closed); A has two `WAITING` | GET /api/queues as customer1 | 200; three queues; A `waitingCount` 2, C `isOpen` false; no keys `entries`, `customerId`, `email` anywhere in the body |
| TEST-F04-02 | AC-F04-02 | api | customer3 has no active entry in A; read A's `lastNumber` = n | POST /api/queues/A/entries as customer3 | 201; `number` n + 1, `status` `WAITING`; DB has the entry, one `EntryEvent` (null to `WAITING`, actor customer3), and A `lastNumber` n + 1 |
| TEST-F04-03 | AC-F04-03 | api | customer3 joined A in this test | POST join A again as customer3 | 409 `DUPLICATE_ACTIVE_ENTRY`; entry count, event count and `lastNumber` unchanged |
| TEST-F04-03b | AC-F04-03 | api | customer3's entry in A moved to `CALLED` in the DB | POST join A as customer3 | 409 `DUPLICATE_ACTIVE_ENTRY` (called still counts as active) |
| TEST-F04-04 | AC-F04-04 | api | customer3's only entry in A set to `COMPLETED` in the DB | POST join A as customer3 | 201 with a number greater than the completed entry's number |
| TEST-F04-05 | AC-F04-05 | api | Queue C is closed; id 9999 does not exist | POST join C; POST join 9999; POST join `abc` as customer1 | 409 `QUEUE_CLOSED`; 404 `NOT_FOUND`; 400 `VALIDATION_ERROR`; DB unchanged in all three |
| TEST-F04-06 | AC-F04-06 | integration | 50 extra test customers created in the test DB, each logged in; A `lastNumber` = n | Fire 50 joins to A with `Promise.all` | 50 × 201; numbers are exactly n + 1 .. n + 50 with no duplicates; A `lastNumber` n + 50 |
| TEST-F04-06b | AC-F04-03 | integration | One logged-in customer with no entry in A | Fire 10 joins to A from that customer at the same time | Exactly one 201 and nine 409 `DUPLICATE_ACTIVE_ENTRY`; one active entry in DB; `lastNumber` advanced by exactly 1 |
| TEST-F04-03c | AC-F04-03 | api | Queue A `lastNumber` set back to 5 while number 6 exists | POST join A as customer3 | 500 `INTERNAL_ERROR` (not 409); nothing written. Only the D-13 index maps to `DUPLICATE_ACTIVE_ENTRY` |

TDD: TEST-F04-03 and TEST-F04-06 are committed failing before the implementation; their failing and passing output goes in the PR.

## 7. Definition of Done

All AC implemented; TEST-F04-01..06b executed and passing at the PR head with failing-first output in the PR; the join path contains no read-then-write of the counter; reviewer ran one duplicate join by hand and saw 409.

## 8. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version; confirms `lastNumber` (SRS Q-02) | Deliverable 1 |
| 5 Nov 2026 | Only a P2002 on `(queueId, customerId)` maps to 409; added TEST-F04-03c | Tau's review on #22 |
