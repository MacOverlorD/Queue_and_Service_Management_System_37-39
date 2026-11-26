# CR-01 Queue capacity limit on join (Lab 7 maintenance change)

Issue #82. Author TauForge (contract), MacOverlorD (implementation). Reviewer of this contract: MacOverlorD, before any code is written. Version 1.0, 26 Nov 2026.

This document is the change contract. It holds the old and new rule, the impact analysis, the design, the acceptance criteria and the tests. The feature contracts it changes (F-04, F-07, F-08a, F-10, F-11), `docs/srs.md` 0.4 and `docs/system-sds.md` 0.4 are revised in the same pull request and point back here.

## 1. Versions

| Item | Value |
|---|---|
| Accepted Sprint 1 baseline (old behaviour) | `v0.1.0-sprint1` = `628485c`; accepted in the Lab 6 UAT on `253b80e` (revision `qms-00007-zqx`), #59 |
| Actual pre-change implementation | `main` at `577e1cf` = `v0.2.0` (revision `qms-00010-872`); `sprint2-staging` has the same content. `joinQueue` in `server/src/services/queues.ts` is unchanged since `628485c` (`git diff 628485c 577e1cf -- server/src/services/queues.ts` is empty). |
| Intervening development (not part of CR-01) | Sprint 2: F-09, F-10, F-11. Sprint 3 work delivered early: F-13. Contracts for F-12 and hardening. Deliverable 2 documents. |
| Planned release | `v0.3.0-lab7` on `main`, new Cloud Run revision |

## 2. Old and new rule

