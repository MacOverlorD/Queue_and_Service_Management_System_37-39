# Sprint 1 Engineering Contracts

Contracts are written and committed **before** the code they describe. Each contract has: feature design, UI/API/data specification, acceptance criteria (AC), Software Test Specification (STS) and Definition of Done (DoD). Changes after the first commit are recorded in the contract's revision table.

| Feature | Contract | Author | Reviewer | Issue |
|---|---|---|---|---|
| F-01 | [f-01-scaffold-schema-seed.md](f-01-scaffold-schema-seed.md) | TauForge | MacOverlorD | #3 |
| F-02 | f-02-authentication.md (Mac's docs PR) | MacOverlorD | TauForge | #4 |
| F-03 | [f-03-authorization.md](f-03-authorization.md) | TauForge | MacOverlorD | #5 |
| F-04 | f-04-join-queue.md (Mac's docs PR) | MacOverlorD | TauForge | #6 |
| F-05 | [f-05-view-entries.md](f-05-view-entries.md) | TauForge | MacOverlorD | #7 |
| F-06 | f-06-serve-workflow.md (Mac's docs PR) | MacOverlorD | TauForge | #8 |
| F-07 | [f-07-public-display-api.md](f-07-public-display-api.md) | TauForge | MacOverlorD | #9 |
| F-08a | [f-08a-customer-ui.md](f-08a-customer-ui.md) | TauForge | MacOverlorD | #10 |
| F-08b | f-08b-operator-ui.md (Mac's docs PR) | MacOverlorD | TauForge | #11 |

## Shared conventions (all contracts)

- **Error shape:** every error response is `{ "error": { "code": "<UPPER_SNAKE>", "message": "<safe text>" } }`. Messages never contain private data, stack traces or SQL.
- **Login errors:** wrong email or password returns 401 `INVALID_CREDENTIALS`; a missing or expired session returns 401 `UNAUTHENTICATED`.
- **Status codes:** 400 validation, 401 not authenticated, 403 authenticated but not allowed, 404 not found or not visible to the caller, 409 conflict with current state (duplicate, invalid transition).
- **Auth:** httpOnly cookie `sid` carrying a session id (F-02). All routes are protected unless the contract says public.
- **IDs:** database ids are integers; ticket `number` is an integer per queue.
- **Counter field:** `Queue.lastNumber` (last number handed out). A join runs `UPDATE "Queue" SET "lastNumber" = "lastNumber" + 1 WHERE id = $1 RETURNING "lastNumber"` and the returned value is the new ticket number (Q-02 closed: confirmed in the F-04 contract).
- **Test levels:** `unit`, `api` (Supertest against the app with a real PostgreSQL test database), `db` (direct SQL), `integration` (multi-request or concurrency), `e2e` (Playwright).
- **Test database:** a separate `queue_test` database, reset and seeded before the suite.

## Product Definition of Done (Sprint 1)

1. Required behavior is implemented for every Sprint 1 AC.
2. The planned test for each AC has been executed and passes at the release commit. Results are recorded in `docs/traceability.md`.
3. Each feature went through a reviewed PR into `sprint1-staging` with failing and passing test output in the PR.
4. Integration and system tests pass on `sprint1-staging`, and the release PR to `main` is reviewed and tagged.
5. README setup works from a clean clone; `.env.example` lists every variable.
6. No real secrets in Git. Incomplete work and skipped/failing tests are disclosed.
