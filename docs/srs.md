# Software Requirements Specification: Queue and Service Management System

| Item | Value |
|---|---|
| Course | CPE 334, Group Project, Theme 9 |
| Team | Rattathamnoon Buranapattana (67070501037, TauForge), Lappawat Laohasoot (67070501039, MacOverlorD) |
| Version | 0.1 (Sprint 1 baseline) |
| Date | 5 Nov 2026 |
| Status | Draft for team review (Issue #1) |

## 1. Stakeholder problem and context

A university faculty runs a **Student Service Center** with walk-in counters (document requests, registration problems, payment slips). Today students take a paper ticket and wait without knowing their position, staff call numbers by voice, and nobody can tell afterwards how many people were served or skipped.

The faculty wants a web system where a student joins a service queue from a phone or laptop, sees their ticket number and position, and is called in order. Counter staff call, serve and complete entries in a controlled order. A public screen near the counters shows who is being served without revealing personal data.

The central workflow is a **waiting line**. Booking an appointment in advance is not part of this product.

## 2. Actors and responsibilities

| Actor | Role in system | Responsibilities |
|---|---|---|
| Customer | `CUSTOMER` | Logs in, chooses an open service queue, joins it, tracks own ticket and status. Later: cancels own waiting entry. |
| Operator | `OPERATOR` | Counter staff. Logs in, sees entries of the queues assigned to them, calls the next customer, starts and completes service. Later: marks no-shows, opens/closes queues. |
| Public viewer | none (anonymous) | Reads the public display of a queue: current number being served and waiting count. Cannot see any personal data. |
| Seed/maintainer | none (developer) | Creates demo accounts, queues and operator assignments through the documented seed script. There is no admin UI in this product. |

One account has exactly one role. Accounts are seeded; there is no self-registration.

## 3. Scope

### 3.1 In scope (whole product)

- Login, logout and current-user identity with a server-side session.
- Service queues, each representing one service, with operators assigned to specific queues.
- Joining a queue with a safely generated ticket number.
- Customer view of own ticket, status and position in line.
- Operator workflow: call next, start serving, complete; later cancel, no-show, open/close queue.
- Entry history (who changed which status and when).
- Public queue display with limited, non-private information.
- Later sprints: multiple counters per queue, a priority policy, and service summaries.

### 3.2 Exclusions

- Advance appointment booking or time slots.
- Real SMS, email, LINE or push notifications. Status is seen in the app.
- Payments.
- Self-registration, password recovery, email verification, admin user management UI.
- Multiple roles per account.
- Real-time sockets. The UI refreshes by polling.
- Integration with any external university system. All data is synthetic.

## 4. Functional requirements

Sprint column shows where the requirement is first delivered and verified. Detailed acceptance criteria live in the feature contracts under `docs/sprints/`.

| ID | Requirement | Actor | Sprint |
|---|---|---|---|
| FR-01 | The system shall let a seeded user log in with email and password and start a session. | All users | 1 |
| FR-02 | The system shall let a logged-in user log out, ending the session so it can no longer be used. | All users | 1 |
| FR-03 | The system shall return the current user's id, name and role for a valid session. | All users | 1 |
| FR-04 | The system shall list service queues with name, service, open/closed state and waiting count. | Customer | 1 |
| FR-05 | The system shall let a customer join an open queue and receive a ticket number and `waiting` status. | Customer | 1 |
| FR-06 | The system shall show a customer their own entries with ticket number, status, and number of people ahead while waiting. | Customer | 1 |
| FR-07 | The system shall show an operator the active entries (waiting, called, serving) of each queue assigned to them, in queue order. | Operator | 1 |
| FR-08 | The system shall let an operator call the next waiting entry of an assigned queue, changing it to `called`. | Operator | 1 |
| FR-09 | The system shall let an operator start service on a called entry, changing it to `serving`. | Operator | 1 |
| FR-10 | The system shall let an operator complete a serving entry, changing it to `completed`. | Operator | 1 |
| FR-11 | The system shall record every status change of an entry with old status, new status, acting user and time. | System | 1 |
| FR-12 | The system shall provide a public display for a queue showing queue name, the ticket number currently called or serving, and the waiting count. | Public viewer | 1 (API), 2 (screen) |
| FR-13 | The system shall let a customer cancel their own entry while it is waiting. | Customer | 2 |
| FR-14 | The system shall let an operator mark a called entry as no-show. | Operator | 2 |
| FR-15 | The system shall let an operator open and close an assigned queue for new joins. | Operator | 2 |
| FR-16 | The system shall show an operator one console covering all their assigned queues. | Operator | 2 |
| FR-17 | The system shall provide a public display screen that refreshes automatically. | Public viewer | 2 |
| FR-18 | The system shall support several counters serving the same queue at the same time. | Operator | 3 |
| FR-19 | The system shall apply a defined priority policy when choosing the next entry. | System | 3 |
| FR-20 | The system shall show per-queue service summaries for a chosen day: served, cancelled, no-show counts and average waiting time. | Operator | 3 |

## 5. Business rules

| ID | Rule | Sprint |
|---|---|---|
| BR-01 | A customer may hold at most one active entry (`waiting`, `called` or `serving`) in the same queue. A second join is rejected. | 1 |
| BR-02 | Ticket numbers are unique within a queue, increase by one per join, and are never reused, including under concurrent joins. | 1 |
| BR-03 | "Call next" always selects the waiting entry with the lowest ticket number. An operator cannot call a specific entry out of order. | 1 |
| BR-04 | Only these transitions are allowed: `waiting -> called`, `called -> serving`, `serving -> completed`. Sprint 2 adds `waiting -> cancelled` and `called -> no_show`. Any other transition is rejected and the entry is unchanged. | 1 (2) |
| BR-05 | A queue may have at most one entry in `called` or `serving` at a time. Calling next while one exists is rejected. (Replaced per counter in Sprint 3.) | 1 |
| BR-06 | An operator may view and act only on queues assigned to them. | 1 |
| BR-07 | A customer may view only their own entries. Another customer's entry is not returned. | 1 |
| BR-08 | The public display never returns customer names, emails or ids. | 1 |
| BR-09 | Only customers can join queues. Only operators can call, start, complete, mark no-show or open/close queues. | 1 |
| BR-10 | A closed queue rejects new joins. Entries already in it can still be served. | 1 |
| BR-11 | `completed`, `cancelled` and `no_show` are final. A final entry cannot change status. After a final status, the customer may join the same queue again. | 1 |
| BR-12 | Only the owner can cancel, and only while the entry is `waiting`. | 2 |
| BR-13 | No-show can be marked only on a `called` entry, only by an operator assigned to its queue. | 2 |
| BR-14 | The priority policy (to be defined with the TA) decides order among waiting entries; within the same priority, BR-03 order applies. | 3 |

## 6. Non-functional requirements

| ID | Requirement and measurable target | Verification | Sprint |
|---|---|---|---|
| NFR-01 | Security: every protected endpoint returns 401 to an unauthenticated request and the body contains no private data. | API tests on each protected route | 1 |
| NFR-02 | Security: passwords are stored only as bcrypt hashes (cost 10 or more) and no endpoint returns a hash. | DB test on seeded users, API response tests | 1 |
| NFR-03 | Integrity under concurrency: 50 simultaneous joins to one queue produce 50 entries with 50 distinct consecutive numbers. | Integration test against PostgreSQL | 1 |
| NFR-04 | Integrity: the database itself rejects a second active entry for the same customer and queue, even if application checks are bypassed. | DB-level test inserting directly | 1 |
| NFR-05 | Session: a session expires 8 hours after login, and after logout the old cookie gets 401. | API tests | 1 |
| NFR-06 | Persistence: queue data survives an API restart (and, from Lab 5, a redeployment). | Integration test that restarts the app; Lab 5 deployment check | 1 (5) |
| NFR-07 | Configuration: no real secret is committed; all settings come from environment variables listed in `.env.example`. | PR review checklist, secret scan before release | 1 |
| NFR-08 | Usability: every screen shows loading, empty and error states; a customer's status view refreshes at least every 10 seconds. | E2E test and manual check | 1 |
| NFR-09 | Deployability: the app builds into Docker images and runs on GCP with a managed PostgreSQL database. | Lab 5 pipeline evidence | 2 (Lab 5) |
| NFR-10 | Performance: queue operations respond in under 500 ms at the 95th percentile with 200 active entries on the deployed environment. | Scripted timing test | 3 |
| NFR-11 | Test quality: server domain and service modules reach at least 80% line coverage. | Coverage report in CI | 3 |

## 7. Assumptions

- A-01: Demo data is enough: about 4 customers, 2 operators, 2 to 3 queues, seeded by script.
- A-02: All times are stored in UTC and shown in Asia/Bangkok time.
- A-03: Customers use a modern browser; no native mobile app.
- A-04: Queue and operator assignments change rarely, so the seed script is enough to manage them in Sprints 1 and 2.
- A-05: Ticket numbers restart only when a new queue is created; there is no daily reset in Sprint 1.

## 8. Decisions

Recorded in `CLAUDE.md` section 3 and repeated here as the requirement baseline.

| ID | Decision | Affects |
|---|---|---|
| D-01 | Stack: React + TypeScript + Vite, Express + TypeScript, Prisma, PostgreSQL. | All |
| D-02 | Two roles, seeded accounts only. | FR-01, BR-09 |
| D-03 | First come first served by ticket number. | BR-03 |
| D-04 | One queue is one service; operators are assigned to queues. | BR-06 |
| D-05 | One active entry per customer per queue. | BR-01 |
| D-06 | Status flow `waiting -> called -> serving -> completed`; cancel and no-show in Sprint 2. | BR-04 |
| D-07 | Call next takes the head of the line only. | BR-03 |
| D-08 | One called or serving entry per queue (single counter) until Sprint 3. | BR-05 |
| D-09 | Ticket numbers per queue, atomic, never reused. | BR-02 |
| D-10 | bcrypt hashes, DB-stored session, httpOnly cookie, 8 h expiry, logout deletes session. | FR-01..03, NFR-02, NFR-05 |
| D-11 | Public display shows queue name, current number, waiting count only. | FR-12, BR-08 |
| D-12 | Atomic counter on the queue row plus `UNIQUE(queueId, number)`. | BR-02, NFR-03 |
| D-13 | Partial unique index for active entries, raw SQL in the migration, proven by a DB test. Every later migration must be checked for an accidental `DROP INDEX` (Mac's review on PR #14). | BR-01, NFR-04 |
| D-14 | At most one open PR per student; merge in planned order. | Process |

## 9. Open questions

| ID | Question | Proposed answer | Status |
|---|---|---|---|
| Q-01 | Is the Student Service Center context acceptable for Theme 9? | Yes, it is a service counter with a waiting line. | Ask TA |
| Q-02 | Counter field name: `nextNumber` (number to hand out next) or `lastNumber` (last number handed out)? Prisma `increment` returns the value after the update (Mac's review on PR #14). | Use `lastNumber`; the returned value is the new ticket number. | Closed: `lastNumber` confirmed in the F-04 contract |
| Q-03 | Should the public display need login? | No, it is public but returns no private data (BR-08). | Proposed |
| Q-04 | Priority policy for Sprint 3 (for example accessibility needs)? | Define with TA before Sprint 3. | Open |
| Q-05 | Should ticket numbers reset daily? | Not in Sprint 1 (A-05); revisit with FR-20 summaries. | Open |

## 10. Revision history

| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 5 Nov 2026 | First baseline for Deliverable 1 | TauForge |
