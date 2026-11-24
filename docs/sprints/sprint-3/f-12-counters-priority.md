# F-12 Counters and Priority

Issue #67. Author MacOverlorD, reviewer TauForge. Sprint 3, **contract only** for Deliverable 2 (planned, not implemented). Requirements: FR-18, FR-19, BR-03, BR-05 (revised), BR-06, BR-14, NFR-01, NFR-03. Closes known gap G-02. Depends on: F-06 (call next), F-09 (final statuses), F-10 (console), F-07/F-11 (display).

**Priority policy (SRS Q-04): agreed on 25 Nov 2026** (section 9). Section 3 is the policy to build. If it is ever revised, only section 3, its AC and its tests change; the counter part does not depend on it.

## 1. Behavior

Two independent parts, built and merged as two PRs:

- **Counters (FR-18):** a queue can have several counters (for example "Counter 1", "Counter 2"). Operators assigned to the queue call the next customer **to a counter**. Each counter serves one customer at a time, so a queue with two counters can have two customers called or served at once. BR-05 becomes "at most one `CALLED`/`SERVING` entry **per counter**" and is enforced by the database (closes G-02).
- **Priority (FR-19, BR-14):** a waiting entry can be marked as priority by an assigned operator (for example an elderly or disabled student, checked at the counter). Call next takes waiting priority entries before normal ones; inside each class the lowest ticket number goes first (BR-03). A fairness rule stops normal customers from waiting forever.

Customers do not choose a counter and cannot mark themselves as priority (no self-declaration, so no abuse). Every rule is enforced on the backend (F-03 guards).

## 2. Counters

### Data (migration, additive)

| Change | Detail |
|---|---|
| New model `Counter` | `id`, `queueId` (FK, cascade), `name` (e.g. "Counter 1"); `@@unique([queueId, name])` |
| `QueueEntry.counterId` | `Int?`, FK to `Counter`; set when the entry is called; kept after it is final (shows who served it) |
| Partial unique index (raw SQL) | `ON "QueueEntry"("counterId") WHERE status IN ('CALLED','SERVING')`: one active entry per counter, enforced by PostgreSQL (BR-05 revised, G-02). The old per-queue rule is removed. |
| Migration of existing data | Every existing queue gets one counter "Counter 1"; existing `CALLED`/`SERVING` entries get that counter's id. No entry or ticket number changes. |
| Seed | Registrar Desk: "Counter 1", "Counter 2"; Finance Desk and Student Affairs: "Counter 1". |

### API

**POST /api/queues/:id/call-next** (operator assigned to the queue; unchanged guard)

Body: `{ "counterId": 3 }`.

- `counterId` must be a counter of this queue: otherwise 400 `VALIDATION_ERROR` "Choose a counter of this queue.".
- If the body has no `counterId` and the queue has **exactly one** counter, that counter is used (keeps Sprint 1/2 clients and tests working). With several counters and no `counterId`: 400 `COUNTER_REQUIRED` "Choose a counter.".
- In one transaction: lock the **counter** row (`FOR UPDATE`); if the counter has a `CALLED`/`SERVING` entry → 409 `COUNTER_BUSY` "Finish the current customer at this counter first."; pick the next entry by section 3 (or BR-03 until F-12b merges); set `CALLED`, `calledAt`, `handledByOperatorId`, `counterId`; insert the `EntryEvent`. Another counter of the same queue is not blocked.
- The queue row is still locked first, so two counters calling at the same moment never take the same entry (NFR-03).
- Response: the F-06 operator entry shape plus `"counter": { "id": 3, "name": "Counter 1" }`.

`QUEUE_BUSY` (Sprint 1) is replaced by `COUNTER_BUSY`; the message the console shows is updated.

**Reads (additive, nothing removed):**
- `GET /api/operator/queues`: each queue gains `counters: [{ id, name, current: { entryId, number, status } | null }]`. The old `current` stays (the first busy counter by name) until the console uses `counters`.
- `GET /api/queues/:id/display` (public, F-07): gains `nowServing: [{ counterName, number, status }]` ordered by counter name. Still no customer data (BR-08). `currentNumber`/`currentStatus` stay for compatibility (first busy counter).
- `GET /api/queues/:id/entries` (operator): each active row gains `counterName` (null while waiting) and `priority`.

**UI:**
- Console: a **Counter** select per queue (remembered in the URL as `?queue=<id>&counter=<id>`, like F-10); Call next sends `counterId`; Now serving shows the entry of the chosen counter; the overview shows each counter's current number.
- Display page (F-11): one line per busy counter, "Counter 2: 17 Serving"; waiting count unchanged.

