# F-13 Service Summaries

Issue #66. Author TauForge, reviewer MacOverlorD. Sprint 3 (implemented early as the Deliverable 2 Sprint 3 workflow). Requirements: FR-20, NFR-10 (measured later by the hardening timing script, #68). Depends on: F-03 (queue-scope guard), F-06 (status history), F-09 (writes the `CANCELLED` and `NO_SHOW` events; the tests seed those events directly, so F-13 does not wait for F-09 code).

## 1. Behavior

An operator picks one of their queues and a day, and sees how that day went: how many entries were served, cancelled and marked no-show, and the average time customers waited before being called. The numbers come from the append-only status history (`EntryEvent`, FR-11), so they stay correct after entries change state again.

Workflow:

1. The operator requests the summary for an assigned queue and a date.
2. The server checks the session, the role and the queue assignment (F-03 guard).
3. The server validates the date, works out that day's window in Bangkok time, and reads the events of that queue inside the window.
4. It returns the counts and the average waiting time.

## 2. Business rules

| Rule | Definition |
|---|---|
| R-F13-1 Day window | A day is `[date 00:00:00, date+1 00:00:00)` in Asia/Bangkok time (UTC+07:00, no daylight saving). The upper bound is exclusive. |
| R-F13-2 Served | Number of `EntryEvent` rows with `toStatus = COMPLETED` whose `at` is inside the window, for entries of this queue. |
| R-F13-3 Cancelled | Same, with `toStatus = CANCELLED`. |
| R-F13-4 No-show | Same, with `toStatus = NO_SHOW`. |
| R-F13-5 Called | Number of `toStatus = CALLED` events inside the window. This is the sample size of the average. |
| R-F13-6 Average wait | For each `CALLED` event inside the window: wait = event `at` minus the entry's join time (`QueueEntry.createdAt`, written in the join transaction). Average = mean of those waits in seconds, rounded to the nearest whole second (0.5 rounds up). `null` when no entry was called that day. |
| R-F13-7 Scope | Only entries of the requested queue are counted. Events of other queues and other days are ignored. |

A status reached on a different day from the join counts on the day of the event (for example, an entry that joined at 23:50 and was called at 00:10 counts as called on the second day, with a 20-minute wait).

## 3. API specification

### GET /api/queues/:id/summary?date=YYYY-MM-DD (operator assigned to the queue)

Response 200:

```json
{ "queueId": 1, "queueName": "Registrar Desk", "date": "2026-11-24",
  "served": 12, "cancelled": 2, "noShow": 1,
  "called": 13, "averageWaitSeconds": 274 }
```

Errors (shared error shape `{ "error": { "code", "message" } }`):

| Case | Status | Code |
|---|---|---|
| No session | 401 | `UNAUTHENTICATED` |
| Logged in as customer | 403 | `FORBIDDEN_ROLE` |
| Operator not assigned to the queue, or unknown/malformed queue id | 403 | `FORBIDDEN_QUEUE` (same as F-03; existence is not revealed) |
| `date` missing, not `YYYY-MM-DD`, or not a real calendar date (for example `2026-02-30`) | 400 | `VALIDATION_ERROR`, message "Use date=YYYY-MM-DD." |

A future date or a day with no activity is valid and returns zeros with `averageWaitSeconds: null`.

The route is added to the F-03 route permission matrix (`server/src/routes/access.ts`) with guard `operatorOnQueueParam`, so the guard runs before the handler.

## 4. UI and data

