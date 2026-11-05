# Queue and Service Management System

CPE 334 group project, Theme 9. A service counter manages a waiting line: customers join a queue and track their ticket, operators call, serve and complete entries.

## Team

| Student | GitHub |
|---|---|
| Rattathamnoon Buranapattana (67070501037) | TauForge |
| Mac | MacOverlorD |

## Status

Sprint 1 in progress (Project Deliverable 1, due 8 Nov 2026). The application scaffold arrives with feature F-01.

## Planned stack

React + TypeScript + Vite (client), Node.js + Express + TypeScript (API), Prisma + PostgreSQL (database). See `docs/system-sds.md` once written.

## Documents

- Team plan and working rules: [`CLAUDE.md`](CLAUDE.md)
- Deliverable 1 plan: [`docs/superpowers/plans/2026-11-05-deliverable-1-plan.md`](docs/superpowers/plans/2026-11-05-deliverable-1-plan.md)
- Planned: `docs/srs.md`, `docs/features.md`, `docs/traceability.md`, `docs/system-sds.md`, `docs/sprints/`

## Setup

Setup, run and test commands will be added with F-01. Environment variables are listed in [`.env.example`](.env.example); never commit a real `.env`.

## Branches

- `main`: released baseline, changed only by a reviewed release PR.
- `sprint1-staging`: Sprint 1 integration branch, target of feature PRs.
- `feature/F-0X-name`, `fix/name`: work branches cut from `sprint1-staging`.
