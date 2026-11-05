import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import request from "supertest";
import { EntryStatus, PrismaClient } from "@prisma/client";
import { Express } from "express";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed, userByEmail } from "../helpers";
import { sessionCookie, snapshotEntries } from "../authHelpers";

// Seed: A = Registrar Desk (operator1; WAITING #5 #6, SERVING #4, COMPLETED #1, CANCELLED #2, NO_SHOW #3),
// B = Finance Desk (operator1; empty), C = Student Affairs (operator2, closed; CALLED #1).
let prisma: PrismaClient;
let app: Express;
let op1: string;
beforeAll(async () => {
  prisma = newPrisma();
  app = createApp(prisma);
});
beforeEach(async () => {
  await resetAndSeed(prisma);
  op1 = await sessionCookie(prisma, "operator1@example.test");
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Puts entries straight into queue B (state-changing tests use B so A keeps its seed state).
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

const post = (path: string, cookie: string) => request(app).post(path).set("Cookie", cookie);
const statusOf = async (id: number) => (await prisma.queueEntry.findUniqueOrThrow({ where: { id } })).status;

describe("TEST-F06-01b / AC-F06-01: call next takes the lowest waiting number", () => {
  test("number 3 is called even though 4 was inserted first; 4 stays waiting", async () => {
    const { b, rows } = await inB({ number: 4, customer: "customer2@example.test" }, { number: 3, customer: "customer1@example.test" });
    const operator = await userByEmail(prisma, "operator1@example.test");

    const res = await post(`/api/queues/${b.id}/call-next`, op1);
    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ id: rows[1].id, number: 3, status: "CALLED", customerName: "Customer One" });
    expect(res.body.entry.calledAt).not.toBeNull();
    const called = await prisma.queueEntry.findUniqueOrThrow({ where: { id: rows[1].id } });
    expect(called.handledByOperatorId).toBe(operator.id);
    expect(await statusOf(rows[0].id)).toBe("WAITING");
  });
});

describe("TEST-F06-02 / AC-F06-02: nobody waiting", () => {
  test("409 NO_WAITING_ENTRY and no event", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const before = await snapshotEntries(prisma);
    const res = await post(`/api/queues/${b.id}/call-next`, op1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_WAITING_ENTRY");
    expect(await snapshotEntries(prisma)).toEqual(before);
  });
});

describe("TEST-F06-03 / AC-F06-03: one counter per queue (BR-05)", () => {
  test("call next while A has a SERVING entry is 409 QUEUE_BUSY and changes nothing", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const before = await snapshotEntries(prisma);
    const res = await post(`/api/queues/${a.id}/call-next`, op1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("QUEUE_BUSY");
    expect(await snapshotEntries(prisma)).toEqual(before);
  });

  test("TEST-F06-03b: two simultaneous call-next requests on a free queue call exactly one entry", async () => {
    const { b } = await inB({ number: 1, customer: "customer1@example.test" }, { number: 2, customer: "customer2@example.test" });
    const results = await Promise.all([post(`/api/queues/${b.id}/call-next`, op1), post(`/api/queues/${b.id}/call-next`, op1)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe("QUEUE_BUSY");
    expect(await prisma.queueEntry.count({ where: { queueId: b.id, status: "CALLED" } })).toBe(1);
  });
});

describe("TEST-F06-04 / AC-F06-04: start serving", () => {
  test("CALLED becomes SERVING with servingAt set", async () => {
    const { rows } = await inB({ number: 1, customer: "customer1@example.test", status: "CALLED" });
    const res = await post(`/api/entries/${rows[0].id}/start`, op1);
    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ id: rows[0].id, status: "SERVING" });
    expect(res.body.entry.servingAt).not.toBeNull();
  });
});

describe("TEST-F06-05 / AC-F06-05: complete", () => {
  test("SERVING becomes COMPLETED, then the queue is free for the next call", async () => {
    const { b, rows } = await inB(
      { number: 1, customer: "customer1@example.test", status: "SERVING" },
      { number: 2, customer: "customer2@example.test" },
    );
    const done = await post(`/api/entries/${rows[0].id}/complete`, op1);
    expect(done.status).toBe(200);
    expect(done.body.entry).toMatchObject({ status: "COMPLETED" });
    expect(done.body.entry.completedAt).not.toBeNull();

    const next = await post(`/api/queues/${b.id}/call-next`, op1);
    expect(next.status).toBe(200);
    expect(next.body.entry.number).toBe(2);
  });
});

