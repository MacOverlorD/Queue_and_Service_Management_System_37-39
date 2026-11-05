import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { Express } from "express";
import { createApp } from "../../src/app";
import { createSession } from "../../src/auth/session";
import { newPrisma, queueByName, resetAndSeed, userByEmail } from "../helpers";

let prisma: PrismaClient;
let app: Express;
beforeAll(async () => {
  prisma = newPrisma();
  app = createApp(prisma);
});
// Each test starts from the documented seed: A = Registrar Desk, B = Finance Desk (empty), C = Student Affairs (closed).
beforeEach(async () => {
  await resetAndSeed(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
});

// A session cookie for a user, created directly so tests do not depend on bcrypt timing.
async function cookieFor(email: string): Promise<string> {
  const user = await userByEmail(prisma, email);
  const session = await createSession(prisma, user.id);
  return `sid=${session.id}`;
}

async function writes(queueId: number) {
  const q = await prisma.queue.findUniqueOrThrow({ where: { id: queueId } });
  return {
    lastNumber: q.lastNumber,
    entries: await prisma.queueEntry.count({ where: { queueId } }),
    events: await prisma.entryEvent.count({ where: { entry: { queueId } } }),
  };
}

describe("TEST-F04-01 / AC-F04-01: list queues", () => {
  test("every queue with name, service, open flag and waiting count, no private data", async () => {
    const res = await request(app).get("/api/queues").set("Cookie", await cookieFor("customer1@example.test"));
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.queues.map((q: { name: string }) => [q.name, q]));
    expect(Object.keys(byName).sort()).toEqual(["Finance Desk", "Registrar Desk", "Student Affairs"]);
    expect(byName["Registrar Desk"]).toMatchObject({ isOpen: true, waitingCount: 2, serviceName: "Document requests" });
    expect(byName["Student Affairs"]).toMatchObject({ isOpen: false, waitingCount: 0 });
    expect(Object.keys(byName["Registrar Desk"]).sort()).toEqual(["id", "isOpen", "name", "serviceName", "waitingCount"]);
    expect(JSON.stringify(res.body)).not.toMatch(/customerId|email|entries/);
  });
});

describe("TEST-F04-02 / AC-F04-02: join an open queue", () => {
  test("201 WAITING entry numbered lastNumber + 1; entry, event and counter stored", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const c3 = await userByEmail(prisma, "customer3@example.test");
    const before = await writes(a.id);

    const res = await request(app).post(`/api/queues/${a.id}/entries`).set("Cookie", await cookieFor("customer3@example.test"));
    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({
      queueId: a.id,
      queueName: "Registrar Desk",
      number: before.lastNumber + 1,
      status: "WAITING",
      peopleAhead: 2,
    });

    expect(await writes(a.id)).toEqual({
      lastNumber: before.lastNumber + 1,
      entries: before.entries + 1,
      events: before.events + 1,
    });
    const event = await prisma.entryEvent.findFirstOrThrow({ where: { entryId: res.body.entry.id } });
    expect(event).toMatchObject({ fromStatus: null, toStatus: "WAITING", actorId: c3.id });
  });
});

describe("TEST-F04-03 / AC-F04-03: duplicate active entry", () => {
  test("second join is 409 DUPLICATE_ACTIVE_ENTRY and writes nothing", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const cookie = await cookieFor("customer3@example.test");
    await request(app).post(`/api/queues/${a.id}/entries`).set("Cookie", cookie).expect(201);
    const before = await writes(a.id);

    const res = await request(app).post(`/api/queues/${a.id}/entries`).set("Cookie", cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_ACTIVE_ENTRY");
    expect(await writes(a.id)).toEqual(before);
  });

  test("TEST-F04-03b: a CALLED entry still counts as active", async () => {
    // Seed: customer3 has the CALLED entry in closed queue C; reopen C so only BR-01 can reject.
    const c = await queueByName(prisma, "Student Affairs");
    await prisma.queue.update({ where: { id: c.id }, data: { isOpen: true } });
    const res = await request(app).post(`/api/queues/${c.id}/entries`).set("Cookie", await cookieFor("customer3@example.test"));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_ACTIVE_ENTRY");
  });
});

