# Lab 5 evidence index (screenshots taken 2026-11-12, repo MacOverlorD/Queue_and_Service_Management_System_37-39)

How these were taken: with Claude in Chrome in Mac's browser. These tool screenshots show only the page content, NOT the browser address bar. GitHub pages show the PR/run number inside the page, so they are fine. Live-site shots (C-04, C-05) have no address bar: retake them with the full browser window if the handout's "URL visible" is required.
Project number was masked in the page before capture. Nothing secret is on any image.

## Files here
| File | Proves | Use in PDF |
|---|---|---|
| R-06_ruleset_active_no-bypass_target-main.jpg | ruleset protect-main Active, empty bypass, target main | Part 1 |
| R-06_ruleset_pull-request_1-approval.jpg | PR required, 1 approval | Part 1 |
| R-06_ruleset_required-check_test-and-docker_up-to-date.jpg | required check test-and-docker, branch up to date | Part 1 |
| C-02_PR42_closed_not-merged_temporary-branch.jpg | PR #42 from test/prove-gate, closed not merged, red X on commit da1bf6e | Part 1 (C-02), see missing item 1 |
| R-07_environment-demo_main-only_variables_project-number-masked.jpg | environment demo: only branch main, no secrets, 4 variables | Part 4 |
| R-07_run43251650798_first-pipeline-run_summary_commit33c9b21.jpg | first Deploy demo run, tag, digest, smoke test passed | Part 4 |
| C-06_run43254088894_summary_commit61c1906_digest_smoke-passed.jpg | second run: tag = release commit 61c1906c2e9a3e5848de74717c6b176600934fe3, digest a671084e2c21f173942c5498922c34b347cc9d3dc9b6e4a114fa0984763d5ef5 | Part 4 (C-06) |
| R-07_Actions-run-history_deploy-demo_and_CI.jpg | CI on every PR, Deploy demo on main, history kept | Part 1, Part 4 |
| R-09_PR38_review-by-TauForge_specific-finding_and_fix.jpg | review by TauForge with a real finding (NODE_ENV), author confirmed and fixed it (commit d00c667). Cropped to the review comment and the reply (the diff block with the local development placeholders was removed); in the quoted text of the comment the development placeholder value is covered with a bar (review of PR #47) | Part 0 / Part 4 (R-09) |
| R-09_PR39_review-by-MacOverlorD_and_TDD-commit-order.jpg | review with specific checks; commit order kit import, failing test, fix | Part 0 / Part 4 (R-09) |
| R-10_PR-list_label-lab5_PR38-to-PR46.jpg | all Lab 5 PRs labelled lab5; #42 closed with red check | Part 0 (R-10) |
| R-10_Issue-list_label-lab5_issues30-to-37.jpg | 8 Lab 5 Issues, 7 closed | Part 0 (R-10, R-11) |
| C-04_live-URL_rule-rejection_duplicate-ticket.jpg | live site: "You already have an active ticket in this queue." (Finance Desk 1 waiting) | Part 3 (C-04), no address bar |
| C-05_before_FinanceDesk_Ticket1_created_via_UI.jpg | ticket Finance Desk #1 created on the live site about 16:10 UTC (after the 2nd deploy) | Part 3 (C-05), no address bar, retake full window |
| C-03 text: C-03_fresh-clone_build_and_run.txt | fresh clone builds and runs (commit d4599ac) | Part 2 |

## Still missing (cannot be taken by the tool)
1. C-02 blocked merge box of PR #42 ("Merging is blocked"): needs Reopen pull request, screenshot, Close again. A person can do it; then delete branch test/prove-gate (still exists).
2. Cloud Shell shots (they show account details; some are database/IAM related):
   - smoke test: python3 deploy/smoke_test.py "https://qms-6ba6hboj4a-as.a.run.app"  -> PASS /api/health, PASS /
   - gcloud sql instances describe qms-pg --format='value(settings.storageAutoResize)'  -> False
   - gcloud iam service-accounts keys list --iam-account=qms-deployer@cpe334-max-verstappen.iam.gserviceaccount.com --managed-by=user  -> Listed 0 items (crop the project number)
   - gcloud run services describe qms --region asia-southeast1 --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)'  -> image digest must equal the digest in the C-06 run summary