describe("TEST-F06-06b / AC-F06-06: invalid transitions", () => {
  test("start on WAITING and complete on CALLED are 409 INVALID_TRANSITION; nothing changes", async () => {
    const { rows } = await inB(
      { number: 1, customer: "customer1@example.test" },
      { number: 2, customer: "customer2@example.test", status: "CALLED" },
    );
    const before = await snapshotEntries(prisma);
    for (const [id, action] of [[rows[0].id, "start"], [rows[1].id, "complete"]] as const) {
      const res = await post(`/api/entries/${id}/${action}`, op1);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_TRANSITION");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });
});

describe("TEST-F06-07 / AC-F06-07: final statuses stay final", () => {
  test("start and complete on COMPLETED, CANCELLED and NO_SHOW entries are 409", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const finals = await prisma.queueEntry.findMany({ where: { queueId: a.id, status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } } });
    expect(finals).toHaveLength(3);
    for (const e of finals) {
      for (const action of ["start", "complete"]) {
        const res = await post(`/api/entries/${e.id}/${action}`, op1);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("INVALID_TRANSITION");
      }
      expect(await statusOf(e.id)).toBe(e.status);
    }
  });
});

describe("TEST-F06-08 / AC-F06-08: history events", () => {
  test("join, call, start, complete each write one event; a rejected action writes none", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const c3 = await userByEmail(prisma, "customer3@example.test");
    const o1 = await userByEmail(prisma, "operator1@example.test");
    const joined = await post(`/api/queues/${b.id}/entries`, await sessionCookie(prisma, "customer3@example.test"));
    expect(joined.status).toBe(201);
    const id = joined.body.entry.id;

    expect((await post(`/api/queues/${b.id}/call-next`, op1)).status).toBe(200);
    expect((await post(`/api/entries/${id}/start`, op1)).status).toBe(200);
    expect((await post(`/api/entries/${id}/complete`, op1)).status).toBe(200);
    expect((await post(`/api/entries/${id}/start`, op1)).status).toBe(409);

    const events = await prisma.entryEvent.findMany({ where: { entryId: id }, orderBy: { id: "asc" } });
    expect(events.map((e) => [e.fromStatus, e.toStatus, e.actorId])).toEqual([
      [null, "WAITING", c3.id],
      ["WAITING", "CALLED", o1.id],
      ["CALLED", "SERVING", o1.id],
      ["SERVING", "COMPLETED", o1.id],
    ]);
  });
});

describe("TEST-F06-09 / AC-F06-09: customers cannot serve", () => {
  test("customer1 gets 403 FORBIDDEN_ROLE on call-next, start and complete; nothing changes", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const serving = await prisma.queueEntry.findFirstOrThrow({ where: { queueId: a.id, status: "SERVING" } });
    const c1 = await sessionCookie(prisma, "customer1@example.test");
    const before = await snapshotEntries(prisma);
    for (const path of [`/api/queues/${a.id}/call-next`, `/api/entries/${serving.id}/start`, `/api/entries/${serving.id}/complete`]) {
      const res = await post(path, c1);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });
});

describe("TEST-F06-10 / AC-F06-10: unassigned operator", () => {
  test("operator2 gets 403 FORBIDDEN_QUEUE on queue A; nothing changes", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const serving = await prisma.queueEntry.findFirstOrThrow({ where: { queueId: a.id, status: "SERVING" } });
    const op2 = await sessionCookie(prisma, "operator2@example.test");
    const before = await snapshotEntries(prisma);
    for (const path of [`/api/queues/${a.id}/call-next`, `/api/entries/${serving.id}/start`, `/api/entries/${serving.id}/complete`]) {
      const res = await post(path, op2);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_QUEUE");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });
});

describe("TEST-F06-11 / AC-F06-11: operator's assigned queues", () => {
  test("operator1 sees A and B, operator2 sees C, a customer gets 403", async () => {
    const r1 = await request(app).get("/api/operator/queues").set("Cookie", op1);
    expect(r1.status).toBe(200);
    expect(r1.body.queues.map((q: { name: string }) => q.name)).toEqual(["Finance Desk", "Registrar Desk"]);
    const a = r1.body.queues.find((q: { name: string }) => q.name === "Registrar Desk");
    expect(a).toMatchObject({ isOpen: true, waitingCount: 2, current: { number: 4, status: "SERVING" } });
    expect(r1.body.queues.find((q: { name: string }) => q.name === "Finance Desk").current).toBeNull();

    const r2 = await request(app).get("/api/operator/queues").set("Cookie", await sessionCookie(prisma, "operator2@example.test"));
    expect(r2.body.queues).toEqual([
      expect.objectContaining({ name: "Student Affairs", isOpen: false, waitingCount: 0, current: expect.objectContaining({ number: 1, status: "CALLED" }) }),
    ]);

    const r3 = await request(app).get("/api/operator/queues").set("Cookie", await sessionCookie(prisma, "customer1@example.test"));
    expect(r3.status).toBe(403);
    expect(r3.body.error.code).toBe("FORBIDDEN_ROLE");
  });
});