describe("TEST-F04-04 / AC-F04-04: rejoin after a final status", () => {
  test("a customer whose entry is COMPLETED gets a new, higher number", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const cookie = await cookieFor("customer3@example.test");
    const first = await request(app).post(`/api/queues/${a.id}/entries`).set("Cookie", cookie).expect(201);
    await prisma.queueEntry.update({ where: { id: first.body.entry.id }, data: { status: "COMPLETED" } });

    const again = await request(app).post(`/api/queues/${a.id}/entries`).set("Cookie", cookie);
    expect(again.status).toBe(201);
    expect(again.body.entry.number).toBeGreaterThan(first.body.entry.number);
  });
});

describe("TEST-F04-05 / AC-F04-05: closed, unknown and invalid queue", () => {
  test("409 QUEUE_CLOSED, 404 NOT_FOUND, 400 VALIDATION_ERROR; nothing written", async () => {
    const c = await queueByName(prisma, "Student Affairs");
    const cookie = await cookieFor("customer1@example.test");
    const before = { entries: await prisma.queueEntry.count(), events: await prisma.entryEvent.count(), c: await writes(c.id) };

    const closed = await request(app).post(`/api/queues/${c.id}/entries`).set("Cookie", cookie);
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe("QUEUE_CLOSED");

    const unknown = await request(app).post("/api/queues/9999/entries").set("Cookie", cookie);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("NOT_FOUND");

    for (const bad of ["abc", "0", "-1", "1.5"]) {
      const res = await request(app).post(`/api/queues/${bad}/entries`).set("Cookie", cookie);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect({ entries: await prisma.queueEntry.count(), events: await prisma.entryEvent.count(), c: await writes(c.id) }).toEqual(before);
  });
});

describe("TEST-F04-03c / AC-F04-03: only the active-entry index maps to 409 (review of #22)", () => {
  test("a ticket-number collision is a 500 INTERNAL_ERROR, not DUPLICATE_ACTIVE_ENTRY, and writes nothing", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    // Corrupt the counter so the next number (6) already exists in queue A.
    await prisma.queue.update({ where: { id: a.id }, data: { lastNumber: 5 } });
    const before = await writes(a.id);

    const res = await request(app).post(`/api/queues/${a.id}/entries`).set("Cookie", await cookieFor("customer3@example.test"));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(await writes(a.id)).toEqual(before);
  });
});

describe("TEST-F04-06 / AC-F04-06: concurrent joins (NFR-03)", () => {
  test("50 customers joining at once get 50 distinct consecutive numbers", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const hash = (await userByEmail(prisma, "customer1@example.test")).passwordHash;
    const cookies: string[] = [];
    for (let i = 0; i < 50; i++) {
      const u = await prisma.user.create({
        data: { name: `Load ${i}`, email: `load${i}@example.test`, passwordHash: hash, role: "CUSTOMER" },
      });
      cookies.push(`sid=${(await createSession(prisma, u.id)).id}`);
    }
    const n = b.lastNumber;

    const results = await Promise.all(
      cookies.map((cookie) => request(app).post(`/api/queues/${b.id}/entries`).set("Cookie", cookie)),
    );
    expect(results.map((r) => r.status)).toEqual(Array(50).fill(201));
    const numbers = results.map((r) => r.body.entry.number).sort((x, y) => x - y);
    expect(numbers).toEqual(Array.from({ length: 50 }, (_, i) => n + 1 + i));
    expect((await prisma.queue.findUniqueOrThrow({ where: { id: b.id } })).lastNumber).toBe(n + 50);
  }, 60_000);

  test("TEST-F04-06b: 10 simultaneous joins by one customer create exactly one entry", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const cookie = await cookieFor("customer4@example.test");
    const before = b.lastNumber;

    const results = await Promise.all(
      Array.from({ length: 10 }, () => request(app).post(`/api/queues/${b.id}/entries`).set("Cookie", cookie)),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, ...Array(9).fill(409)]);
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.error.code).toBe("DUPLICATE_ACTIVE_ENTRY");
    expect(await prisma.queueEntry.count({ where: { queueId: b.id } })).toBe(1);
    expect((await prisma.queue.findUniqueOrThrow({ where: { id: b.id } })).lastNumber).toBe(before + 1);
  }, 60_000);
});
