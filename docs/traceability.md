# Traceability Matrix

Version 0.1, 5 Nov 2026. Maps every requirement in `docs/srs.md` to a feature or responsibility, its sprint, and its acceptance criteria and tests.

- Sprint 1 AC and TEST IDs are **planned** here and finalized in each feature contract under `docs/sprints/sprint-1/`. If a contract changes an ID, update this file in the same PR.
- Later-sprint requirements have a feature and sprint now; their AC/tests are written with that sprint's contracts.
- The "Result" column is filled from real test runs. Sprint 1 results come from a clean clone of `sprint1-staging` at commit `f9a7800` (server `npm test`: 12 files, 83 passed, 0 failed, 0 skipped; Playwright `npm run test:e2e`: 10 passed). The same run is repeated and recorded at the release tag. "Not started" rows belong to Sprints 2 and 3.

## 1. Functional requirements

| Req | Feature | Sprint | AC | Planned test (level) | Result |
|---|---|---|---|---|---|
| FR-01 | F-02, F-08a | 1 | AC-F02-01, AC-F02-02, AC-F02-03, AC-F08a-01 | TEST-F02-01..03 (API), TEST-F08a-01 (E2E) | Pass |
| FR-02 | F-02, F-08a | 1 | AC-F02-05, AC-F08a-01 | TEST-F02-05 (API), TEST-F08a-01 (E2E) | Pass |
| FR-03 | F-02 | 1 | AC-F02-04 | TEST-F02-04 (API) | Pass |
| FR-04 | F-04, F-08a | 1 | AC-F04-01 | TEST-F04-01 (API) | Pass |
| FR-05 | F-04, F-08a | 1 | AC-F04-02, AC-F08a-02 | TEST-F04-02 (API+DB), TEST-F08a-02 (E2E) | Pass |
| FR-06 | F-05, F-08a | 1 | AC-F05-01, AC-F08a-03 | TEST-F05-01 (API), TEST-F08a-03 (E2E) | Pass |
| FR-07 | F-05, F-06, F-08b | 1 | AC-F05-03, AC-F06-11, AC-F08b-01 | TEST-F05-03 (API), TEST-F06-11 (API), TEST-F08b-01 (E2E) | Pass |
| FR-08 | F-06, F-08b | 1 | AC-F06-01, AC-F06-02, AC-F08b-02 | TEST-F06-01, TEST-F06-01b, TEST-F06-02 (unit+API), TEST-F08b-02 (E2E) | Pass |
| FR-09 | F-06, F-08b | 1 | AC-F06-04, AC-F08b-02 | TEST-F06-04 (API), TEST-F08b-02 (E2E) | Pass |
| FR-10 | F-06, F-08b | 1 | AC-F06-05, AC-F08b-02 | TEST-F06-05 (API+DB), TEST-F08b-02 (E2E) | Pass |
| FR-11 | F-06 | 1 | AC-F06-08 | TEST-F06-08 (API+DB) | Pass |
| FR-12 | F-07 (API), F-11 (screen) | 1, 2 | AC-F07-01 | TEST-F07-01 (API) | Pass |
| FR-13 | F-09 | 2 | Sprint 2 contract | Sprint 2 | Not started |
| FR-14 | F-09 | 2 | Sprint 2 contract | Sprint 2 | Not started |
| FR-15 | F-10 | 2 | Sprint 2 contract | Sprint 2 | Not started |
| FR-16 | F-10 | 2 | Sprint 2 contract | Sprint 2 | Not started |
| FR-17 | F-11 | 2 | Sprint 2 contract | Sprint 2 | Not started |
| FR-18 | F-12 | 3 | Sprint 3 contract | Sprint 3 | Not started |
| FR-19 | F-12 | 3 | Sprint 3 contract | Sprint 3 | Not started |
| FR-20 | F-13 | 3 | Sprint 3 contract | Sprint 3 | Not started |

## 2. Business rules

| Rule | Feature | Sprint | AC | Planned test (level) | Result |
|---|---|---|---|---|---|
| BR-01 one active entry per customer per queue | F-04, F-01 (DB index) | 1 | AC-F04-03, AC-F01-03 | TEST-F04-03 (API), TEST-F01-03 (DB) | Pass |
| BR-02 unique, increasing, never reused numbers | F-04, F-01 (DB unique) | 1 | AC-F04-02, AC-F04-06, AC-F01-04 | TEST-F04-06 (integration, 50 concurrent), TEST-F01-04 (DB) | Pass |
| BR-03 call next takes lowest waiting number | F-06 | 1 | AC-F06-01 | TEST-F06-01 (unit+API) | Pass |
| BR-04 allowed transitions only | F-06 (Sprint 1 set), F-09 (Sprint 2 set) | 1, 2 | AC-F06-06 | TEST-F06-06 (unit+API) | Pass |
| BR-05 one called/serving entry per queue | F-06, revised by F-12 | 1, 3 | AC-F06-03 | TEST-F06-03 (API) | Pass |
| BR-06 operator acts only on assigned queues | F-03, F-05, F-06 | 1 | AC-F03-03, AC-F05-04, AC-F06-10, AC-F06-11 | TEST-F03-03, TEST-F05-04, TEST-F06-10, TEST-F06-11 (API) | Pass |
| BR-07 customer sees only own entries | F-05 | 1 | AC-F05-02 | TEST-F05-02 (API) | Pass |
| BR-08 public display has no private data | F-07, F-11 | 1, 2 | AC-F07-02 | TEST-F07-02 (API) | Pass |
| BR-09 role-restricted operations | F-03, F-04, F-06 | 1 | AC-F03-02, AC-F03-04, AC-F06-09, AC-F06-11 | TEST-F03-02, TEST-F03-04, TEST-F06-09, TEST-F06-11 (API) | Pass |
| BR-10 closed queue rejects joins | F-04, F-10 | 1, 2 | AC-F04-05 | TEST-F04-05 (API) | Pass |
| BR-11 final statuses are final; rejoin allowed after | F-06, F-04 | 1 | AC-F06-07, AC-F04-04 | TEST-F06-07, TEST-F04-04 (API) | Pass |
| BR-12 cancel by owner while waiting | F-09 | 2 | Sprint 2 contract | Sprint 2 | Not started |
| BR-13 no-show only on called, assigned operator | F-09 | 2 | Sprint 2 contract | Sprint 2 | Not started |
| BR-14 priority policy | F-12 | 3 | Sprint 3 contract | Sprint 3 | Not started |

