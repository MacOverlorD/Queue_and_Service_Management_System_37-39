# Feature Inventory

Version 0.2, 25 Nov 2026 (Deliverable 2 baseline). Requirement IDs refer to `docs/srs.md`. Requirement-to-test mapping is in `docs/traceability.md`.

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

## Sprint 2 features (delivered)

Released as tag `v0.2.0-sprint2` (`e82aaab`, release PR #76) and included in the candidate `v0.2.0-rc1` (`354f72d`, release PR #78).

| ID | Feature | Description | Requirements | Depends on | Author / Reviewer | Issue | Contract PR | Code PR | Status at rc1 |
|---|---|---|---|---|---|---|---|---|---|
| F-09 | Cancel and no-show | Customer cancels own waiting entry; operator marks a called entry as no-show, which frees the counter. | FR-13, FR-14, BR-04 (Sprint 2 transitions), BR-07, BR-11, BR-12, BR-13 | F-06 | MacOverlorD / TauForge | #63 | #70 | #73 | Implemented, verified |
| F-10 | Queue control and multi-queue console | Operator opens/closes assigned queues; one console for all assigned queues; selected queue kept in the URL (fixes Lab 6 #55). | FR-15, FR-16, BR-06, BR-09, BR-10 | F-06, F-08b | MacOverlorD / TauForge | #64 | #70 | #75 | Implemented, verified |
| F-11 | Public display screen | Auto-refreshing display page `/display/:queueId` built on the F-07 API. | FR-17, BR-08, NFR-08 | F-07 | TauForge / MacOverlorD | #65 | #71 | #72 | Implemented, verified |

## Sprint 3 features

| ID | Feature | Description | Requirements | Depends on | Author / Reviewer | Issue | Contract PR | Code PR | Status at rc1 |
|---|---|---|---|---|---|---|---|---|---|
| F-13 | Service summaries | Per-queue daily counts (served, cancelled, no-show, called) and average waiting time from the status history; Bangkok-time day. API implemented early; the summary screen is planned. | FR-20 | F-09 | TauForge / MacOverlorD | #66 | #71 | #77 | API implemented, verified; UI planned |
| F-12 | Counters and priority | Several counters per queue (BR-05 per counter, closes gap G-02) and the team's priority policy. Two code PRs planned: F-12a counters, F-12b priority. | FR-18, FR-19, BR-03, BR-05 (revised), BR-14 | F-06, F-09, F-10, F-11 | MacOverlorD / TauForge | #67 | #79 | none yet | Planned (contract only) |
| H-01..H-06 | Sprint 3 hardening | Security headers (#56), production CORS (#57), login rate limit (G-03), session cleanup (G-04), 80% coverage gate, performance and refresh checks (NFR-10, G-10). | NFR-01, NFR-05, NFR-07, NFR-10, NFR-11 | F-02, F-03, Lab 5 | TauForge / MacOverlorD | #68 | #74 | none yet | Planned (contract only) |

## Cross-cutting responsibilities

| ID | Responsibility | Requirements | Sprint |
|---|---|---|---|
| R-SEC | Secret handling and configuration review on every PR and before release | NFR-07 | 1 onward |
| R-DEP | Docker images, CI/CD and GCP deployment with managed PostgreSQL (Lab 5); every merge to `main` deploys to Cloud Run (`qms`) | NFR-06 (redeploy part), NFR-09 | 2 (Lab 5), delivered |
| R-QA | Coverage measurement and regression suite in CI | NFR-11 | 3 (planned, hardening H-05) |

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 5 Nov 2026 | First inventory for Deliverable 1 |
| 0.2 | 25 Nov 2026 | Deliverable 2: Sprint 2 features delivered (F-09, F-10, F-11) with issue and PR numbers, F-13 implemented early, F-12 and hardening as planned contracts, status column |
