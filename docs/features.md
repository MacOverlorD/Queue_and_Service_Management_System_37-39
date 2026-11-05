# Feature Inventory

Version 0.1, 5 Nov 2026. Requirement IDs refer to `docs/srs.md`. Requirement-to-test mapping is in `docs/traceability.md`.

## ID conventions

- Features: `F-NN` (UI features split as `F-08a`, `F-08b`).
- Acceptance criteria: `AC-<feature>-NN`, for example `AC-F04-03`.
- Tests: `TEST-<feature>-NN`, matching the AC they verify, for example `TEST-F04-03` verifies `AC-F04-03`. Extra tests for one AC add a letter: `TEST-F04-03b`.
- Cross-cutting responsibilities that are not a single feature: `R-NAME`.

## Sprint 1 features

| ID | Feature | Description | Requirements | Depends on | Author / Reviewer | Issue |
|---|---|---|---|---|---|---|
| F-01 | Scaffold, schema and seed | Client and server projects, Prisma schema, first migration with raw-SQL partial unique index, reproducible seed with entries in every state, health endpoint, README setup. | BR-01 (DB), BR-02 (DB), NFR-02, NFR-04, NFR-06, NFR-07 | none | TauForge / MacOverlorD | #3 |
| F-02 | Authentication | Login, logout, current user. bcrypt hashes, DB session, httpOnly cookie, 8 h expiry. | FR-01, FR-02, FR-03, NFR-02, NFR-05 | F-01 | MacOverlorD / TauForge | #4 |
| F-03 | Authorization middleware | Require session, require role, require operator assignment to the queue. Uniform 401/403 error shape. | NFR-01, BR-06, BR-09 | F-02 | TauForge / MacOverlorD | #5 |
| F-04 | Join queue | List queues, join an open queue with an atomic ticket number, reject duplicates, closed queues and non-customers. | FR-04, FR-05, BR-01, BR-02, BR-09, BR-10, BR-11, NFR-03 | F-03 | MacOverlorD / TauForge | #6 |
| F-05 | View entries | Customer sees own entries with status and people ahead. Operator sees active entries of an assigned queue in order. | FR-06, FR-07, BR-06, BR-07 | F-03 | TauForge / MacOverlorD | #7 |
| F-06 | Serve workflow | Call next, start serving, complete. Allowed transitions only, head of line, single counter, history events. | FR-08, FR-09, FR-10, FR-11, BR-03, BR-04, BR-05, BR-06, BR-11 | F-03 | MacOverlorD / TauForge | #8 |
| F-07 | Public display API | Anonymous endpoint with queue name, current number, waiting count. No private fields. | FR-12 (API), BR-08 | F-01 | TauForge / MacOverlorD | #9 |
| F-08a | Customer UI | Login/logout, queue list, join, my ticket with polling status, error and empty states. | FR-01..FR-06 (UI), NFR-08 | F-02, F-04, F-05 | TauForge / MacOverlorD | #10 |
| F-08b | Operator UI | Operator console for an assigned queue: waiting list, call next, start, complete, API errors shown. | FR-07..FR-10 (UI), NFR-08 | F-05, F-06 | MacOverlorD / TauForge | #11 |

## Later features (allocated, contracts written in their sprint)

| ID | Feature | Description | Requirements | Depends on | Sprint |
|---|---|---|---|---|---|
| F-09 | Cancel and no-show | Customer cancels own waiting entry; operator marks a called entry as no-show. | FR-13, FR-14, BR-04 (Sprint 2 transitions), BR-12, BR-13 | F-06 | 2 |
| F-10 | Queue control and multi-queue console | Operator opens/closes assigned queues; one console for all assigned queues. | FR-15, FR-16, BR-10 | F-06, F-08b | 2 |
| F-11 | Public display screen | Auto-refreshing display page built on the F-07 API. | FR-17, BR-08 | F-07 | 2 |
| F-12 | Counters and priority | Several counters per queue (replaces single-counter BR-05) and the agreed priority policy. | FR-18, FR-19, BR-05 (revised), BR-14 | F-06, F-10 | 3 |
| F-13 | Service summaries | Per-queue daily counts and average waiting time. | FR-20, NFR-10 | F-09 | 3 |

## Cross-cutting responsibilities

| ID | Responsibility | Requirements | Sprint |
|---|---|---|---|
| R-SEC | Secret handling and configuration review on every PR and before release | NFR-07 | 1 onward |
| R-DEP | Docker images, CI/CD and GCP deployment with managed PostgreSQL (Lab 5) | NFR-06 (redeploy part), NFR-09 | 2 |
| R-QA | Coverage measurement and regression suite in CI | NFR-11 | 3 |

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 5 Nov 2026 | First inventory for Deliverable 1 |
