import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import request from "supertest";
import { EntryStatus, PrismaClient } from "@prisma/client";
import { Express } from "express";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed, userByEmail } from "../helpers";
import { sessionCookie, snapshotEntries } from "../authHelpers";

// F-09 contract: docs/sprints/sprint-2/f-09-cancel-no-show.md
// Seed: A = Registrar Desk (operator1; WAITING #5 #6, SERVING #4, finals #1-#3), B = Finance Desk (operator1; empty),
// C = Student Affairs (operator2, closed; CALLED #1). State-changing tests use B.
let prisma: PrismaClient;
let app: Express;
let op1: string;
let op2: string;
let c1: string;
let c3: string;
beforeAll(async () => {
  prisma = newPrisma();
  app = createApp(prisma);
});
beforeEach(async () => {
  await resetAndSeed(prisma);
  op1 = await sessionCookie(prisma, "operator1@example.test");
  op2 = await sessionCookie(prisma, "operator2@example.test");
  c1 = await sessionCookie(prisma, "customer1@example.test");
  c3 = await sessionCookie(prisma, "customer3@example.test");
});
afterAll(async () => {
  await prisma.$disconnect();
});

const C3 = "customer3@example.test";
const C4 = "customer4@example.test";

async function inB(...entries: Array<{ number: number; customer: string; status?: EntryStatus }>) {
  const b = await queueByName(prisma, "Finance Desk");
  const rows = [];
  for (const e of entries) {
    const c = await userByEmail(prisma, e.customer);
    rows.push(await prisma.queueEntry.create({ data: { queueId: b.id, customerId: c.id, number: e.number, status: e.status ?? "WAITING" } }));
  }
  await prisma.queue.update({ where: { id: b.id }, data: { lastNumber: Math.max(0, ...entries.map((e) => e.number)) } });
  return { b, rows };
}

const post = (path: string, cookie?: string) => {
  const r = request(app).post(path);
  return cookie ? r.set("Cookie", cookie) : r;
};
const cancel = (id: number | string, cookie?: string) => post(`/api/me/entries/${id}/cancel`, cookie);
const noShow = (id: number | string, cookie?: string) => post(`/api/entries/${id}/no-show`, cookie);
const statusOf = async (id: number) => (await prisma.queueEntry.findUniqueOrThrow({ where: { id } })).status;

describe("TEST-F09-02 / AC-F09-01: customer cancels own waiting entry", () => {
  test("200 CANCELLED; leaves active lists; waiting count and people ahead drop", async () => {
    const { b, rows } = await inB({ number: 1, customer: C3 }, { number: 2, customer: C4 });
    const c4 = await sessionCookie(prisma, C4);
    const ahead = async () => (await request(app).get(`/api/me/entries/${rows[1].id}`).set("Cookie", c4)).body.entry.peopleAhead;
    expect(await ahead()).toBe(1);

    const res = await cancel(rows[0].id, c3);
    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ id: rows[0].id, status: "CANCELLED", peopleAhead: null });

    expect(await ahead()).toBe(0);
    const list = await request(app).get(`/api/queues/${b.id}/entries`).set("Cookie", op1);
    expect(list.body.entries.map((e: { id: number }) => e.id)).toEqual([rows[1].id]);
    const queues = await request(app).get("/api/queues").set("Cookie", c3);
    expect(queues.body.queues.find((q: { id: number }) => q.id === b.id).waitingCount).toBe(1);
  });
});

