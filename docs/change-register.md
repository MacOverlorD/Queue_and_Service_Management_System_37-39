# Change and Defect Register

Version 0.2, 26 Nov 2026 (0.1 for Deliverable 2, Part A; 0.2 adds the Lab 7 change CR-01). One register for the findings from deployment (Lab 5), user acceptance testing (Lab 6), the Sprint 1 known gaps and the approved baseline changes, with the decision, the status and the retest at the candidate `v0.2.0-rc1` (`354f72d`, revision `qms-00009-h99`).

Status words: **Resolved** (fixed and retested), **Remaining** (not fixed, with the decision and the plan), **Accepted** (not fixed, accepted by the product team as a documented limitation).

## 1. Sprint 1 continuity on the candidate

The accepted Sprint 1 release is tag `v0.1.0-sprint1` (`628485c`). Its critical journey is: a customer logs in, joins a queue and sees a saved ticket; an operator calls the next entry, starts and completes it; invalid actions are rejected.

On the candidate `v0.2.0-rc1` the Sprint 1 Playwright journeys (`e2e/tests/customer.spec.ts`, `e2e/tests/operator.spec.ts`) all pass inside the full run of 21 passed, 0 failed, 0 skipped, and the 93 original server tests are part of the 126 that pass. Journeys: TEST-F08a-01 (login, logout, redirect), TEST-F08a-02 (join, new ticket), TEST-F08a-03 (saved ticket survives a reload), TEST-F08a-04 (duplicate join error), TEST-F08a-05 (operator changes appear without a reload), TEST-F08b-01 (assigned queues), TEST-F08b-02 (call next, start, complete, saved after reload), TEST-F08b-03 (rejected action). The deployed service answers `/api/health` with 200 and shows the same seed data on revisions `qms-00007-zqx`, `qms-00008-mg9` and `qms-00009-h99`. A manual walk-through of the original journey on the deployed URL, with screenshots, is part of the program demonstrations in the PDF.

## 2. Findings reported against our product

| ID | Source | Affected requirement / feature | Accepted decision | Status | Fix or change release | Re-test outcome |
|---|---|---|---|---|---|---|
| #58 | Lab 6 UAT (ClaimFlow team) | API error shape, FR-all / F-03 conventions: unknown `/api/*` returned HTML instead of the JSON error shape | Defect: fix | **Resolved** | PR #60, release PR #62, `main` `253b80e`, revision `qms-00007-zqx` | Pass: `server/tests/api/apiNotFound.test.ts` (5 tests) in the full run on `v0.2.0-rc1` |
| #55 | Lab 6 UAT | FR-16 / F-08b: the console lost the selected queue on reload | Accepted as a minor limitation for Sprint 1, then fixed in Sprint 2 by F-10 | **Resolved** | F-10 PR #75, tag `v0.2.0-sprint2` (`e82aaab`), revision `qms-00008-mg9` | Pass: TEST-F10-09 (reload keeps `?queue=<id>`, bad values fall back); issue closed with a retest comment on 24 Nov 2026 |
| #57 | Lab 6 UAT | NFR-07 / configuration: production CORS falls back to `http://localhost:5173` with credentials | Accepted defect, minor; documented limitation; fix in Sprint 3 | **Remaining** (accepted) | Planned: hardening H-02 (contract merged in #74) | Not yet retested. The deployed behaviour is unchanged on `qms-00009-h99` |
| #56 | Lab 6 UAT | NFR-01 / security headers missing, `X-Powered-By: Express` | Enhancement outside the Sprint 1 scope; fix in Sprint 3 | **Remaining** | Planned: hardening H-01 (contract merged in #74) | Not yet retested |
| #59 | Lab 6 UAT result | Whole Sprint 1 release | The partner team decided: accepted with documented minor limitations | **Accepted** | Lab 6 baseline `253b80e` | n/a |

## 3. Known gaps from Sprint 1 (`docs/sprints/sprint-1/known-gaps.md`)

