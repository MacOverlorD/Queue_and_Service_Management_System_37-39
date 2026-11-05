# Sprint 1 Known Gaps and Limitations

Recorded honestly for Deliverable 1. Nothing here is hidden by a skipped or weakened test: all 83 server tests and 10 end-to-end journeys pass, with 0 failed and 0 skipped.

| ID | Gap | Effect | Plan |
|---|---|---|---|
| G-01 | No no-show or cancel yet (F-09, Sprint 2). | If a called customer never arrives, the counter stays blocked (BR-05) until the operator completes the entry. | Sprint 2, F-09 |
| G-02 | BR-05 (one CALLED or SERVING entry per queue) is enforced by the application row lock only, not by a database index (SDS-Q1). | Direct database edits could create two. | Optional index in Sprint 3 with F-12 |
| G-03 | No login rate limit. | Passwords can be guessed without throttling. | Sprint 3 hardening |
| G-04 | Expired sessions are deleted only when seen. | Unused expired session rows accumulate. | Sprint 3 cleanup |
| G-05 | The loading-state check (TEST-F08b-03b, slow network) is manual and not yet recorded. | NFR-08 is marked Partial in the traceability matrix. | Record with a screenshot before submission |
| G-06 | GitHub Actions cannot start (account billing lock), so there is no CI yet. | CI/CD is a Lab 5 deliverable; local test results are tied to the release commit instead. | Fix billing, then build CI in Lab 5 |
| G-07 | `FR-12` is delivered as an API only; the display screen is F-11 (Sprint 2). | No public display page yet. | Sprint 2, F-11 |
| G-08 | Demo accounts share one development-only password (`DemoPass123!`), documented in the README. | Not for production use. | Replace per environment in Lab 5 |
| G-09 | The `Secure` cookie flag under `NODE_ENV=production` is designed (SDS 7) but no test covers it; the suite runs in development mode. | A production misconfiguration would not be caught locally. | Check the flag on the deployed URL in Lab 5 |
| G-10 | The 10 s default refresh (NFR-08) is not timed by any test; the journeys use `VITE_REFRESH_MS=1500`. | The default interval is verified only by reading the code. | Add a timing check in Sprint 3 hardening |
| G-11 | `GET /api/me/entries?status=<value other than active>` returns all entries instead of a 400. | Allowed by the contract; harmless. | Validate the query in Sprint 2 if needed |

Platforms verified: macOS (TauForge, clean clone) and Windows 11 with Docker Desktop (MacOverlorD, clean clone). Linux is not verified.

Later-sprint requirements (FR-13..FR-20, BR-12..BR-14, NFR-09..NFR-11) are allocated in `docs/traceability.md` and are not started.
