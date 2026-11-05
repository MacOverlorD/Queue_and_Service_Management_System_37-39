# F-03 Role and Queue-Scope Authorization

Issue #5. Author TauForge, reviewer MacOverlorD. Requirements: NFR-01, BR-06, BR-09. Depends on: F-02.

## 1. Behavior

Backend middleware decides who may call each route. Hiding a button is not authorization; every protected route runs these checks on the server.

## 2. Middleware specification

| Middleware | Rule | Failure |
|---|---|---|
| `requireAuth` | Valid, unexpired session for cookie `sid`; sets `req.user = {id, name, role}` | 401 `UNAUTHENTICATED` |
| `requireRole(role)` | `req.user.role` equals the role | 403 `FORBIDDEN_ROLE` |
| `requireQueueOperator` | Operator has an `OperatorQueue` row for the `:queueId` in the route | 403 `FORBIDDEN_QUEUE` (unknown queue also 403, so existence is not leaked) |

Error body always `{ "error": { "code", "message" } }`. No entity data in any 401/403 body.

## 3. Route permission matrix (Sprint 1)

| Route | Anonymous | Customer | Operator assigned | Operator not assigned |
|---|---|---|---|---|
| GET /api/health | yes | yes | yes | yes |
| POST /api/auth/login | yes | yes | yes | yes |
| POST /api/auth/logout, GET /api/auth/me | 401 | yes | yes | yes |
| GET /api/queues | 401 | yes | 403 | 403 |
| POST /api/queues/:id/entries | 401 | yes | 403 | 403 |
| GET /api/me/entries, GET /api/me/entries/:id | 401 | own only | 403 | 403 |
| GET /api/queues/:id/entries | 401 | 403 | yes | 403 |
| POST /api/queues/:id/call-next | 401 | 403 | yes | 403 |
| POST /api/entries/:id/start, /complete | 401 | 403 | yes (entry's queue) | 403 |
| GET /api/queues/:id/display | yes | yes | yes | yes |

## 4. Acceptance criteria

| AC | Criterion |
|---|---|
| AC-F03-01 | Every protected route returns 401 `UNAUTHENTICATED` with no private data when no valid session is sent. |
| AC-F03-02 | A customer calling an operator-only route (list queue entries, call-next, start, complete) gets 403 `FORBIDDEN_ROLE` and nothing changes. |
| AC-F03-03 | An operator calling an operator route for a queue not assigned to them gets 403 `FORBIDDEN_QUEUE` and nothing changes. |
| AC-F03-04 | An operator calling a customer-only route (join queue, list own entries) gets 403 `FORBIDDEN_ROLE`. |
| AC-F03-05 | All 401/403 bodies match the shared error shape and contain no entity data. |

## 5. Software Test Specification

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-F03-01 | AC-F03-01 | api | No cookie; expired session cookie | Request every protected route in the matrix (table-driven) | 401 `UNAUTHENTICATED`; body has no entry/user data |
| TEST-F03-02 | AC-F03-02 | api | Logged in as customer1 | POST call-next on queue A, start and complete on an entry, GET queue entries | Each 403 `FORBIDDEN_ROLE`; entry statuses unchanged in DB |
| TEST-F03-03 | AC-F03-03 | api | Logged in as operator2 (assigned to C only) | call-next and GET entries on queue A | 403 `FORBIDDEN_QUEUE`; DB unchanged |
| TEST-F03-04 | AC-F03-04 | api | Logged in as operator1 | POST join on queue A; GET /api/me/entries | 403 `FORBIDDEN_ROLE`; no entry created |
| TEST-F03-05 | AC-F03-05 | api | Any 401 and 403 from TEST-F03-01..04 | Validate body against the error schema | Exactly `error.code` and `error.message`; no ids of entries or users |

## 6. Definition of Done

All AC implemented; TEST-F03-01..05 executed and passing with failing-first output in the PR; the matrix above matches the implemented routes; reviewer ran one negative case manually.

## 7. Revisions

| Date | Change | Reason |
|---|---|---|
| 5 Nov 2026 | First version | Deliverable 1 |
