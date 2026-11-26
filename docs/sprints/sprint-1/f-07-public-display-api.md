# F-07 Public Display API

Issue #9. Author TauForge, reviewer MacOverlorD. Requirements: FR-12 (API part), BR-08. Depends on: F-01. The display screen is F-11 in Sprint 2.

## 1. Behavior

Anyone, without logging in, can read a queue's public status: its name, the ticket number now being called or served, and how many people are waiting.

## 2. API specification

### GET /api/queues/:id/display (public, no session)

Response 200:

```json
{ "queueId": 1, "queueName": "Registrar Desk", "isOpen": true,
  "currentNumber": 5, "currentStatus": "SERVING", "waitingCount": 3, "isFull": false }
```

- `currentNumber` / `currentStatus`: the entry in `CALLED` or `SERVING` (at most one per queue by BR-05); both `null` when none.
- `waitingCount`: number of `WAITING` entries.
- `isFull` (added 26 Nov 2026, CR-01 #82): `true` when the queue has a waiting limit and `waitingCount >= maxWaiting`. The limit itself is not returned.
- Unknown queue id: 404 `NOT_FOUND`.

No other fields are returned. In particular no customer id, name, email or entry id.

Data: read-only; no schema change. UI: none in Sprint 1.

## 3. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F07-01 | Without a session, the endpoint returns queue name, open flag, the current called/serving number and status (or null), and the waiting count. |
| AC-F07-02 | The response contains no customer name, email, user id or entry id, even when the current entry has a customer. |
| AC-F07-03 | An unknown queue id returns 404 `NOT_FOUND` with the shared error shape. |
| AC-F07-04 | (CR-01) `isFull` is `true` for a queue at its waiting limit and `false` otherwise, with still no private data. |

## 4. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F07-01 | AC-F07-01 | api | Seed queue A: one SERVING, two WAITING; queue B empty | GET display for A and B with no cookie | A: current number and status SERVING, waitingCount 2; B: currentNumber null, waitingCount 0 |
| TEST-F07-02 | AC-F07-02 | api | Queue A as in TEST-F07-01 | GET display for A; inspect body keys | Keys are exactly `queueId, queueName, isOpen, currentNumber, currentStatus, waitingCount, isFull` (`isFull` added by CR-01); no name/email/id values of customers anywhere in the JSON text |
| TEST-F07-04 | AC-F07-04 | api | B `maxWaiting = 1`, empty | GET display B; customer1 joins B; GET again | `isFull` false, then true; keys as TEST-F07-02 |
| TEST-F07-03 | AC-F07-03 | api | id 9999 | GET display | 404 `NOT_FOUND`, shared error shape |

## 5. Definition of Done

All AC implemented; TEST-F07-01..03 executed and passing with failing-first output in the PR; response keys match this contract exactly.

## 6. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version | Deliverable 1 |
| 5 Nov 2026 | A malformed queue id (`abc`, `0`, `-1`) also returns 404 `NOT_FOUND`, like an unknown id (added to TEST-F07-03). Public route, so no existence is leaked either way. | Contract only named unknown ids |
| 26 Nov 2026 | Adds `isFull`; AC-F07-04 and TEST-F07-04 added; TEST-F07-01 bodies and TEST-F07-02 key list gain `isFull` | Lab 7 change request CR-01 (#82), contract `docs/maintenance/cr-01-queue-capacity.md` |