## 3. Priority policy (agreed, Q-04)

### Data

`QueueEntry.priority`: enum `NORMAL | PRIORITY`, default `NORMAL`. `QueueEntry.priorityMarkedById`: `Int?` (operator who set it). Migration: all existing entries `NORMAL`.

### Rules

| Rule | Definition |
|---|---|
| R-F12-1 Who | Only an operator assigned to the entry's queue may mark or unmark priority, and only while the entry is `WAITING`. Customers cannot (403 `FORBIDDEN_ROLE`). |
| R-F12-2 Order | Call next takes the `PRIORITY` waiting entry with the lowest number; if there is none, the `NORMAL` waiting entry with the lowest number (BR-14 with BR-03 inside each class). |
| R-F12-3 Fairness | If the last **3** calls of the queue (any counter, from `EntryEvent`) were all priority entries and a `NORMAL` entry is waiting, the next call takes the head `NORMAL` entry instead. The limit 3 is a constant in one place (`PRIORITY_RUN_LIMIT`). |
| R-F12-4 People ahead | For a waiting customer, `peopleAhead` = waiting priority entries ahead by R-F12-2 plus normal entries with a lower number (for a `NORMAL` entry), or priority entries with a lower number (for a `PRIORITY` entry). It is an estimate: R-F12-3 may move a normal entry forward. |
| R-F12-5 Visibility | The customer sees "Priority" on their own ticket; the public display shows no priority flag and no names (BR-08). |

The selection is one pure function `pickNext(waiting, recentCalls)` that replaces the F-06 `pickNext`; it stays the only place the order rule lives.

### API

