import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { Express } from "express";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed, userByEmail } from "../helpers";
import { sessionCookie } from "../authHelpers";

// Lab 7 change request CR-01 (#82): waiting limit on join. Contract: docs/maintenance/cr-01-queue-capacity.md §5, §6.
// Seed: B = Finance Desk (operator1, open, empty). Tests set maxWaiting directly in the database.
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

const cookieOf = (n: number) => sessionCookie(prisma, `customer${n}@example.test`);
const join = (queueId: number, cookie: string) => request(app).post(`/api/queues/${queueId}/entries`).set("Cookie", cookie);
const FULL = { code: "QUEUE_FULL", message: "This queue is full. Please try again later." };

// Finance Desk with the given limit and customers 1..waiting waiting in it (numbers 1..waiting).
async function financeDesk(maxWaiting: number | null, waiting = 0) {
  const b = await queueByName(prisma, "Finance Desk");
  for (let i = 1; i <= waiting; i++) {
    const c = await userByEmail(prisma, `customer${i}@example.test`);
    await prisma.queueEntry.create({ data: { queueId: b.id, customerId: c.id, number: i, status: "WAITING" } });
  }
  return prisma.queue.update({ where: { id: b.id }, data: { maxWaiting, lastNumber: waiting } });
}

async function snapshot(queueId: number) {
  const q = await prisma.queue.findUniqueOrThrow({ where: { id: queueId } });
  return {
    lastNumber: q.lastNumber,
    waiting: await prisma.queueEntry.count({ where: { queueId, status: "WAITING" } }),
    entries: await prisma.queueEntry.count({ where: { queueId } }),
    events: await prisma.entryEvent.count(),
  };
}

async function extraCustomers(n: number, prefix: string) {
  const hash = (await userByEmail(prisma, "customer1@example.test")).passwordHash;
  const cookies: string[] = [];
  for (let i = 0; i < n; i++) {
    await prisma.user.create({ data: { name: `${prefix} ${i}`, email: `${prefix}${i}@example.test`, passwordHash: hash, role: "CUSTOMER" } });
    cookies.push(await sessionCookie(prisma, `${prefix}${i}@example.test`));
  }
  return cookies;
}

describe("TEST-F04-07 / AC-F04-07: the last place is taken", () => {
  test("maxWaiting 2 with customer1 waiting: customer2 joins with 201 and B has 2 waiting", async () => {
    const b = await financeDesk(2, 1);
    const res = await join(b.id, await cookieOf(2));
    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({ number: 2, status: "WAITING" });
    expect((await snapshot(b.id)).waiting).toBe(2);
  });
});

describe("TEST-F04-08 / AC-F04-08: a full queue refuses the join", () => {
  test("maxWaiting 2 with 2 waiting: customer3 gets 409 QUEUE_FULL; no number, entry or event is used", async () => {
    const b = await financeDesk(2, 2);
    const before = await snapshot(b.id);
    const res = await join(b.id, await cookieOf(3));
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual(FULL);
    expect(await snapshot(b.id)).toEqual(before);
  });

  test("TEST-F04-08b: a customer already waiting in the full queue is told DUPLICATE_ACTIVE_ENTRY", async () => {
    const b = await financeDesk(2, 2);
    const before = await snapshot(b.id);
    const res = await join(b.id, await cookieOf(1));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_ACTIVE_ENTRY");
    expect(await snapshot(b.id)).toEqual(before);
  });
});

describe("TEST-F04-09 / AC-F04-09: leaving WAITING opens a place", () => {
  test("(a) after call-next and (b) after a cancel the next join succeeds; never more than 2 waiting", async () => {
    const b = await financeDesk(2, 2);
    expect((await request(app).post(`/api/queues/${b.id}/call-next`).set("Cookie", op1)).status).toBe(200);
    const a = await join(b.id, await cookieOf(3));
    expect(a.status).toBe(201);
    expect((await snapshot(b.id)).waiting).toBe(2);

    const c2 = await cookieOf(2);
    const mine = (await request(app).get("/api/me/entries?status=active").set("Cookie", c2)).body.entries.find((e: { queueId: number }) => e.queueId === b.id);
    expect((await request(app).post(`/api/me/entries/${mine.id}/cancel`).set("Cookie", c2)).status).toBe(200);
    const bRes = await join(b.id, await cookieOf(4));
    expect(bRes.status).toBe(201);
    expect((await snapshot(b.id)).waiting).toBe(2);
  });
});

