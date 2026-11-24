# Traceability Matrix

Version 0.2, 25 Nov 2026 (Deliverable 2 baseline). Maps every requirement in `docs/srs.md` (version 0.3) to its feature or responsibility, sprint, acceptance criteria (AC), planned test, the actual test file, the result and the version it was run on.

How to read it:

- **Test IDs** come from the Software Test Specification of each contract under `docs/sprints/`. **Actual test file(s)** is every test file under `server/tests/` or `e2e/tests/` whose source names that test ID, so a row is not marked as passing unless a real test with that ID exists.
- **Result** values: `Pass` (the test ran and passed), `Planned` (contract written, no code and no test run), `Partial` (part of it is not verified), `Pass (measurement)` (verified by a recorded measurement, not by a test file).
- **Version** is the tag the tests were run on: v0.2.0-rc1 (`354f72d`), Cloud Run revision `qms-00009-h99`. A `-` means nothing has run.
- Nothing is marked `Pass` for a test that has not been executed, and no unrelated test is used as coverage.

## 1. Runs behind the results

| Date | Version | Command | Result |
|---|---|---|---|
| 5 Nov 2026 | `sprint1-staging` `f9a7800` (Deliverable 1) | server `npm test`; Playwright `npm run test:e2e` | 83 passed, 0 failed, 0 skipped; 10 passed |
| 24 Nov 2026 | `sprint2-staging` `6284114` (Sprint 2 release content) | server `npm test`; Playwright; client build | 111 passed (18 files), 0 failed, 0 skipped; 21 passed; build OK. Evidence `S2-STAGING-*` |
| 24 Nov 2026 | **`v0.2.0-rc1` `354f72d`** (release candidate) | server `npm test`; Playwright; `npm run build:client` | **126 passed (20 files), 0 failed, 0 skipped; 21 passed, 0 failed, 0 skipped; build OK.** Evidence `RC1/*` |
| 24 Nov 2026 | `v0.2.0-rc1` CI and deploy | CI run `45411143732` (release PR #78), Deploy demo run `45411518362` | green; revision `qms-00009-h99`; `/api/health` 200 |

The Prisma error text printed during the server run is the expected 500 of the ticket-number collision test (TEST-F04-03c), not a failure.

## 2. Functional requirements

| Req | Feature | Sprint | AC | Test IDs | Actual test file(s) | Result | Version |
|---|---|---|---|---|---|---|---|
| FR-01 | F-02, F-08a | 1 | AC-F02-01, AC-F02-02, AC-F02-03, AC-F08a-01 | TEST-F02-01, TEST-F02-02, TEST-F02-03, TEST-F08a-01 | api/auth.test.ts, e2e/customer.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-02 | F-02, F-08a | 1 | AC-F02-05, AC-F08a-01 | TEST-F02-05, TEST-F08a-01 | api/auth.test.ts, e2e/customer.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-03 | F-02 | 1 | AC-F02-04 | TEST-F02-04 | api/auth.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-04 | F-04, F-08a | 1 | AC-F04-01 | TEST-F04-01 | api/join-queue.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-05 | F-04, F-08a | 1 | AC-F04-02, AC-F08a-02 | TEST-F04-02, TEST-F08a-02 | api/join-queue.test.ts, e2e/customer.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-06 | F-05, F-08a | 1 | AC-F05-01, AC-F08a-03 | TEST-F05-01, TEST-F08a-03 | api/viewEntries.test.ts, e2e/customer.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-07 | F-05, F-06, F-08b | 1 | AC-F05-03, AC-F06-11, AC-F08b-01 | TEST-F05-03, TEST-F06-11, TEST-F08b-01 | api/viewEntries.test.ts, api/serve.test.ts, e2e/operator.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-08 | F-06, F-08b | 1 | AC-F06-01, AC-F06-02, AC-F08b-02 | TEST-F06-01, TEST-F06-01b, TEST-F06-02, TEST-F08b-02 | api/serve.test.ts, unit/serve.test.ts, e2e/operator.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-09 | F-06, F-08b | 1 | AC-F06-04, AC-F08b-02 | TEST-F06-04, TEST-F08b-02 | api/serve.test.ts, e2e/operator.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-10 | F-06, F-08b | 1 | AC-F06-05, AC-F08b-02 | TEST-F06-05, TEST-F08b-02 | api/serve.test.ts, e2e/operator.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-11 | F-06 | 1 | AC-F06-08 | TEST-F06-08 | api/serve.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-12 | F-07 (API), F-11 (screen) | 1, 2 | AC-F07-01, AC-F07-02, AC-F07-03, AC-F11-01..AC-F11-06 | TEST-F11-01, TEST-F11-02, TEST-F11-03, TEST-F11-04, TEST-F11-05, TEST-F11-06, TEST-F07-01, TEST-F07-02, TEST-F07-03 | e2e/display.spec.ts, api/publicDisplay.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-13 | F-09 | 2 | AC-F09-01..AC-F09-04, AC-F09-09, AC-F09-10, AC-F09-11 | TEST-F09-02, TEST-F09-03, TEST-F09-04, TEST-F09-05, TEST-F09-10, TEST-F09-11, TEST-F09-12 | api/cancelNoShow.test.ts, e2e/cancel-no-show.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-14 | F-09 | 2 | AC-F09-05..AC-F09-08, AC-F09-11 | TEST-F09-06, TEST-F09-07, TEST-F09-08, TEST-F09-09, TEST-F09-13 | api/cancelNoShow.test.ts, e2e/cancel-no-show.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-15 | F-10 | 2 | AC-F10-01..AC-F10-06, AC-F10-08 | TEST-F10-01, TEST-F10-02, TEST-F10-03, TEST-F10-04, TEST-F10-05, TEST-F10-06, TEST-F10-08 | api/queueControl.test.ts, e2e/queue-control.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-16 | F-10 | 2 | AC-F10-07, AC-F10-09 | TEST-F10-07, TEST-F10-09 | e2e/queue-control.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-17 | F-11 | 2 | AC-F11-01..AC-F11-06 | TEST-F11-01, TEST-F11-02, TEST-F11-03, TEST-F11-04, TEST-F11-05, TEST-F11-06 | e2e/display.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| FR-18 | F-12 | 3 | AC-F12-01..AC-F12-06, AC-F12-11, AC-F12-12 | TEST-F12-01, TEST-F12-02, TEST-F12-03, TEST-F12-04, TEST-F12-05, TEST-F12-06, TEST-F12-11, TEST-F12-12 | none yet | Planned | - |
| FR-19 | F-12 | 3 | AC-F12-07..AC-F12-10, AC-F12-12 | TEST-F12-07, TEST-F12-08, TEST-F12-09, TEST-F12-10, TEST-F12-12 | none yet | Planned | - |
| FR-20 | F-13 | 3 | AC-F13-01..AC-F13-07 | TEST-F13-01, TEST-F13-02, TEST-F13-03, TEST-F13-04, TEST-F13-05, TEST-F13-06, TEST-F13-07, TEST-F13-08 | api/summary.test.ts, unit/summary.test.ts | Pass (API; summary screen planned) | v0.2.0-rc1 (`354f72d`) |

## 3. Business rules

| Req | Feature | Sprint | AC | Test IDs | Actual test file(s) | Result | Version |
|---|---|---|---|---|---|---|---|
| BR-01 one active entry per customer per queue | F-04, F-01 (DB index) | 1 | AC-F04-03, AC-F01-03 | TEST-F04-03, TEST-F01-03 | api/join-queue.test.ts, db/constraints.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-02 unique, increasing, never reused numbers | F-04, F-01 (DB unique) | 1 | AC-F04-02, AC-F04-06, AC-F01-04 | TEST-F04-06, TEST-F01-04 | api/join-queue.test.ts, db/constraints.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-03 call next takes lowest waiting number | F-06 | 1 | AC-F06-01 | TEST-F06-01 | api/serve.test.ts, unit/serve.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-04 allowed transitions only | F-09 (Sprint 2 set) | 1, 2 | AC-F06-06, AC-F09-02, AC-F09-06 | TEST-F06-06, TEST-F09-01, TEST-F09-03, TEST-F09-07 | api/serve.test.ts, unit/serve.test.ts, unit/cancelNoShow.test.ts, api/cancelNoShow.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-05 one called/serving entry per queue | F-06, F-09 (no-show frees counter), revised by F-12 | 1, 3 | AC-F06-03, AC-F09-05, AC-F12-01..AC-F12-04 | TEST-F12-01, TEST-F12-02, TEST-F12-03, TEST-F12-04, TEST-F06-03, TEST-F06-03b, TEST-F09-06 | api/serve.test.ts, api/cancelNoShow.test.ts | Pass for the per-queue rule (TEST-F06-03, TEST-F09-06); per-counter revision planned (F-12) | v0.2.0-rc1 (`354f72d`) |
| BR-06 operator acts only on assigned queues | F-03, F-05, F-06, F-10, F-13 | 1, 2, 3 | AC-F03-03, AC-F05-04, AC-F06-10, AC-F06-11, AC-F09-07, AC-F10-04, AC-F13-06 | TEST-F03-03, TEST-F05-04, TEST-F06-10, TEST-F06-11, TEST-F09-08, TEST-F10-04, TEST-F13-06 | api/authorization.test.ts, api/viewEntries.test.ts, api/serve.test.ts, api/cancelNoShow.test.ts, api/queueControl.test.ts, api/summary.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-07 customer sees only own entries | F-05, F-09 | 1, 2 | AC-F05-02, AC-F09-03 | TEST-F05-02, TEST-F09-04 | api/viewEntries.test.ts, api/cancelNoShow.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-08 public display has no private data | F-07, F-11 | 1, 2 | AC-F07-02, AC-F11-03 | TEST-F07-02, TEST-F11-03 | api/publicDisplay.test.ts, e2e/display.spec.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-09 role-restricted operations | F-03, F-04, F-06, F-09, F-10 | 1, 2 | AC-F03-02, AC-F03-04, AC-F06-09, AC-F06-11, AC-F09-04, AC-F09-07, AC-F10-04 | TEST-F03-02, TEST-F03-04, TEST-F06-09, TEST-F06-11, TEST-F09-05, TEST-F09-08, TEST-F10-04 | api/authorization.test.ts, api/serve.test.ts, api/cancelNoShow.test.ts, api/queueControl.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-10 closed queue rejects joins | F-04, F-10 | 1, 2 | AC-F04-05, AC-F10-01, AC-F10-02, AC-F10-03 | TEST-F04-05, TEST-F10-01, TEST-F10-02, TEST-F10-03 | api/join-queue.test.ts, api/queueControl.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-11 final statuses are final; rejoin allowed after | F-06, F-04, F-09 | 1, 2 | AC-F06-07, AC-F04-04, AC-F09-09 | TEST-F06-07, TEST-F04-04, TEST-F09-10 | api/serve.test.ts, api/join-queue.test.ts, api/cancelNoShow.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-12 cancel by owner while waiting | F-09 | 2 | AC-F09-02, AC-F09-03, AC-F09-04 | TEST-F09-03, TEST-F09-04, TEST-F09-05 | api/cancelNoShow.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-13 no-show only on called, assigned operator | F-09 | 2 | AC-F09-05..AC-F09-07 | TEST-F09-06, TEST-F09-07, TEST-F09-08 | api/cancelNoShow.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| BR-14 priority policy | F-12 | 3 | AC-F12-07..AC-F12-10 | TEST-F12-07, TEST-F12-08, TEST-F12-09, TEST-F12-10 | none yet | Planned | - |

## 4. Non-functional requirements

| Req | Feature | Sprint | AC | Test IDs | Actual test file(s) | Result | Version |
|---|---|---|---|---|---|---|---|
| NFR-01 unauthenticated 401, no private data | F-03 | 1 | AC-F03-01 | TEST-F03-01, TEST-L6-58 | api/authorization.test.ts, api/apiNotFound.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| NFR-02 bcrypt hashes, never returned | F-01, F-02 | 1 | AC-F01-06, AC-F02-01 | TEST-F01-06, TEST-F02-01 | db/constraints.test.ts, api/auth.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| NFR-03 50 concurrent joins, distinct numbers | F-04 | 1 | AC-F04-06 | TEST-F04-06 | api/join-queue.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| NFR-04 DB rejects duplicate active entry | F-01 | 1 | AC-F01-03 | TEST-F01-03 | db/constraints.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| NFR-05 8 h expiry, logout invalidates | F-02 | 1 | AC-F02-05, AC-F02-06 | TEST-F02-05, TEST-F02-06 | api/auth.test.ts, unit/session.test.ts | Pass | v0.2.0-rc1 (`354f72d`) |
| NFR-06 data survives restart / redeploy | F-01, R-DEP | 1, 2 | AC-F01-05 | TEST-F01-05 | integration/seed-and-health.test.ts | Pass: restart test (TEST-F01-05); redeploy shown by the same seed state on revisions qms-00007-zqx, qms-00008-mg9 and qms-00009-h99 (measurement) | v0.2.0-rc1 (`354f72d`) |
| NFR-07 no secrets, env documented | F-01, R-SEC | 1 | AC-F01-07 | TEST-F01-07, TEST-L5-01 | integration/env-config.test.ts, integration/seed-production.test.ts | Pass: TEST-F01-07, TEST-L5-01; secret scan repeated on v0.2.0-rc1 (`354f72d`), clean (saved as RC1/secret-scan.txt; the Deliverable 1 scan was at `f9a7800`) | v0.2.0-rc1 (`354f72d`) |
| NFR-08 loading/empty/error states, 10 s refresh | F-08a, F-08b | 1 | AC-F08a-04, AC-F08a-05, AC-F08b-03 | TEST-F08a-04 | e2e/customer.spec.ts | Partial: E2E pass (TEST-F08a-04, TEST-F11-02, TEST-F11-06); the manual loading-state check (TEST-F08b-03b, gap G-05) is not recorded | v0.2.0-rc1 (`354f72d`) |
| NFR-09 Docker and GCP | R-DEP (Lab 5) | 2 (Lab 5) | Lab 5 | TEST-L5-01, TEST-L5-02 (integration, API); pipeline evidence | integration/seed-production.test.ts, api/static.test.ts; CI run `45408387203` (release PR #76), Deploy demo runs `45408860350` (`e82aaab`) and `45411518362` (`354f72d`) | Pass (measurement: image built, migrated, deployed, `/api/health` 200) | v0.2.0-rc1 (`354f72d`) |
| NFR-10 p95 under 500 ms with 200 entries | F-13, hardening H-06 | 3 | AC-H06-01, AC-H06-02 | TEST-H06-01, TEST-H06-02 | none yet | Planned: not measured | - |
| NFR-11 80% coverage of server domain modules | R-QA, hardening H-05 | 3 | AC-H05-01 | TEST-H05-01 | none yet | Planned: coverage not measured | - |

## 5. Acceptance criteria status (111 AC in 15 contracts)

Built from the STS table of every contract. **Implemented** means the code is on `main` at the tag. **Test run** means every listed test executed. A criterion is `Pass` only when all its tests passed.

| AC | Feature | Implemented | Verification | Test run | Result | Version |
|---|---|---|---|---|---|---|
| AC-F01-01 | F-01 | Yes | TEST-F01-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F01-02 | F-01 | Yes | TEST-F01-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F01-03 | F-01 | Yes | TEST-F01-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F01-04 | F-01 | Yes | TEST-F01-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F01-05 | F-01 | Yes | TEST-F01-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F01-06 | F-01 | Yes | TEST-F01-06 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F01-07 | F-01 | Yes | TEST-F01-07 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F02-01 | F-02 | Yes | TEST-F02-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F02-02 | F-02 | Yes | TEST-F02-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F02-03 | F-02 | Yes | TEST-F02-03, TEST-F02-03c | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F02-04 | F-02 | Yes | TEST-F02-04, TEST-F02-04b | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F02-05 | F-02 | Yes | TEST-F02-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F02-06 | F-02 | Yes | TEST-F02-06, TEST-F02-06b | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F03-01 | F-03 | Yes | TEST-F03-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F03-02 | F-03 | Yes | TEST-F03-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F03-03 | F-03 | Yes | TEST-F03-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F03-04 | F-03 | Yes | TEST-F03-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F03-05 | F-03 | Yes | TEST-F03-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F04-01 | F-04 | Yes | TEST-F04-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F04-02 | F-04 | Yes | TEST-F04-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F04-03 | F-04 | Yes | TEST-F04-03, TEST-F04-03b, TEST-F04-06b, TEST-F04-03c | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F04-04 | F-04 | Yes | TEST-F04-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F04-05 | F-04 | Yes | TEST-F04-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F04-06 | F-04 | Yes | TEST-F04-06 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F05-01 | F-05 | Yes | TEST-F05-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F05-02 | F-05 | Yes | TEST-F05-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F05-03 | F-05 | Yes | TEST-F05-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F05-04 | F-05 | Yes | TEST-F05-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F05-05 | F-05 | Yes | TEST-F05-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-01 | F-06 | Yes | TEST-F06-01, TEST-F06-01b | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-02 | F-06 | Yes | TEST-F06-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-03 | F-06 | Yes | TEST-F06-03, TEST-F06-03b | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-04 | F-06 | Yes | TEST-F06-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-05 | F-06 | Yes | TEST-F06-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-06 | F-06 | Yes | TEST-F06-06, TEST-F06-06b | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-07 | F-06 | Yes | TEST-F06-07 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-08 | F-06 | Yes | TEST-F06-08 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-09 | F-06 | Yes | TEST-F06-09 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-10 | F-06 | Yes | TEST-F06-10 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F06-11 | F-06 | Yes | TEST-F06-11 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F07-01 | F-07 | Yes | TEST-F07-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F07-02 | F-07 | Yes | TEST-F07-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F07-03 | F-07 | Yes | TEST-F07-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08a-01 | F-08a | Yes | TEST-F08a-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08a-02 | F-08a | Yes | TEST-F08a-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08a-03 | F-08a | Yes | TEST-F08a-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08a-04 | F-08a | Yes | TEST-F08a-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08a-05 | F-08a | Yes | TEST-F08a-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08b-01 | F-08b | Yes | TEST-F08b-01, TEST-F08b-01b | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08b-02 | F-08b | Yes | TEST-F08b-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F08b-03 | F-08b | Yes | TEST-F08b-03, TEST-F08b-03b, TEST-F08b-03c | Partly (manual part not recorded) | Pass for the executed tests | v0.2.0-rc1 (`354f72d`) |
| AC-F09-01 | F-09 | Yes | TEST-F09-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-02 | F-09 | Yes | TEST-F09-01, TEST-F09-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-03 | F-09 | Yes | TEST-F09-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-04 | F-09 | Yes | TEST-F09-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-05 | F-09 | Yes | TEST-F09-06 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-06 | F-09 | Yes | TEST-F09-01, TEST-F09-07 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-07 | F-09 | Yes | TEST-F09-08 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-08 | F-09 | Yes | TEST-F09-09 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-09 | F-09 | Yes | TEST-F09-10 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-10 | F-09 | Yes | TEST-F09-11 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F09-11 | F-09 | Yes | TEST-F09-12, TEST-F09-13 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-01 | F-10 | Yes | TEST-F10-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-02 | F-10 | Yes | TEST-F10-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-03 | F-10 | Yes | TEST-F10-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-04 | F-10 | Yes | TEST-F10-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-05 | F-10 | Yes | TEST-F10-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-06 | F-10 | Yes | TEST-F10-06 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-07 | F-10 | Yes | TEST-F10-07 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-08 | F-10 | Yes | TEST-F10-08 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F10-09 | F-10 | Yes | TEST-F10-09 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F11-01 | F-11 | Yes | TEST-F11-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F11-02 | F-11 | Yes | TEST-F11-02 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F11-03 | F-11 | Yes | TEST-F11-03 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F11-04 | F-11 | Yes | TEST-F11-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F11-05 | F-11 | Yes | TEST-F11-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F11-06 | F-11 | Yes | TEST-F11-06 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F12-01 | F-12 | No (planned) | TEST-F12-01 | No | Planned | - |
| AC-F12-02 | F-12 | No (planned) | TEST-F12-02 | No | Planned | - |
| AC-F12-03 | F-12 | No (planned) | TEST-F12-03 | No | Planned | - |
| AC-F12-04 | F-12 | No (planned) | TEST-F12-04 | No | Planned | - |
| AC-F12-05 | F-12 | No (planned) | TEST-F12-05 | No | Planned | - |
| AC-F12-06 | F-12 | No (planned) | TEST-F12-06 | No | Planned | - |
| AC-F12-07 | F-12 | No (planned) | TEST-F12-07 | No | Planned | - |
| AC-F12-08 | F-12 | No (planned) | TEST-F12-08 | No | Planned | - |
| AC-F12-09 | F-12 | No (planned) | TEST-F12-09 | No | Planned | - |
| AC-F12-10 | F-12 | No (planned) | TEST-F12-10 | No | Planned | - |
| AC-F12-11 | F-12 | No (planned) | TEST-F12-11 | No | Planned | - |
| AC-F12-12 | F-12 | No (planned) | TEST-F12-12 | No | Planned | - |
| AC-F13-01 | F-13 | Yes | TEST-F13-01 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F13-02 | F-13 | Yes | TEST-F13-02, TEST-F13-08 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F13-03 | F-13 | Yes | TEST-F13-03, TEST-F13-08 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F13-04 | F-13 | Yes | TEST-F13-04 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F13-05 | F-13 | Yes | TEST-F13-05 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F13-06 | F-13 | Yes | TEST-F13-06 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-F13-07 | F-13 | Yes | TEST-F13-07 | Yes | Pass | v0.2.0-rc1 (`354f72d`) |
| AC-H01-01 | H-01..H-06 | No (planned) | TEST-H01-01 | No | Planned | - |
| AC-H01-02 | H-01..H-06 | No (planned) | TEST-H01-02 | No | Planned | - |
| AC-H01-03 | H-01..H-06 | No (planned) | TEST-H01-03 | No | Planned | - |
| AC-H02-01 | H-01..H-06 | No (planned) | TEST-H02-01 | No | Planned | - |
| AC-H02-02 | H-01..H-06 | No (planned) | TEST-H02-02 | No | Planned | - |
| AC-H03-01 | H-01..H-06 | No (planned) | TEST-H03-01 | No | Planned | - |
| AC-H03-02 | H-01..H-06 | No (planned) | TEST-H03-02 | No | Planned | - |
| AC-H03-03 | H-01..H-06 | No (planned) | TEST-H03-03 | No | Planned | - |
| AC-H03-04 | H-01..H-06 | No (planned) | TEST-H03-04 | No | Planned | - |
| AC-H04-01 | H-01..H-06 | No (planned) | TEST-H04-01 | No | Planned | - |
| AC-H04-02 | H-01..H-06 | No (planned) | TEST-H04-02 | No | Planned | - |
| AC-H05-01 | H-01..H-06 | No (planned) | TEST-H05-01 | No | Planned | - |
| AC-H06-01 | H-01..H-06 | No (planned) | TEST-H06-01 | No | Planned | - |
| AC-H06-02 | H-01..H-06 | No (planned) | TEST-H06-02 | No | Planned | - |
| AC-H06-03 | H-01..H-06 | No (planned) | TEST-H06-03 | No | Planned | - |

## 6. Coverage check and gaps

| Group | Total | Delivered and passing | Partial | Planned (not implemented, not run) |
|---|---|---|---|---|
| FR | 20 | 18 (FR-01..FR-17, FR-20 as API) | 0 | 2 (FR-18, FR-19) |
| BR | 14 | 13 (BR-01..BR-13; BR-05 per queue, its per-counter revision is planned) | 0 | 1 (BR-14) |
| NFR | 11 | 8 (NFR-01..NFR-07, NFR-09) | 1 (NFR-08) | 2 (NFR-10, NFR-11) |
| AC | 111 | 83 | 1 (AC-F08b-03) | 27 (F-12: 12, hardening: 15) |

Uncovered requirements and the planned final verification:

| Item | Why not covered now | Planned final verification | Owner, target |
|---|---|---|---|
| FR-18, BR-05 per counter | F-12a not built | TEST-F12-01..06, TEST-F12-11 | MacOverlorD, 5 Dec |
| FR-19, BR-14 | F-12b not built | TEST-F12-07..10, TEST-F12-12 | MacOverlorD, 8 Dec |
| FR-20 summary screen | Only the API (F-13) is built | A summary panel on the console, with an e2e test | TauForge, 3 Dec |
| NFR-10 performance | Not measured | `perf-check.ts` locally and on the deployed service (TEST-H06-01, TEST-H06-02) | TauForge, 9 Dec |
| NFR-11 coverage | Coverage percentage never measured | Coverage gate in CI (TEST-H05-01) | TauForge, 9 Dec |
| NFR-08 loading state | Manual check not recorded (G-05) | Record TEST-F08b-03b with a screenshot | both, 9 Dec |
| Hardening: headers, CORS, rate limit, session cleanup | Contract only | TEST-H01-01..TEST-H04-02 | TauForge, 9 Dec |

Gaps found while building this matrix (disclosed, not hidden):

1. **NFR-01 on the new routes.** `TEST-F03-01` loops over a hand-written route list that was not extended in Sprint 2 and 3. Anonymous 401 on `POST /api/me/entries/:id/cancel`, `PATCH /api/queues/:id` and `GET /api/queues/:id/summary` is proved by their own tests (TEST-F09-05, TEST-F10-04, TEST-F13-06). **`POST /api/entries/:id/no-show` has no anonymous-401 test.** The guard chain is the same as `/start` and `/complete`, so the behaviour is expected, but it is not demonstrated. Fix: add the four new routes to the TEST-F03-01 list in a small test PR.
2. **Display refresh default (G-10).** The 10 s default refresh is exercised only with the 1.5 s test setting. TEST-H06-03 is planned.
3. **Manual checks.** TEST-F08b-03b is a manual check that has not been recorded.

## 7. Approved changes

| Date | Change | Reason | Approved by |
|---|---|---|---|
| 5 Nov 2026 | Baseline created | Deliverable 1 | Reviewed and merged in PR #15 |
| 5 Nov 2026 | Sprint 1 results recorded | Tests executed on the clean clone | PR #15 |
| 24 Nov 2026 | Sprint 2 and 3 plan: F-09, F-10, F-11 built now; F-13 implemented early as the Sprint 3 workflow; F-12 and hardening as contracts | Deliverable 2 scope and the 29 Nov deadline | Both students (CLAUDE.md section 4a, PR #70) |
| 24 Nov 2026 | Deliverable 2 documents (#69) owned by TauForge, reviewed by MacOverlorD (was the reverse) | Balance the workload | Both students (PR #70) |
| 24 Nov 2026 | F-11 tests are end-to-end only | The client has no unit-test runner; data rules are covered at API level by TEST-F07-01..03 | Review of PR #71 |
| 24 Nov 2026 | F-10 TEST-F10-07 changed from a mocked component test to an e2e test | No stubs rule, no client unit runner | Review of PR #70 |
| 25 Nov 2026 | BR-14 priority policy defined; Q-04 resolved by team decision (the TA was not asked) | Needed to specify F-12 | Both students (PR #79) |
| 25 Nov 2026 | `QUEUE_BUSY` replaced by `COUNTER_BUSY` when F-12a is built; TEST-F06-03/03b assertions revised | Busy is per counter, not per queue | Both students (PR #79); planned |
| 25 Nov 2026 | F-12 second counter seeded on Student Affairs, not Registrar Desk | Keep Sprint 1 and 2 tests unchanged | Review of PR #79 |
| 25 Nov 2026 | Traceability v0.2: every AC listed with status; Sprint 2 and 3 rows filled with real results | Deliverable 2 | PR #80 |