**POST /api/entries/:id/priority** (operator assigned to the entry's queue; guard `operatorOnEntryParam`)

Body: exactly `{ "priority": "PRIORITY" }` or `{ "priority": "NORMAL" }`. Any other value or extra fields: 400 `VALIDATION_ERROR`. An entry that is not `WAITING`: 409 `INVALID_TRANSITION` "Only a waiting ticket can change priority.". Sets `priority` and `priorityMarkedById`; idempotent. Response: the F-06 operator entry shape plus `priority`.

**UI:** console waiting list shows a "Priority" badge and a **Mark priority** / **Remove priority** button per waiting row.

## 4. Errors (shared shape)

| Case | Status / code |
|---|---|
| No session | 401 `UNAUTHENTICATED` |
| Customer on any operator route | 403 `FORBIDDEN_ROLE` |
| Operator not assigned (queue or entry) | 403 `FORBIDDEN_QUEUE` |
| `counterId` not a counter of the queue / bad priority body | 400 `VALIDATION_ERROR` |
| Several counters and no `counterId` | 400 `COUNTER_REQUIRED` |
| Counter already has an active entry | 409 `COUNTER_BUSY` |
| No waiting entry | 409 `NO_WAITING_ENTRY` (unchanged) |
| Priority change on a non-waiting entry | 409 `INVALID_TRANSITION` |

F-03 route matrix gains `POST /api/entries/:id/priority` → `operatorOnEntryParam`.

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F12-01 | On a queue with two counters, operators can have one entry `CALLED`/`SERVING` at each counter at the same time; each entry records its counter. |
| AC-F12-02 | Call next for a counter that already has a `CALLED`/`SERVING` entry returns 409 `COUNTER_BUSY` and changes nothing; the other counter can still call. |
| AC-F12-03 | Two simultaneous call-next requests for two different counters of one queue call two different entries (the two lowest by policy); two for the same counter call exactly one. |
| AC-F12-04 | The database refuses a second active entry on one counter even when written directly (partial unique index; G-02 closed). |
| AC-F12-05 | `counterId` of another queue, or missing with several counters, gives 400 (`VALIDATION_ERROR` / `COUNTER_REQUIRED`); missing with one counter uses that counter. |
| AC-F12-06 | The display API and page show each busy counter's number and status, and still no customer data. |
| AC-F12-07 | An assigned operator can mark and unmark a waiting entry as priority; a customer gets 403 `FORBIDDEN_ROLE`, another operator 403 `FORBIDDEN_QUEUE`; a non-waiting entry gives 409. |
| AC-F12-08 | Call next takes the lowest-numbered priority entry before any normal entry; with no priority entry it takes the lowest normal number (BR-14, BR-03). |
| AC-F12-09 | After 3 consecutive priority calls in a queue, if a normal entry waits, the next call takes the head normal entry (R-F12-3). |
| AC-F12-10 | `peopleAhead` follows R-F12-4 for normal and priority entries. |
| AC-F12-11 | Existing data migrates without change of numbers or statuses; Sprint 1/2 journeys pass on a one-counter queue without sending `counterId`. |
| AC-F12-12 | UI: an operator chooses a counter, calls to it, marks a waiting customer as priority, and sees that customer called first. |

## 6. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F12-01 | AC-F12-01 | api | Registrar Desk with Counter 1 and 2; #5, #6 waiting, #4 serving at Counter 1 | operator1 call-next with Counter 2 | 200; #5 `CALLED` with Counter 2; #4 still `SERVING` at Counter 1 |
| TEST-F12-02 | AC-F12-02 | api | Counter 1 busy | call-next Counter 1; then Counter 2 | 409 `COUNTER_BUSY`, no change; then 200 |
| TEST-F12-03 | AC-F12-03 | integration | Two free counters, three waiting entries | Two call-next at once (Counter 1, Counter 2), 10 rounds; then two at once on one counter | Two different entries called; same counter: one 200, one 409 |
| TEST-F12-04 | AC-F12-04 | db | One `CALLED` entry on a counter | Prisma update a second entry to `SERVING` with the same `counterId` | Unique violation; data unchanged |
| TEST-F12-05 | AC-F12-05 | api | Queues with one and two counters | call-next with a counter of another queue; without `counterId` on both | 400 `VALIDATION_ERROR`; 400 `COUNTER_REQUIRED`; 200 on the one-counter queue |
| TEST-F12-06 | AC-F12-06 | api + e2e | Two busy counters | GET display; open `/display/<id>` | `nowServing` has two items with counter names; page shows both lines; no names/emails |
| TEST-F12-07 | AC-F12-07 | api | Waiting and called entries | Mark/unmark as operator1, customer1, operator2; on the called entry | 200/200; 403 `FORBIDDEN_ROLE`; 403 `FORBIDDEN_QUEUE`; 409 |
| TEST-F12-08 | AC-F12-08 | unit + api | Waiting #7 N, #8 P, #9 P | `pickNext`; then call-next ×3 | Order #8, #9, #7 |
| TEST-F12-09 | AC-F12-09 | unit + api | Last 3 calls priority; waiting #10 N, #11 P | `pickNext`; call-next | #10 is called |
| TEST-F12-10 | AC-F12-10 | api | Mixed waiting entries | GET own entry as each customer | `peopleAhead` matches R-F12-4 |
| TEST-F12-11 | AC-F12-11 | integration + e2e | Database at `v0.2.0-rc1` with entries in every status | Run the migration; run the Sprint 1/2 e2e | Numbers and statuses unchanged, each queue has "Counter 1"; all journeys pass |
| TEST-F12-12 | AC-F12-12 | e2e | Seed; two customers waiting in Registrar Desk | Choose Counter 2, mark the later customer priority, Call next | The priority customer is called to Counter 2 |

TDD: TEST-F12-02, TEST-F12-04 and TEST-F12-08 are committed failing before each part's implementation; failing and passing output with commit IDs goes in the PRs.

## 7. Definition of Done

- Two PRs into the Sprint 3 staging branch: **F-12a counters** (migration, BR-05 per counter, display/console) and **F-12b priority** (policy agreed, Q-04). Contract merged first; first commit of each is the failing tests.
- AC-F12-01..12 implemented; TEST-F12-01..12 pass; full server suite and all e2e pass with counts saved; migration tested on a copy of the rc1 data.
- SRS: BR-05 text updated to "per counter", D-08 retired, Q-04 closed with the agreed policy (section 9); G-02 marked resolved; F-03 matrix and traceability rows (FR-18, FR-19, BR-05, BR-14) updated.
- Reviewer ran two counters by hand and saw two customers called at once, and a `COUNTER_BUSY` on a busy counter.

## 8. Status at Deliverable 2

| Part | Status | Target |
|---|---|---|
| F-12a Counters | **Planned.** Contract only; no code, no test run. | MacOverlorD, merged by Sat 5 Dec |
| F-12b Priority | **Planned.** Policy agreed (Q-04, section 9); contract only, no code, no test run. | MacOverlorD, merged by Tue 8 Dec |

## 9. Decision on the priority policy (Q-04)

| Date | Question | Answer |
|---|---|---|
| 25 Nov 2026 | Is "operator marks priority; priority first, lowest number inside a class; after 3 priority calls one normal" acceptable for BR-14? | Yes, go ahead with this policy (confirmed by MacOverlorD for the team). Q-04 closed. |

## 10. Revisions

| Date | Change | Reason |
|---|---|---|
| 25 Nov 2026 | First version | Deliverable 2, Sprint 3 contract |
| 25 Nov 2026 | Priority policy agreed; Q-04 closed (section 9) | Team decision |