3. Tau's Console check (Episode 5.7): enabled APIs, qms-runner has only Cloud SQL Client, Cloud SQL qms-pg PostgreSQL 16, secrets names only, Cloud Run min 0 / max 3, Artifact Registry qms. Never click "View secret value". Hide the project number.
4. C-04 sign-in and the login page showing the new line (needs Log out first), full browser window with address bar.
5. C-05 persistence: manual re-run of "Deploy demo" from main (Actions -> Run workflow, image_tag empty), reload My tickets (Finance Desk #1 must still be there), then gcloud sql instances restart qms-pg (database change: a person runs it), reload again. Take full-window shots with the URL visible.
6. Live-site shots with the address bar (see note at the top).

## Added later (Cloud Shell, read-only commands, run by Claude in Mac's Cloud Shell tab at about 16:30 UTC)
| File | Result | Use in PDF |
|---|---|---|
| R-04_CloudShell_CloudSQL_storageAutoResize_False.jpg | `gcloud sql instances describe qms-pg --format='value(settings.storageAutoResize)'` printed `False` (cost control) | Part 3 |
| R-02_CloudShell_deployer-service-account_keys-list_0-items.jpg | deployer service account has `Listed 0 items.` (no key) | Part 4 / security |
| C-06_CloudShell_CloudRun_revision_qms-00003-r7f_digest-a671084e.jpg | running revision `qms-00003-r7f` uses image digest `sha256:a671084e...d5ef5`, equal to the digest in the Summary of run 43254088894 (tag = release commit 61c1906c2e9a3e5848de74717c6b176600934fe3) | Part 4 (C-06) |

Notes: these images show the Cloud Shell prompt with Mac's Google account name; decide whether to crop. The keys-list image is at 0.7 scale (readable but small); retake at full size if needed. They have no browser address bar.

## Updated "Still missing"
- Done now: storageAutoResize (item 2), keys list (item 2), Cloud Run revision vs digest (item 2).
- Not done: smoke test from Cloud Shell (the tab stopped responding; the last command line may have stray text, press Ctrl+C before using it), Tau's console check, login page with the new line, C-04 sign-in with address bar, C-05 redeploy + Cloud SQL restart, PR #42 blocked-merge shot (added: C-02_PR42_merge-blocked_banner_needs-1-approval_CROP.png).

## Added from Mac (PR #42 blocked merge)
| File | What it shows | Limits |
|---|---|---|
| C-02_PR42_merge-blocked_banner_needs-1-approval_CROP.png (original: "Screenshot 2026-11-12 222036.png", taken 22:20 local = 15:20 UTC, while PR #42 was open) | GitHub banner "Merging is blocked: At least 1 approving review is required by reviewers with write access." | It is a tight crop: no PR number, no failed `test-and-docker` line, no commit. The block shown is the missing approval, not the red check. For C-02 (R-06) pair it with C-02_PR42_closed_not-merged...jpg (red X) and the run 43246226299 page. If a TA needs the failing required check in the same box, retake from a full-window screenshot of the merge box, which also lists "test-and-docker" as failing, with the PR #42 title in view.

## Notes from the review of PR #47 (TauForge)
- C-05: the ticket Finance Desk #1 was created about 16:10 UTC, after the second deploy (16:01 UTC). It is a "before" for a manual redeploy and for the Cloud SQL restart, not for the second release. The PDF caption must say so. The persistence proof is still missing (re-run Deploy demo, restart `qms-pg`, reload).
- C-03 text file is a typed summary of the run, not raw terminal output. Keep a screenshot of the terminal if a TA asks for raw output.
- The Cloud Shell images show the prompt with Mac's Google account name and avatar (personal data, not a secret). Mac decides whether to crop before the PDF.
- After PR #46 staging is one commit behind `main`; sync before the next release PR.

## Added by TauForge (Console and live site, 13 Nov 2026, read only)
Taken with Claude in Chrome in TauForge's signed-in Google Cloud session. Nothing was clicked that changes a resource and no secret value was opened. The project number is blacked out where the Console shows it (Cloud Run service URL, default compute account), and personal accounts are blacked out on the IAM page.

| File | Proves | Use in PDF |
|---|---|---|
| P3_console_cloudrun_qms_revisions.png | Cloud Run service `qms`, revisions 00001 to 00004, newest deployed by `qms-deployer` with 100% traffic | Part 3 |
| P3_console_cloudrun_qms_scaling_min0_max3.png | minimum 0 and maximum 3 instances (cost control) | Part 3 |
| P3_console_cloudrun_job_qms-migrate_executions.jpg | migration job ran 4 times, all succeeded | Part 3 |
| P3_console_cloudsql_qms-pg_overview.jpg | instance `qms-pg`, PostgreSQL 16.15, running | Part 3 |
| P3_console_cloudsql_qms-pg_databases.jpg | database `qms` exists | Part 3 |
| P3_console_secretmanager_names-only.png | secret names only, no value opened | Part 3 |
| P3_console_iam_service-accounts_least-privilege_people-masked.png | `qms-runner` Cloud SQL Client only, `qms-deployer` Cloud Run Developer | Part 3 |
| P3_console_artifactregistry_qms_image-tags-are-commit-shas.jpg | image tags are full commit SHAs | Part 4 |
| P4_live_login_page_shows_new_line.png | public `/login` shows the line added in PR #46 | Part 4 |



## Restart and after-restart evidence (12 Nov 2026, UTC)
| File | Proves | Use in PDF |
|---|---|---|
| C-05_restart_operation_DONE_17-10_UTC_account-masked.png | `gcloud sql operations list --instance=qms-pg` shows operation `RESTART`, 17:10:28 to 17:10:38, STATUS DONE, no error. The Cloud Shell account name is blacked out. | Part 3 (C-05) |
| P3_live_after-restart_queues_17-38UTC.png | Public URL, signed in as Customer One at 17:38 UTC, 28 minutes after the restart: Finance Desk still shows 1 waiting, Registrar Desk 2 waiting | Part 3 (C-04, C-05) |
| P3_live_after-restart_duplicate-join-rejected_17-38UTC.png | Same session seconds later: joining again is rejected with "You already have an active ticket in this queue" (D-05), so the earlier ticket is still stored | Part 3 (C-04, C-05) |

Result of the Cloud SQL restart check (C-05): the restart finished at 17:10:38 UTC and the data was still there at 17:38 UTC. These two live-site captures were made by MacOverlorD and keep only the page content (no address bar); the URL is in the PDF caption.