describe("TEST-F09-03 / AC-F09-02: only a waiting entry can be cancelled", () => {
  test("CALLED, SERVING and COMPLETED own entries give 409 INVALID_TRANSITION and no change", async () => {
    const { rows } = await inB(
      { number: 1, customer: C3, status: "CALLED" },
      { number: 2, customer: C3, status: "COMPLETED" },
    );
    const a = await queueByName(prisma, "Registrar Desk");
    const c3user = await userByEmail(prisma, C3);
    const serving = await prisma.queueEntry.create({ data: { queueId: a.id, customerId: c3user.id, number: 99, status: "SERVING" } });
    const before = await snapshotEntries(prisma);
    for (const id of [rows[0].id, serving.id, rows[1].id]) {
      const res = await cancel(id, c3);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_TRANSITION");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });
});

describe("TEST-F09-04 / AC-F09-03: cannot cancel another customer's entry", () => {
  test("other customer's id, missing id and malformed id all give 404 NOT_FOUND", async () => {
    const { rows } = await inB({ number: 1, customer: C4 });
    for (const id of [rows[0].id, 999999, "abc"]) {
      const res = await cancel(id, c3);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect(await statusOf(rows[0].id)).toBe("WAITING");
  });
});

describe("TEST-F09-05 / AC-F09-04: cancel is customer-only", () => {
  test("operator gets 403 FORBIDDEN_ROLE, no session gets 401; entry unchanged", async () => {
    const { rows } = await inB({ number: 1, customer: C3 });
    const asOperator = await cancel(rows[0].id, op1);
    expect(asOperator.status).toBe(403);
    expect(asOperator.body.error.code).toBe("FORBIDDEN_ROLE");
    const anonymous = await cancel(rows[0].id);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
    expect(await statusOf(rows[0].id)).toBe("WAITING");
  });
});

describe("TEST-F09-06 / AC-F09-05: no-show frees the counter", () => {
  test("called entry becomes NO_SHOW and the next call-next succeeds", async () => {
    const { b, rows } = await inB({ number: 1, customer: C3, status: "CALLED" }, { number: 2, customer: C4 });
    const res = await noShow(rows[0].id, op1);
    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ id: rows[0].id, status: "NO_SHOW", customerName: "Customer Three" });
    expect(res.body.entry).not.toHaveProperty("customerEmail");

    const next = await post(`/api/queues/${b.id}/call-next`, op1);
    expect(next.status).toBe(200);
    expect(next.body.entry).toMatchObject({ id: rows[1].id, status: "CALLED" });
  });
});

describe("TEST-F09-07 / AC-F09-06: only a called entry can be a no-show", () => {
  test("WAITING, SERVING and COMPLETED give 409 INVALID_TRANSITION and no change", async () => {
    const { rows } = await inB(
      { number: 1, customer: C3, status: "WAITING" },
      { number: 2, customer: C4, status: "SERVING" },
      { number: 3, customer: "customer1@example.test", status: "COMPLETED" },
    );
    const before = await snapshotEntries(prisma);
    for (const r of rows) {
      const res = await noShow(r.id, op1);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_TRANSITION");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });
});

describe("TEST-F09-08 / AC-F09-07: no-show permissions", () => {
  test("customer 403 FORBIDDEN_ROLE; unassigned operator and unknown id 403 FORBIDDEN_QUEUE", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const c3user = await userByEmail(prisma, C3);
    // A already has a SERVING entry, so this CALLED row is test data for permissions only.
    const called = await prisma.queueEntry.create({ data: { queueId: a.id, customerId: c3user.id, number: 98, status: "CALLED" } });

    const asCustomer = await noShow(called.id, c1);
    expect(asCustomer.status).toBe(403);
    expect(asCustomer.body.error.code).toBe("FORBIDDEN_ROLE");
    for (const id of [called.id, 999999]) {
      const res = await noShow(id, op2);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_QUEUE");
    }
    expect(await statusOf(called.id)).toBe("CALLED");
  });
});

describe("TEST-F09-09 / AC-F09-08: one history event per change", () => {
  test("cancel and no-show each write one event with the right actor; a rejected request writes none", async () => {
    const { b, rows } = await inB({ number: 1, customer: C3 }, { number: 2, customer: C4 });
    const c3user = await userByEmail(prisma, C3);
    const operator = await userByEmail(prisma, "operator1@example.test");

    expect((await cancel(rows[0].id, c3)).status).toBe(200);
    expect((await post(`/api/queues/${b.id}/call-next`, op1)).status).toBe(200);
    expect((await noShow(rows[1].id, op1)).status).toBe(200);
    const eventsBefore = await prisma.entryEvent.count();
    expect((await cancel(rows[0].id, c3)).status).toBe(409);
    expect(await prisma.entryEvent.count()).toBe(eventsBefore);

    const ev = await prisma.entryEvent.findMany({ where: { entryId: { in: [rows[0].id, rows[1].id] } }, orderBy: { id: "asc" } });
    expect(ev.map((e) => [e.entryId, e.fromStatus, e.toStatus, e.actorId])).toEqual([
      [rows[0].id, "WAITING", "CANCELLED", c3user.id],
      [rows[1].id, "WAITING", "CALLED", operator.id],
      [rows[1].id, "CALLED", "NO_SHOW", operator.id],
    ]);
  });
});

describe("TEST-F09-10 / AC-F09-09: rejoin after a final status", () => {
  test("after cancel and after no-show the customer joins again with a higher number", async () => {
    const { b, rows } = await inB({ number: 1, customer: C3 }, { number: 2, customer: C4, status: "CALLED" });
    const c4 = await sessionCookie(prisma, C4);
    expect((await cancel(rows[0].id, c3)).status).toBe(200);
    expect((await noShow(rows[1].id, op1)).status).toBe(200);

    const j3 = await post(`/api/queues/${b.id}/entries`, c3);
    const j4 = await post(`/api/queues/${b.id}/entries`, c4);
    expect(j3.status).toBe(201);
    expect(j4.status).toBe(201);
    expect(j3.body.entry.status).toBe("WAITING");
    expect(j3.body.entry.number).toBeGreaterThan(2);
    expect(j4.body.entry.number).toBeGreaterThan(2);
  });
});

describe("TEST-F09-11 / AC-F09-10: cancel racing call-next", () => {
  test("exactly one wins each round; the entry is CANCELLED or CALLED with one event for the winner", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const c3user = await userByEmail(prisma, C3);
    for (let round = 1; round <= 10; round++) {
      await prisma.queueEntry.updateMany({ where: { queueId: b.id, status: { in: ["WAITING", "CALLED"] } }, data: { status: "COMPLETED" } });
      const entry = await prisma.queueEntry.create({ data: { queueId: b.id, customerId: c3user.id, number: round, status: "WAITING" } });
      await prisma.queue.update({ where: { id: b.id }, data: { lastNumber: round } });

      const [c, n] = await Promise.all([cancel(entry.id, c3), post(`/api/queues/${b.id}/call-next`, op1)]);
      expect([c.status, n.status].sort()).toEqual([200, 409]);
      const final = await statusOf(entry.id);
      expect(final).toBe(c.status === 200 ? "CANCELLED" : "CALLED");
      expect(await prisma.entryEvent.count({ where: { entryId: entry.id } })).toBe(1);
    }
  });
});