describe("TEST-F04-10 / AC-F04-10: concurrent joins never exceed the limit", () => {
  test("maxWaiting 3, 10 customers at once: 3 × 201 (numbers n+1..n+3), 7 × QUEUE_FULL, lastNumber n+3", async () => {
    const b = await financeDesk(3, 0);
    const n = b.lastNumber;
    const results = await Promise.all((await extraCustomers(10, "cap")).map((c) => join(b.id, c)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    const refused = results.filter((r) => r.status === 409);
    expect(refused).toHaveLength(7);
    expect(refused.every((r) => r.body.error.code === "QUEUE_FULL")).toBe(true);
    expect(results.filter((r) => r.status === 201).map((r) => r.body.entry.number).sort()).toEqual([n + 1, n + 2, n + 3]);
    const after = await snapshot(b.id);
    expect(after.waiting).toBe(3);
    expect(after.lastNumber).toBe(n + 3);
  }, 60_000);
});

describe("TEST-F04-11 / AC-F04-11: closed is checked before full", () => {
  test("a closed and full queue answers QUEUE_CLOSED", async () => {
    const b = await financeDesk(1, 1);
    await prisma.queue.update({ where: { id: b.id }, data: { isOpen: false } });
    const res = await join(b.id, await cookieOf(3));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("QUEUE_CLOSED");
  });
});

describe("TEST-F04-12 / AC-F04-12: no limit is the Sprint 1 behaviour; lowering removes nobody", () => {
  test("maxWaiting null: 5 joins succeed; set 2 → still 5 waiting and the next join is QUEUE_FULL", async () => {
    const b = await financeDesk(null, 0);
    for (const c of await extraCustomers(5, "unl")) expect((await join(b.id, c)).status).toBe(201);
    await prisma.queue.update({ where: { id: b.id }, data: { maxWaiting: 2 } });
    expect((await snapshot(b.id)).waiting).toBe(5);
    const res = await join(b.id, await cookieOf(1));
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual(FULL);
  });
});

describe("TEST-F04-14 / AC-F04-12: the database only accepts 1..200 or NULL", () => {
  test("check constraint rejects 0 and 201, accepts 1, 200 and NULL", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    for (const bad of [0, 201]) {
      await expect(prisma.$executeRaw`UPDATE "Queue" SET "maxWaiting" = ${bad} WHERE id = ${b.id}`).rejects.toThrow();
    }
    for (const ok of [1, 200, null]) {
      expect(await prisma.$executeRaw`UPDATE "Queue" SET "maxWaiting" = ${ok} WHERE id = ${b.id}`).toBe(1);
    }
  });
});

describe("TEST-F10-10 / AC-F10-10: only an assigned operator sets maxWaiting (1..200 or null)", () => {
  test("valid values saved; invalid 400; customer 403 ROLE; operator2 403 QUEUE; no session 401", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const patch = (body: object, cookie?: string) => {
      const r = request(app).patch(`/api/queues/${b.id}`).send(body);
      return cookie ? r.set("Cookie", cookie) : r;
    };
    const set = await patch({ maxWaiting: 3 }, op1);
    expect(set.status).toBe(200);
    expect(set.body.queue).toMatchObject({ id: b.id, maxWaiting: 3 });
    const list = await request(app).get("/api/operator/queues").set("Cookie", op1);
    expect(list.body.queues.find((q: { id: number }) => q.id === b.id).maxWaiting).toBe(3);
    expect((await patch({ maxWaiting: null }, op1)).body.queue.maxWaiting).toBeNull();

    for (const bad of [0, 201, 1.5, "3", true]) {
      const res = await patch({ maxWaiting: bad }, op1);
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({ code: "VALIDATION_ERROR", message: "maxWaiting must be a whole number from 1 to 200, or null." });
    }
    expect((await patch({ maxWaiting: 3 }, await cookieOf(1))).body.error.code).toBe("FORBIDDEN_ROLE");
    expect((await patch({ maxWaiting: 3 }, await sessionCookie(prisma, "operator2@example.test"))).body.error.code).toBe("FORBIDDEN_QUEUE");
    expect((await patch({ maxWaiting: 3 })).status).toBe(401);
    expect((await prisma.queue.findUniqueOrThrow({ where: { id: b.id } })).maxWaiting).toBeNull();
  });

  test("the customer queue list carries maxWaiting next to waitingCount", async () => {
    await financeDesk(2, 2);
    const res = await request(app).get("/api/queues").set("Cookie", await cookieOf(3));
    expect(res.body.queues.find((q: { name: string }) => q.name === "Finance Desk")).toMatchObject({ waitingCount: 2, maxWaiting: 2 });
  });
});

describe("TEST-F07-04 / AC-F07-04: the public display says when a queue is full", () => {
  test("isFull false, then true after the last place is taken; no private keys", async () => {
    const b = await financeDesk(1, 0);
    expect((await request(app).get(`/api/queues/${b.id}/display`)).body.isFull).toBe(false);
    expect((await join(b.id, await cookieOf(1))).status).toBe(201);
    const res = await request(app).get(`/api/queues/${b.id}/display`);
    expect(res.body.isFull).toBe(true);
    expect(Object.keys(res.body).sort()).toEqual(["currentNumber", "currentStatus", "isFull", "isOpen", "queueId", "queueName", "waitingCount"]);
  });
});