| | Rule |
|---|---|
| **Old** (FR-05, BR-10, AC-F04-02) | An open queue accepts every join. A join is refused only when the queue is closed (409 `QUEUE_CLOSED`) or the customer already has an active entry in it (409 `DUPLICATE_ACTIVE_ENTRY`). A queue can grow without limit. |
| **New** (FR-05, new BR-15) | A queue may have a waiting limit `maxWaiting`: a whole number from 1 to 200, or `null` for no limit. When the queue already has `maxWaiting` entries in `WAITING`, a join is refused with **409 `QUEUE_FULL`** "This queue is full. Please try again later." Only `WAITING` entries count; `CALLED` and `SERVING` do not. When an entry leaves `WAITING` (called or cancelled), a place opens again. |
| **Reason** | A counter can serve only a known number of students in a session. An endless line wastes students' time and promises a service that will not happen today. The service centre wants to stop issuing tickets once the line is long enough. |
| **Approval** | Both team members, 26 Nov 2026 (#82). The Lab 7 announcement says no instructor or TA approval is needed. |

## 3. Behaviour in detail

### 3.1 Join (F-04)

Order of checks, so each case has one answer:

1. Unknown queue: 404 `NOT_FOUND` (unchanged).
2. Closed queue: 409 `QUEUE_CLOSED` (unchanged; a queue that is closed **and** full gives `QUEUE_CLOSED`).
3. Customer already has an active entry in this queue: 409 `DUPLICATE_ACTIVE_ENTRY` (unchanged; a customer already waiting in a full queue is told they have a ticket, not that the queue is full).
4. `maxWaiting` is set and the queue already has `maxWaiting` waiting entries: 409 `QUEUE_FULL` (new).
5. Otherwise 201 as before.

On every refusal nothing is written: no entry, no event, and `lastNumber` is unchanged, so no ticket number is used (BR-02).

Algorithm, one transaction, extending the existing D-12 design:

```sql
UPDATE "Queue" SET "lastNumber" = "lastNumber" + 1
WHERE id = $1 AND "isOpen" = true
RETURNING "lastNumber", "maxWaiting";
```

- Zero rows: 404 or 409 `QUEUE_CLOSED`, unchanged.
- Insert the entry and its `EntryEvent` exactly as before. A D-13 violation gives `DUPLICATE_ACTIVE_ENTRY` and rolls back, unchanged.
- **New:** if `maxWaiting` is not null, count the queue's `WAITING` entries (this count includes the new entry). If the count is greater than `maxWaiting`, throw `QUEUE_FULL`; the transaction rolls back, so the entry, the event and the counter increment all disappear.

Why this is safe under concurrency: the `UPDATE` locks the queue row, so joins on one queue run one at a time. In PostgreSQL's default isolation (read committed) each statement sees rows committed before it starts, so when a join gets the lock, the count already includes every join that committed before it. Two joins can never both take the last place. Call next and cancel lock the same row (D-16), so they are serialized with joins too. Setting `maxWaiting` (PATCH) is an `UPDATE` of the same row and also waits for the lock.

### 3.2 Setting the limit (F-10)

`PATCH /api/queues/:id`, same guard as today (`operatorOnQueueParam`: 401 without a session, 403 `FORBIDDEN_ROLE` for a customer, 403 `FORBIDDEN_QUEUE` for an operator not assigned or an unknown or malformed id).

Body: exactly one field, either the existing `{ "isOpen": <boolean> }` or the new `{ "maxWaiting": <1..200 or null> }`.

| Body | Result |
|---|---|
| `{ "maxWaiting": 20 }` | 200; limit set |
| `{ "maxWaiting": null }` | 200; no limit |
| `{ "maxWaiting": 0 }`, `201`, `1.5`, `"20"`, `true` | 400 `VALIDATION_ERROR` "maxWaiting must be a whole number from 1 to 200, or null." |
| Anything else that is not exactly `{ isOpen: boolean }` (empty, extra fields, two fields) | 400 `VALIDATION_ERROR` "isOpen must be true or false." (unchanged message, so TEST-F10-05 stays as it is) |

Lowering the limit below the current waiting count removes nobody; only new joins are refused. Setting the same value again returns 200 and changes nothing.

Response 200: `{ "queue": { "id", "name", "isOpen", "maxWaiting" } }` (gains `maxWaiting`).

### 3.3 Reads

| Endpoint | Change |
|---|---|
| `GET /api/queues` (customer, F-04) | Each queue gains `maxWaiting` (number or null). Still no entry or customer data. |
| `GET /api/operator/queues` (F-06, used by the F-10 console) | Each queue gains `maxWaiting`. |
| `GET /api/queues/:id/display` (public, F-07) | Gains `isFull` (boolean): `true` when `maxWaiting` is set and `waitingCount >= maxWaiting`. The limit itself and all private data stay out (BR-08). |
| `GET /api/me/entries`, `GET /api/queues/:id/entries`, summaries | No change. |

### 3.4 UI

| Screen | Change |
|---|---|
| Queue list `/queues` (F-08a) | A queue with a limit shows "`n` / `max` waiting". An open queue with `waitingCount >= maxWaiting` shows **Full** and its button is disabled with the text "Full". A closed queue still shows **Closed** (closed wins). If a join still gets `QUEUE_FULL` (the list was out of date), the API message is shown in the existing error banner. The server decides; the UI only reflects it. |
| Operator console `/operator` overview (F-10) | Each row shows "`n` / `max` waiting" or "`n` waiting" without a limit, and a **Waiting limit** number input (1 to 200, empty means no limit) with a **Save** button. While saving the button is disabled; a rejected request shows the API message in the overview, like Open/Close. |
| Display `/display/:queueId` (F-11) | When `isFull` is true and the queue is open, shows "Full: not taking new tickets". Nothing else changes. |

### 3.5 Data

- Migration: `ALTER TABLE "Queue" ADD COLUMN "maxWaiting" INTEGER;` plus `CHECK ("maxWaiting" IS NULL OR "maxWaiting" BETWEEN 1 AND 200)` written as raw SQL in the same migration. Prisma: `maxWaiting Int?` on `Queue`.
- Additive and nullable: existing queues get `null` (no limit), so historical data, existing entries and every Sprint 1 and Sprint 2 behaviour stay the same until an operator sets a limit. No backfill.
- D-13 rule: the new migration file is checked for an accidental `DROP INDEX` of the partial unique index before it is committed; TEST-F01-03 fails if the index is gone.
- Seed: unchanged; every seeded queue keeps `null`. Tests and the demo set the limit themselves.
- Deployment: the Cloud Run job `qms-migrate` applies the migration before the new revision starts. An older revision still works against the new column (it ignores it), so a rollback needs no data step.
- No new event type: a refused join writes nothing, so F-13 summaries are unaffected.

## 4. Impact analysis

| Requirement | Feature | SRS | Feature contract (SDS) | System SDS | AC | STS tests | Code modules | Effect |
|---|---|---|---|---|---|---|---|---|
| FR-05, BR-10, **BR-15** (new), BR-02 | F-04 join | 4 (FR-05), 5 (BR-15), 8.1 (D-22) | `f-04-join-queue.md` v1.1 sections 2, 3, 5, 6 | 2.1, 3.1, 3.4 | AC-F04-02 (revised), AC-F04-07..12 | TEST-F04-07..12, TEST-F04-08b | `server/src/services/queues.ts` (`joinQueue`), `server/prisma/schema.prisma`, new migration | **Changed**: refuse when full |
| FR-04 | F-04 list | 4 (FR-04) | F-04 section 3 | 5.1 | AC-F04-01 (revised) | TEST-F04-01 (revised) | `queues.ts` (`listQueues`) | **Changed (additive)**: `maxWaiting` in the list |
| FR-15, FR-16, BR-06, BR-09 | F-10 PATCH and console | 4 (FR-15) | `f-10-queue-control-console.md` sections 2, 3, 4, 5 | 2.1, 3.4, 5.1 | AC-F10-10, AC-F10-11 | TEST-F10-10, TEST-F10-01 (revised), TEST-F04-13 (console part) | `server/src/routes/serve.ts` (PATCH), `server/src/services/serve.ts` (`setQueueOpen`, `operatorQueues`), `client/src/pages/OperatorConsole.tsx`, `client/src/api.ts` | **Changed**: where the limit is set and shown |
| FR-12, FR-17, BR-08 | F-07 display API, F-11 screen | 4 (FR-12) | `f-07-public-display-api.md`, `f-11-public-display-screen.md` | 4.1, 5.1 | AC-F07-04, AC-F11-07 | TEST-F07-04, TEST-F07-01 and TEST-F07-02 (revised), TEST-F04-13 (display part) | `server/src/routes/display.ts`, `client/src/pages/Display.tsx` | **Changed (additive)**: `isFull`; still no private data |
| FR-04, FR-05 | F-08a queue list | 4 | `f-08a-customer-ui.md` | 4.1 | AC-F08a-06 | TEST-F04-13 | `client/src/pages/Queues.tsx`, `client/src/api.ts` | **Changed (UI)**: Full state, disabled button |
| FR-08, FR-13, BR-03, BR-05, BR-12 | F-06 call next, F-09 cancel and no-show | none | none | 3.4 | (unchanged) | TEST-F04-09 (new: they free a place); F-06 and F-09 suites unchanged | none | **Unchanged**; leaving `WAITING` opens a place |
| BR-01, NFR-03, NFR-04 | F-04, F-01 | none | none | 3.4 | AC-F04-03, AC-F04-06 | TEST-F04-03..06b, TEST-F01-03 unchanged | none | **Unchanged**; lock order kept, `maxWaiting = null` is the old path |
| FR-06, BR-07 | F-05 own entries, people ahead | none | none | none | (unchanged) | F-05 suite unchanged | none | **Not applicable**: people ahead is counted by ticket number, and a refused join creates no entry |
| FR-01..03, NFR-02, NFR-05 | F-02 auth, F-03 route matrix | none | none | none | (unchanged) | F-02, F-03 suites unchanged | none | **Not applicable**: no new route; the PATCH route and its guard already exist |
| FR-20 | F-13 summaries | none | none | none | (unchanged) | F-13 suite unchanged | none | **Not applicable**: summaries count `EntryEvent` rows, and a refused join writes no event |
| FR-18, FR-19, BR-05, BR-14 | F-12 counters and priority (*planned*) | none now | note added to `f-12-counters-priority.md` | none | none | none | none | **Future constraint**: capacity limits admission (WAITING count); F-12 changes selection only, so it must not count priority or counters in the limit |
| Data and history | F-01 schema | none | F-04 section 4 | 3.1, 3.5 | AC-F04-12 | TEST-F04-14 (db), TEST-F01-03 unchanged | `schema.prisma`, migration | **Changed (additive)**: nullable column, no backfill, old rows unlimited |
| NFR-07, NFR-09 | configuration, deployment | none | none | none | none | full suite in CI | none | **Not applicable**: no new environment variable or secret; the existing migrate job applies the column |

### 4.1 Behaviour that must not change, and what protects it

| Behaviour | Protected by |
|---|---|
| BR-01 one active entry per customer per queue | TEST-F04-03, TEST-F04-03b, TEST-F04-06b, TEST-F01-03 (unchanged), TEST-F04-08b (new, precedence) |
| BR-02 numbers atomic, consecutive, never reused | TEST-F04-02, TEST-F04-06 (50 concurrent joins, unchanged), TEST-F04-08 and TEST-F04-10 (refused joins use no number) |
| BR-10 closed queue refused, entries still served | TEST-F04-05, TEST-F10-01..03 (unchanged), TEST-F04-11 |
| BR-06, BR-09 only assigned operators change a queue | TEST-F10-04 (unchanged), TEST-F10-10 (new roles), F-03 matrix tests |
| BR-08 no private data on the display | TEST-F07-02 (revised key list, same privacy check), TEST-F11-03 (unchanged) |
| The Sprint 1 customer and operator journeys | `e2e/tests/customer.spec.ts`, `e2e/tests/operator.spec.ts` (unchanged) |

### 4.2 Old tests whose expected result changes

Only these four assertions change, and only because responses gain a field. Every privacy and rule check in them stays.

| Test (file) | Old expected | New expected | Why |
|---|---|---|---|
| TEST-F04-01 (`server/tests/api/join-queue.test.ts`) | queue keys exactly `id, isOpen, name, serviceName, waitingCount` | same plus `maxWaiting` (`null` in the seed) | The list must show the limit (FR-04). The no-private-data check is unchanged. |
| TEST-F10-01 (`server/tests/api/queueControl.test.ts`) | PATCH response `{ id, name, isOpen }` | same plus `maxWaiting: null` | PATCH returns the full queue state. |
| TEST-F07-01 (`server/tests/api/publicDisplay.test.ts`) | two exact display bodies | same plus `isFull: false` | Display shows Full (FR-12). |
| TEST-F07-02 (same file) | keys exactly the six F-07 keys | the six keys plus `isFull` | Same; the regex check for customer data is unchanged. |

TEST-F10-05 (the 400 message for bad bodies) stays unchanged on purpose: the old message is kept for every body that is not a `maxWaiting` body.

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F04-01 (revised) | A customer listing queues receives every queue with id, name, service name, open flag, waiting count and **waiting limit (`maxWaiting`, null when none)**, and no entry or customer data. |
| AC-F04-02 (revised) | A customer joining an open queue **that is not full (BR-15)** gets 201 with a `WAITING` entry whose number is the queue's previous `lastNumber` + 1; the entry, one `EntryEvent` and the new `lastNumber` are stored. |
| AC-F04-07 | With `maxWaiting = m` and `m - 1` entries waiting, a join succeeds with 201 and the queue then has `m` waiting. |
| AC-F04-08 | With `maxWaiting = m` and `m` entries waiting, a join returns 409 `QUEUE_FULL`; no entry or event is added and `lastNumber` is unchanged. A customer who already has an active entry in that full queue gets `DUPLICATE_ACTIVE_ENTRY` instead. |
| AC-F04-09 | When an entry of a full queue is called or cancelled, the next join succeeds. |
| AC-F04-10 | Concurrent joins never leave more than `maxWaiting` entries waiting, and refused joins use no ticket number. |
| AC-F04-11 | A queue that is closed and full returns `QUEUE_CLOSED`. |
| AC-F04-12 | With `maxWaiting = null` a queue behaves as in Sprint 1 (no limit). Lowering the limit below the current waiting count removes nobody and refuses new joins. The database rejects a limit outside 1..200. |
| AC-F04-13 | The queue list shows "`n` / `max` waiting" and a disabled **Full** button for a full open queue; once a place opens, Join works again. |
| AC-F10-10 | Only an operator assigned to the queue can set `maxWaiting` to 1..200 or `null` (200, response includes `maxWaiting`); invalid values give 400 with the `maxWaiting` message; a customer gets 403 `FORBIDDEN_ROLE`, another operator 403 `FORBIDDEN_QUEUE`, no session 401; nothing changes on a refusal. `GET /api/operator/queues` returns `maxWaiting`. |
| AC-F10-11 | The console shows each queue's waiting count against its limit and lets the operator set or clear the limit. |
| AC-F07-04 | The display API returns `isFull: true` for a queue at its limit and `false` otherwise, and still no private data. |
| AC-F11-07 | The display screen shows "Full: not taking new tickets" for an open queue at its limit. |

## 6. Software Test Specification

Seed: A Registrar Desk (operator1; #4 `SERVING`, #5 and #6 `WAITING`), B Finance Desk (operator1, empty), C Student Affairs (operator2, closed). State-changing tests use B and set `maxWaiting` themselves; the suite reseeds per file. Server tests: `npm --prefix server test`; e2e: `npx playwright test` in `e2e/`.

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F04-07 | AC-F04-07 | api | B `maxWaiting = 2`; customer1 waiting in B | customer2 POST join B | 201 `WAITING`; B has 2 waiting |
| TEST-F04-08 | AC-F04-08 | api | B `maxWaiting = 2`; customer1, customer2 waiting; read B `lastNumber` = n, entry and event counts | customer3 POST join B | 409 `QUEUE_FULL` with the contract message; `lastNumber` still n; entry and event counts unchanged |
| TEST-F04-08b | AC-F04-08 | api | As TEST-F04-08 | customer1 POST join B again | 409 `DUPLICATE_ACTIVE_ENTRY` (not `QUEUE_FULL`); nothing written |
| TEST-F04-09 | AC-F04-09 | api | B full as in TEST-F04-08 | (a) operator1 call-next on B, then customer3 joins; (b) refill to full, customer2 cancels own entry, then customer4 joins | (a) 201; (b) 201; never more than 2 waiting |
| TEST-F04-10 | AC-F04-10 | integration | B `maxWaiting = 3`, empty; 10 test customers created and logged in; B `lastNumber` = n | Fire 10 joins to B with `Promise.all` | Exactly 3 × 201 and 7 × 409 `QUEUE_FULL`; B has 3 waiting; `lastNumber` = n + 3; the 3 numbers are n + 1..n + 3 |
| TEST-F04-11 | AC-F04-11 | api | B `maxWaiting = 1` with 1 waiting, then closed | customer3 POST join B | 409 `QUEUE_CLOSED` |
| TEST-F04-12 | AC-F04-12 | api | B `maxWaiting = null` | 5 customers join B; then set `maxWaiting = 2` (5 waiting) | 5 × 201; after lowering, still 5 waiting and the next join is 409 `QUEUE_FULL` |
| TEST-F04-14 | AC-F04-12 | db | Fresh seed | Direct `UPDATE "Queue" SET "maxWaiting" = 0` and `= 201` | Both rejected by the check constraint; `= 1`, `= 200` and `NULL` accepted |
| TEST-F10-10 | AC-F10-10 | api | B open, no limit | operator1 PATCH B `{maxWaiting:3}`, `{maxWaiting:null}`; operator1 PATCH with `0`, `201`, `1.5`, `"3"`; customer1 PATCH `{maxWaiting:3}`; operator2 PATCH `{maxWaiting:3}`; no session PATCH; then operator1 GET `/api/operator/queues` after setting 3 | 200 `maxWaiting:3`; 200 `maxWaiting:null`; 400 ×4 with the `maxWaiting` message; 403 `FORBIDDEN_ROLE`; 403 `FORBIDDEN_QUEUE`; 401; B unchanged after each refusal; B row in the list has `maxWaiting: 3` |
| TEST-F07-04 | AC-F07-04 | api | B `maxWaiting = 1`, empty | GET display B; customer1 joins B; GET display B | `isFull: false`, then `isFull: true`; keys still only the F-07 keys plus `isFull` |
| TEST-F04-13 | AC-F04-13, AC-F10-11, AC-F11-07 | e2e | Reseeded; operator1 and customer contexts | operator1 sets **Waiting limit** 1 on Finance Desk in the console and saves; customer3 joins Finance Desk from the list; customer4 opens the list; `/display/<B id>` opened; operator1 calls next on Finance Desk; customer4 reloads the list and joins | Console shows "0 / 1 waiting" then "1 / 1 waiting"; customer4 sees **Full** and a disabled button; display shows "Full: not taking new tickets"; after the call customer4 can join and gets a ticket |
| Revised | see 4.2 | api | as before | as before | TEST-F04-01, TEST-F10-01, TEST-F07-01, TEST-F07-02 with the added field |
| Regression | all | all | full suites | `npm --prefix server test`; `npx playwright test` | 0 failed, 0 skipped; every test not listed in 4.2 passes unchanged |

### 6.1 TDD order and RED evidence

1. This contract is merged first (reviewed by MacOverlorD).
2. **RED commit** on `lab7/cr01-queue-capacity`: the new tests, the four revised assertions, the Prisma field and the additive migration, **no logic change**. Proof that the code under test is the pre-change code: `git diff 577e1cf <RED> -- server/src` is empty and `git diff 577e1cf <RED> -- server/prisma` shows only `schema.prisma` and the new migration. Tests set `maxWaiting` directly in the database. Expected failure: TEST-F04-08 gets 201 instead of 409 `QUEUE_FULL` (behaviour missing, not a compile or fixture error). The output and the commit ID go in the PR.
3. **GREEN commit**: the join check, the PATCH field, the reads and the UI. The same tests pass, then the full regression.

### 6.2 Regression selection

The full server suite and the full Playwright run are used, because the change touches the join transaction, a migration, a shared route and three screens. The most relevant files: `join-queue.test.ts` (BR-01, BR-02, BR-10, NFR-03), `constraints.test.ts` (D-13 index survives the migration), `queueControl.test.ts` (PATCH body and guard), `publicDisplay.test.ts` (BR-08), `serve.test.ts` and `cancelNoShow.test.ts` (leaving `WAITING`), `authorization.test.ts` (route matrix), `seed-and-health.test.ts` (seed unchanged), and the e2e `customer.spec.ts`, `operator.spec.ts`, `display.spec.ts`.

## 7. Definition of Done

- AC-F04-01..02 (revised), AC-F04-07..13, AC-F10-10..11, AC-F07-04, AC-F11-07 implemented; all tests above pass at the PR head; 0 failed and 0 skipped in both suites.
- RED and GREEN outputs with commit IDs in the code PR; CI green on the PR into `sprint2-staging`.
- Migration checked for `DROP INDEX`; `docs/traceability.md` rows for FR-04, FR-05, FR-12, FR-15 and BR-15 point to the new tests and results.
- Reviewer (TauForge) sets a limit by hand and sees `QUEUE_FULL` and the Full button.
- After deploy: on the deployed URL, a full queue refuses a join with 409 `QUEUE_FULL` and shows Full; the limit is reset to `null`; a normal join and operator2's 403 on Finance Desk still work.

## 8. Revisions

| Date | Version | Change | Reason |
|---|---|---|---|
| 26 Nov 2026 | 1.0 | First version | Lab 7, CR-01 (#82) |