- UI: **no change in this increment.** A summary panel on the operator console is remaining Sprint 3 work (planned, see the Deliverable 2 remaining-work table).
- Data: **no schema change.** Read-only queries on `EntryEvent` joined to `QueueEntry` (filtered by `queueId`, `toStatus`, `at`). No migration.
- Performance: one query per request with the day window in the `WHERE`. The NFR-10 timing check is part of the hardening contract (#68).

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F13-01 | For an assigned queue and a day, the response gives the number of entries completed, cancelled and marked no-show by events inside that day (R-F13-2..4). |
| AC-F13-02 | The average waiting time is the mean of (called time minus join time) over entries called that day, in whole seconds, with `called` equal to the number of those entries (R-F13-5, R-F13-6). |
| AC-F13-03 | The day uses Bangkok time with an exclusive upper bound: an event at 23:59:59 +07:00 counts on that day; an event at 00:00:00 +07:00 the next day does not (R-F13-1). |
| AC-F13-04 | A day with no events returns all counts 0 and `averageWaitSeconds: null`. |
| AC-F13-05 | Events of other queues are not counted (R-F13-7). |
| AC-F13-06 | Without a session the request gets 401; a customer gets 403 `FORBIDDEN_ROLE`; an operator on a queue not assigned to them gets 403 `FORBIDDEN_QUEUE`. |
| AC-F13-07 | A missing, badly formatted or impossible date gets 400 `VALIDATION_ERROR` and no summary. |

## 6. Software Test Specification

API tests use Supertest against the real `queue_test` database (`server/tests/api/summary.test.ts`). Each test creates its own entries and events with fixed timestamps, so results do not depend on the clock or on F-09 code. Unit tests cover the pure day-window and averaging functions (`server/tests/unit/summary.test.ts`).

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F13-01 | AC-F13-01 | api | Queue A, day 2026-11-20: 3 `COMPLETED`, 2 `CANCELLED`, 1 `NO_SHOW` events inside the day | operator1 GET summary for A, `date=2026-11-20` | 200, `served` 3, `cancelled` 2, `noShow` 1 |
| TEST-F13-02 | AC-F13-02 | api | Queue A, 2026-11-20: entry 1 joined 09:00:00, called 09:02:00; entry 2 joined 09:00:00, called 09:05:00 (+07:00) | GET summary | `called` 2, `averageWaitSeconds` 210 |
| TEST-F13-03 | AC-F13-03 | api | `COMPLETED` events at 2026-11-20 23:59:59 +07:00 and 2026-11-21 00:00:00 +07:00 | GET for 2026-11-20 and for 2026-11-21 | 2026-11-20: `served` 1; 2026-11-21: `served` 1 |
| TEST-F13-04 | AC-F13-04 | api | No events on 2026-01-01 | GET for 2026-01-01 | All counts 0, `averageWaitSeconds` null |
| TEST-F13-05 | AC-F13-05 | api | Events on queue C (operator2) on 2026-11-20; operator1 also assigned to A | operator1 GET for A, 2026-11-20 | Counts include only queue A events |
| TEST-F13-06 | AC-F13-06 | api | Seed accounts | GET for A with no cookie; as customer1; as operator2 (not assigned to A); as operator1 for id 9999 and `abc` | 401 `UNAUTHENTICATED`; 403 `FORBIDDEN_ROLE`; 403 `FORBIDDEN_QUEUE`; 403 `FORBIDDEN_QUEUE` |
| TEST-F13-07 | AC-F13-07 | api | operator1 on A | GET with no `date`, `date=20-11-2026`, `date=2026-13-01`, `date=2026-02-30` | Each 400 `VALIDATION_ERROR` |
| TEST-F13-08 | AC-F13-02, AC-F13-03 | unit | Pure functions | `dayWindow("2026-11-20")`; `averageSeconds([120, 300])`, `averageSeconds([1, 2])`, `averageSeconds([])` | Window 2026-11-19T17:00:00Z to 2026-11-20T17:00:00Z; 210; 2 (1.5 rounds up); null |

Regression: the full server suite (F-01..F-07, Lab 5 and Lab 6 tests) still passes; the route permission matrix test (F-03) includes the new route.

## 7. Definition of Done

- Contract merged to `sprint2-staging` before the feature branch starts.
- First commit on `feature/F-13-service-summaries` adds TEST-F13-01..08 only, and their failing output is saved with the commit ID.
- All AC implemented; TEST-F13-01..08 pass; full server suite passes with counts saved.
- No schema change; no customer data in the response.
- PR into `sprint2-staging` with `Closes #66`, opened after the Sprint 2 release (`v0.2.0-sprint2`), with AC-to-test table, RED and GREEN commit IDs and a substantive review from MacOverlorD; released in candidate `v0.2.0-rc1`.
- FR-20 traceability row updated in the D2 docs PR (#69) as "API implemented and tested; UI planned".

## 8. Revisions

| Date | Change | Reason |
|---|---|---|
| 24 Nov 2026 | First version | Deliverable 2, Sprint 3 workflow implemented early |
