# F-05 View Entries

Issue #7. Author TauForge, reviewer MacOverlorD. Requirements: FR-06, FR-07, BR-06, BR-07. Depends on: F-03.

## 1. Behavior

A customer sees their own entries with status and the number of people ahead. An operator sees the active entries of a queue assigned to them, in queue order.

## 2. API specification

### GET /api/me/entries (customer)

Query: `status=active` (optional; default returns all of the customer's entries, newest first).

Response 200:

```json
{ "entries": [
  { "id": 12, "queueId": 1, "queueName": "Registrar Desk", "number": 7,
    "status": "WAITING", "peopleAhead": 2, "createdAt": "2026-11-05T10:00:00.000Z" }
] }
```

`peopleAhead` = count of `WAITING` entries in the same queue with a lower number, and is `null` unless the status is `WAITING`.

### GET /api/me/entries/:id (customer)

200 with one entry of the same shape. If the entry does not exist or belongs to another customer: 404 `NOT_FOUND` (same response for both, so existence is not leaked).

### GET /api/queues/:id/entries (operator assigned to queue)

Returns entries with status `WAITING`, `CALLED` or `SERVING`, ordered by number ascending:

```json
{ "queue": { "id": 1, "name": "Registrar Desk", "isOpen": true },
  "entries": [ { "id": 12, "number": 7, "status": "WAITING", "customerName": "Customer One", "createdAt": "..." } ] }
```

Operators see `customerName` (needed to serve the person) but never email or password hash. Authorization is F-03.

UI: none in this feature (screens are F-08a and F-08b). Data: no schema change.

## 3. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F05-01 | A customer receives only their own entries; each shows queue name, number, status, and `peopleAhead` for waiting entries. |
| AC-F05-02 | A customer requesting another customer's entry id (or a missing id) gets 404 `NOT_FOUND` with no data from that entry. |
| AC-F05-03 | An operator assigned to a queue receives its `WAITING`, `CALLED` and `SERVING` entries ordered by number ascending; final statuses are excluded. |
| AC-F05-04 | An operator not assigned to the queue gets 403 `FORBIDDEN_QUEUE` and no entries (enforced by F-03). |
| AC-F05-05 | Responses never contain `passwordHash`, `email` of customers, or other customers' entries for a customer caller. |

## 4. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F05-01 | AC-F05-01 | api | Seed: customer1 waiting in queue A with one other waiting entry ahead | GET /api/me/entries as customer1 | Only customer1 entries; waiting entry has `peopleAhead` 1; non-waiting `peopleAhead` null |
| TEST-F05-02 | AC-F05-02 | api | Entry id belongs to customer2 | GET /api/me/entries/:id as customer1; also a nonexistent id | Both 404 `NOT_FOUND`, identical bodies, no entry fields |
| TEST-F05-03 | AC-F05-03 | api | Queue A has WAITING x2, SERVING, COMPLETED, CANCELLED, NO_SHOW | GET /api/queues/A/entries as operator1 | Only the two WAITING and the SERVING entry; sorted by number ascending; final statuses absent |
| TEST-F05-04 | AC-F05-04 | api | operator2 not assigned to A | GET /api/queues/A/entries as operator2 | 403 `FORBIDDEN_QUEUE`; no `entries` field |
| TEST-F05-05 | AC-F05-05 | api | Responses from TEST-F05-01 and 03 | Scan JSON for `passwordHash` and `email` | Fields absent |

## 5. Definition of Done

All AC implemented; TEST-F05-01..05 executed and passing with failing-first output in the PR; response shapes match this contract; reviewer checked the 404 behavior for another customer's entry by hand.

## 6. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version | Deliverable 1 |
