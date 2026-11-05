# Queue and Service Management System

CPE 334 group project, Theme 9. A service counter manages a waiting line: customers join a queue and track their ticket, operators call, serve and complete entries.

## Team

| Student | GitHub |
|---|---|
| Rattathamnoon Buranapattana (67070501037) | TauForge |
| Lappawat Laohasoot (67070501039) | MacOverlorD |

## Status

Sprint 1 in progress (Project Deliverable 1, due 8 Nov 2026). F-01 provides the scaffold, schema, migration and seed; features F-02 onward follow.

## Planned stack

React + TypeScript + Vite (client), Node.js + Express + TypeScript (API), Prisma + PostgreSQL (database). See `docs/system-sds.md` once written.

## Documents

- Team plan and working rules: [`CLAUDE.md`](CLAUDE.md)
- Deliverable 1 plan: [`docs/superpowers/plans/2026-11-05-deliverable-1-plan.md`](docs/superpowers/plans/2026-11-05-deliverable-1-plan.md)
- Planned: `docs/srs.md`, `docs/features.md`, `docs/traceability.md`, `docs/system-sds.md`, `docs/sprints/`

## Prerequisites

- Node.js 20+ and npm 10+
- PostgreSQL 15+ (either Docker Desktop, or a local server)

## Setup

From the repository root:

```bash
cp .env.example server/.env
cp .env.example client/.env      # optional, the client currently reads no variables
npm run install:all
```

Start PostgreSQL and create the development and test databases.

Option A, Docker (creates `queue_dev` only):

```bash
docker compose up -d db
```

Option B, local PostgreSQL (role, dev database, test database):

```bash
psql -d postgres -c "CREATE ROLE queue_dev LOGIN PASSWORD 'queue_dev_password' CREATEDB"
createdb -O queue_dev queue_dev
createdb -O queue_dev queue_test
```

With Docker, also create the test database once: `docker compose exec db createdb -U queue_dev queue_test`.

Then apply migrations and seed demo data:

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate:deploy
npm --prefix server run prisma:seed
```

The seed is rerunnable. It creates 2 operators, 4 customers, 3 queues and sample entries. All seeded accounts use the development-only password `DemoPass123!` (set `SEED_PASSWORD` to change it): `operator1@example.test`, `operator2@example.test`, `customer1@example.test` to `customer4@example.test`.

## Run

In two terminals:

```bash
npm run dev:server    # http://localhost:3000 , check GET /api/health
npm run dev:client    # http://localhost:5173
```

## Test and build

```bash
npm test               # Vitest against the queue_test database (migrates it, then resets and reseeds per test file)
npm run build:server
npm run build:client
```

Tests never touch the development database: the test helper refuses to wipe any database whose name does not contain `test`.

## End-to-end tests (Playwright)

The browser journeys live in `e2e/` and run against their own API (port 3100), client (port 5273) and the `queue_test` database, which is reset and seeded first.

```bash
npm run install:e2e     # once: installs Playwright and the Chromium browser
npm run test:e2e
```

Do not run it at the same time as `npm test`: both use `queue_test`.

## Database notes

The partial unique index `QueueEntry_one_active_per_customer_queue` (one active entry per customer and queue, D-13) is raw SQL in the first migration. Prisma does not track it, so check every new migration file for an accidental `DROP INDEX` of it. TEST-F01-03 fails if the index is missing.

## Branches

- `main`: released baseline, changed only by a reviewed release PR.
- `sprint1-staging`: Sprint 1 integration branch, target of feature PRs.
- `feature/F-0X-name`, `fix/name`: work branches cut from `sprint1-staging`.