## 3. Non-functional requirements

| NFR | Feature / responsibility | Sprint | AC | Planned verification | Result |
|---|---|---|---|---|---|
| NFR-01 unauthenticated 401, no private data | F-03 | 1 | AC-F03-01 | TEST-F03-01 (API, every protected route) | Pass |
| NFR-02 bcrypt hashes, never returned | F-01, F-02 | 1 | AC-F01-06, AC-F02-01 | TEST-F01-06 (DB), TEST-F02-01 (API) | Pass |
| NFR-03 50 concurrent joins, distinct numbers | F-04 | 1 | AC-F04-06 | TEST-F04-06 (integration) | Pass |
| NFR-04 DB rejects duplicate active entry | F-01 | 1 | AC-F01-03 | TEST-F01-03 (DB) | Pass |
| NFR-05 8 h expiry, logout invalidates | F-02 | 1 | AC-F02-05, AC-F02-06 | TEST-F02-05, TEST-F02-06 (API) | Pass |
| NFR-06 data survives restart / redeploy | F-01, R-DEP | 1, 2 | AC-F01-05 | TEST-F01-05 (integration); Lab 5 check | Pass for restart (TEST-F01-05); redeploy check in Lab 5 |
| NFR-07 no secrets, env documented | F-01, R-SEC | 1 | AC-F01-07 | PR checklist + secret scan before release (manual, recorded) | Pass: TEST-F01-07 and the recorded secret scan (clean) |
| NFR-08 loading/empty/error states, 10 s refresh | F-08a, F-08b | 1 | AC-F08a-04, AC-F08a-05, AC-F08b-03 | TEST-F08a-04 (E2E), manual check recorded | Partial: E2E pass; the manual loading-state check is not yet recorded |
| NFR-09 Docker and GCP | R-DEP | 2 (Lab 5) | Lab 5 | Pipeline run evidence | Not started |
| NFR-10 p95 under 500 ms with 200 entries | F-13, R-QA | 3 | Sprint 3 contract | Timing script | Not started |
| NFR-11 80% coverage of server domain modules | R-QA | 3 | Sprint 3 | CI coverage report | Not started |

### Additional tests (from the F-02, F-04, F-06, F-08b contracts)

| Test | Supports | Level |
|---|---|---|
| TEST-F02-06b | NFR-05, FR-02 | api |
| TEST-F02-03c | FR-01, NFR-01 (unknown email costs one bcrypt compare) | api |
| TEST-F02-04b | FR-03, NFR-01 (malformed sid cookie gives 401) | api |
| TEST-F04-03b | BR-01 | api |
| TEST-F04-06b | BR-01, BR-02 (10 concurrent joins by one customer) | integration |
| TEST-F04-03c | BR-01, BR-02 (number collision is a 500, not a false duplicate) | api |
| TEST-F06-01b | BR-03, FR-08 | api |
| TEST-F06-03b | BR-05 (concurrent call-next) | integration |
| TEST-F06-06b | BR-04 | api |
| TEST-F08b-03b | NFR-08 (manual check, labeled manual) | manual |
| TEST-F08b-01b | NFR-08, FR-07 (no sideways scrolling at 390 px) | e2e |
| TEST-F08b-03c | NFR-08 (rejected action message stays visible next to Call next) | e2e |

## 4. Coverage check

| Group | Total | Mapped to feature and sprint | Sprint 1 with planned AC/test | Gaps |
|---|---|---|---|---|
| FR | 20 | 20 | 12 (FR-01..FR-12) | none |
| BR | 14 | 14 | 11 (BR-01..BR-11) | none |
| NFR | 11 | 11 | 8 (NFR-01..NFR-08) | none |

Every Sprint 1 feature (F-01..F-08b) traces back to at least one requirement. No requirement is currently unallocated.

## 5. Approved changes

| Date | Change | Reason | Approved by |
|---|---|---|---|
| 5 Nov 2026 | Baseline created | Deliverable 1 | Reviewed and merged in PR #15 |
| 5 Nov 2026 | Sprint 1 results recorded | Tests executed on the clean clone | This PR |