| ID | Gap | Affected requirement / feature | Decision | Status | Fix or change release | Re-test outcome |
|---|---|---|---|---|---|---|
| G-01 | No cancel or no-show: a called customer who never arrives blocks the counter | FR-14, BR-05 / F-06 | Build in Sprint 2 | **Resolved** | F-09 PR #73, `v0.2.0-sprint2` | Pass: TEST-F09-06 (no-show frees the counter, next call succeeds), TEST-F09-13 (e2e) |
| G-02 | BR-05 enforced by the row lock only, not by an index | BR-05 / F-06 | Index per counter with F-12 | **Remaining** | Planned: F-12a (contract merged in #79) | Planned: TEST-F12-04 |
| G-03 | No login rate limit | NFR-01 / F-02 | Sprint 3 hardening | **Remaining** | Planned: H-03 | Planned: TEST-H03-01..04 |
| G-04 | Expired sessions deleted only when seen | NFR-05 / F-02 | Sprint 3 cleanup | **Remaining** | Planned: H-04 | Planned: TEST-H04-01, TEST-H04-02 |
| G-05 | The slow-network loading-state check is manual and not recorded | NFR-08 / F-08b | Record with a screenshot | **Remaining** | Planned, 9 Dec | TEST-F08b-03b not yet recorded |
| G-06 | GitHub Actions could not start (billing lock), so no CI | NFR-09 / R-DEP | Build CI in Lab 5 | **Resolved** | Lab 5: workflow `CI & Docker Build` | Pass: run `45411143732` on release PR #78 is green; it also gates PRs |
| G-07 | FR-12 delivered as an API only, no display page | FR-12, FR-17 / F-07 | Sprint 2, F-11 | **Resolved** | F-11 PR #72, `v0.2.0-sprint2` | Pass: TEST-F11-01..06 |
| G-08 | Demo accounts share one development password | NFR-07 | Per-environment secret in Lab 5 | **Resolved for the cloud** (a generated secret `qms-seed-password`), **remaining for local development** (documented demo password) | Lab 5 | Local password is dev-only and documented in the README |
| G-09 | The `Secure` cookie flag in production is designed but not covered by a test | NFR-01 / F-02 | Check on the deployed URL | **Remaining** | Not yet checked | Not retested |
| G-10 | The 10 s default refresh is not timed by any test | NFR-08 | Add a timing check | **Remaining** | Planned: TEST-H06-03 | Planned |
| G-11 | `GET /api/me/entries?status=<other>` returns all entries instead of 400 | FR-06 / F-05 | Allowed by the contract; harmless | **Accepted** | none | n/a |

## 4. Reports we filed on the partner product (ClaimFlow, Lab 6)

| ID | Summary | Severity | Triage by the product owner | Our re-test | Status |
|---|---|---|---|---|---|
| CF #86 | Title or purpose made only of spaces is accepted and the claim is stored blank (later extended by us to description and receipt reference) | Minor | Confirmed in the API and the form | Retest PASS on PR #93 (`bb5a0d1`), 22 Nov 2026 | Fixed, OK to close from the UAT side |
| CF #87 | Double-clicking Submit can create two identical claims | Major | Confirmed; fix in the UI | Retest PASS on PR #93, 22 Nov 2026 | Fixed, OK to close from the UAT side |

The full text, the triage and our retest comments are in the Lab 6 report (Appendix 2).

## 5. Approved baseline changes and their rationale

| Baseline | Commit / tag | Revision | Why it exists |
|---|---|---|---|
| Sprint 1 release | `v0.1.0-sprint1` (`628485c`) | before Lab 5 | Deliverable 1: the original journey |
| Lab 6 baseline | `main` `253b80e` | `qms-00007-zqx` | UAT fix #58 |
| Sprint 2 release | `v0.2.0-sprint2` (`e82aaab`, release PR #76) | `qms-00008-mg9` | F-09, F-10, F-11; kept identifiable even though the candidate contains more |
| Release candidate | `v0.2.0-rc1` (`354f72d`, release PR #78) | `qms-00009-h99` | Adds F-13 (service summaries API). The Deliverable 2 submission tag will be `v0.2.0`, a docs-only change over `rc1` with the regression rerun on it; this row is updated when that tag exists. |

| Date | Change | Rationale | Where |
|---|---|---|---|
| 12 Nov 2026 | The repository moved to the MacOverlorD account | GitHub billing lock on the first account blocked Actions (gap G-06) | Lab 5 |
| 12 Nov 2026 | The login page shows the system name (Lab 5 visible change) | Lab 5 requires one visible change through staging into `main`, deployed and checked | PR #45, Lab 5 |
| 24 Nov 2026 | F-09, F-10, F-11 built in one sprint; F-13 implemented early | Finish Sprint 2 and show a real Sprint 3 workflow before 29 Nov | CLAUDE.md section 4a, PR #70 |
| 24 Nov 2026 | Deliverable 2 documents owned by TauForge (was MacOverlorD) | Balance the workload | PR #70 |
| 24 Nov 2026 | F-11 and F-10 console checks are end-to-end tests, not mocked component tests | No stubs rule; the client has no unit-test runner | Reviews of PR #70 and #71 |
| 25 Nov 2026 | BR-14 priority policy decided by the team; Q-04 resolved (the TA was not asked) | Needed to write the F-12 contract | PR #79, `docs/srs.md` 0.2 |
| 25 Nov 2026 | `QUEUE_BUSY` becomes `COUNTER_BUSY` when F-12a is built (API error-code change) | Busy is per counter | PR #79 (planned) |
| 25 Nov 2026 | F-12 seeds the second counter on Student Affairs | Keeps the Sprint 1 and 2 tests unchanged | Review of PR #79 |
| 25 Nov 2026 | SRS 0.3, features 0.2, system SDS 0.3, traceability 0.2 | Deliverable 2 baseline | PR #80 |
| 26 Nov 2026 | **CR-01 waiting limit on join**: changes the Sprint 1 join rule (FR-05, AC-F04-02); new BR-15, 409 `QUEUE_FULL`, additive column `Queue.maxWaiting`; four old assertions gain a response field (listed in the contract section 4.2) | Lab 7 maintenance change; approved by both team members (no TA approval needed per the Lab 7 announcement) | #82, `docs/maintenance/cr-01-queue-capacity.md` |

## 6. Open items for Lab 7 and the final release

| Item | Plan |
|---|---|
| Lab 7 maintenance change | CR-01 (#82): contract in this PR; code, release `v0.3.0-lab7` and deployment to follow |
| Retest of #56 and #57 on the deployed URL | After hardening H-01 and H-02 |
| Final UAT retests and the final video | By 13 Dec |
