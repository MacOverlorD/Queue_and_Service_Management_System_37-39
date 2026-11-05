# F-01 Scaffold, Schema and Seed

Issue #3. Author TauForge, reviewer MacOverlorD. Requirements: BR-01 (DB), BR-02 (DB), NFR-02, NFR-04, NFR-06, NFR-07. Depends on: none.

## 1. Behavior

A developer clones the repo, follows the README, and gets a running client, API and PostgreSQL database with demo data. The database enforces the integrity rules even if the application is bypassed.

## 2. Structure

```
client/   React + TypeScript + Vite
server/   Express + TypeScript, Prisma (prisma/schema.prisma, prisma/migrations, prisma/seed.ts)
docker-compose.yml   PostgreSQL only (development)
```

Root scripts: `install:all`, `dev:server`, `dev:client`, `test`, `build:client`, `build:server`.

## 3. Data specification

| Model | Fields | Constraints |
|---|---|---|
| User | id, name, email, passwordHash, role (`CUSTOMER`/`OPERATOR`) | email unique |
| Session | id (random string), userId, expiresAt | FK User, delete cascade |
| Queue | id, name, serviceName, lastNumber (default 0), isOpen (default true) | name unique |
| OperatorQueue | userId, queueId | composite primary key, both FK |
| QueueEntry | id, queueId, customerId, number, status (`WAITING`/`CALLED`/`SERVING`/`COMPLETED`/`CANCELLED`/`NO_SHOW`), createdAt, calledAt, servingAt, completedAt, handledByOperatorId (nullable) | `@@unique([queueId, number])`; FK Queue, User |
| EntryEvent | id, entryId, fromStatus (nullable), toStatus, actorId, at | FK QueueEntry, User |

Raw SQL in the first migration (Prisma cannot express it):

```sql
CREATE UNIQUE INDEX "QueueEntry_one_active_per_customer_queue"
ON "QueueEntry" ("queueId", "customerId")
WHERE "status" IN ('WAITING','CALLED','SERVING');
```

Every later `prisma migrate dev` output must be inspected for an accidental `DROP INDEX` of this index (D-13).

## 4. Seed (rerunnable, no duplicates)

- Operators: `operator1@example.test` (queues A and B), `operator2@example.test` (queue C).
- Customers: `customer1..4@example.test`.
- Queues: `Registrar Desk` (A), `Finance Desk` (B), `Student Affairs` (C, closed).
- Passwords: development-only values read from the seed script, stored as bcrypt hashes (cost 10 or more). Real values never in Git history beyond the dev-only demo password documented in the README.
- Entries (BR-05 holds in every queue: at most one `CALLED` or `SERVING`):
  - Queue A: `WAITING` x2, `SERVING` x1, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
  - Queue B: no active entries (used by state-changing tests in F-06).
  - Queue C (closed): one `CALLED` entry (closed queues can still be served, BR-10).
  - Numbers are consistent per queue, `lastNumber` equals the highest issued number, and matching `EntryEvent` rows exist.
- `GET /api/health` returns `200 { "status": "ok", "db": "up" }`.

## 5. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F01-01 | From a clean clone, the README commands install, migrate, seed, and start server and client without manual database edits. |
| AC-F01-02 | The seed can run twice and produces the same data without duplicates or errors. Every status exists across the seed, and no queue has more than one `CALLED` or `SERVING` entry. |
| AC-F01-03 | Inserting a second active entry for the same customer and queue directly in SQL fails with a unique violation. A final-status entry does not block a new active one. |
| AC-F01-04 | Inserting two entries with the same `(queueId, number)` directly in SQL fails with a unique violation. |
| AC-F01-05 | After the API process restarts, seeded and newly created data is still present. |
| AC-F01-06 | Every seeded user has a bcrypt hash (starts with `$2`) and no plaintext password is stored. |
| AC-F01-07 | `.env.example` lists every variable the app reads; `.env` files are git-ignored; no secret file is tracked. |

## 6. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F01-01 | AC-F01-01 | integration | Empty test DB | Run migrate then seed then GET /api/health | Health 200 `{status:"ok"}`; seed counts match |
| TEST-F01-02 | AC-F01-02 | integration | Seeded DB | Run seed a second time | No error; row counts unchanged; all six statuses exist across the seed; no queue has more than one CALLED/SERVING entry; queue B has no active entries |
| TEST-F01-03 | AC-F01-03 | db | Customer 1 has WAITING entry in queue A | INSERT another WAITING for same customer and queue; then mark first COMPLETED and INSERT again | First insert rejected (unique violation); second insert succeeds |
| TEST-F01-04 | AC-F01-04 | db | Entry number 1 exists in queue A | INSERT entry number 1 in queue A | Rejected (unique violation); same number in queue B succeeds |
| TEST-F01-05 | AC-F01-05 | integration | Entry created through the DB client | Close the app, start a new app instance, query | Entry still present |
| TEST-F01-06 | AC-F01-06 | db | Seeded users | Select passwordHash for all users | Each matches `^\$2[aby]\$`; none equals the documented dev password |
| TEST-F01-07 | AC-F01-07 | unit (script) | Repo checkout | Compare env variables read in code with `.env.example`; `git ls-files` for `.env` | Every variable listed; no `.env` tracked |

## 7. Definition of Done

All AC implemented; TEST-F01-01..07 executed and passing with output in the PR; migration reviewed for the raw SQL index; README setup verified on a clean clone by the reviewer; seed rerun verified.

## 8. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version | Deliverable 1 |
