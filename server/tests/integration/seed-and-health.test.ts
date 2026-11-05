import { afterAll, beforeAll, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app";
import { seedDatabase } from "../../prisma/seed";
import { newPrisma, queueByName } from "../helpers";

let prisma: PrismaClient;
beforeAll(() => {
  prisma = newPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function counts() {
  return {
    users: await prisma.user.count(),
    queues: await prisma.queue.count(),
    assignments: await prisma.operatorQueue.count(),
    entries: await prisma.queueEntry.count(),
    events: await prisma.entryEvent.count(),
  };
}

describe("TEST-F01-01 / AC-F01-01: migrated and seeded DB serves health", () => {
  test("GET /api/health returns ok and the seed is present", async () => {
    const res = await request(createApp(prisma)).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "up" });
    const c = await counts();
    expect(c.users).toBe(6);
    expect(c.queues).toBe(3);
    expect(c.assignments).toBe(3);
  });
});

describe("TEST-F01-02 / AC-F01-02: seed is rerunnable and covers every status", () => {
  test("running the seed twice changes nothing", async () => {
    const before = await counts();
    await seedDatabase(prisma);
    await seedDatabase(prisma);
    expect(await counts()).toEqual(before);
  });

  test("all six statuses exist, BR-05 holds, queue B has no active entries", async () => {
    const statuses = new Set((await prisma.queueEntry.findMany()).map((e) => e.status));
    for (const s of ["WAITING", "CALLED", "SERVING", "COMPLETED", "CANCELLED", "NO_SHOW"]) {
      expect(statuses.has(s as never)).toBe(true);
    }
    for (const q of await prisma.queue.findMany()) {
      const live = await prisma.queueEntry.count({
        where: { queueId: q.id, status: { in: ["CALLED", "SERVING"] } },
      });
      expect(live).toBeLessThanOrEqual(1);
    }
    const b = await queueByName(prisma, "Finance Desk");
    const active = await prisma.queueEntry.count({
      where: { queueId: b.id, status: { in: ["WAITING", "CALLED", "SERVING"] } },
    });
    expect(active).toBe(0);
    const a = await queueByName(prisma, "Registrar Desk");
    const maxA = await prisma.queueEntry.aggregate({ where: { queueId: a.id }, _max: { number: true } });
    expect(a.lastNumber).toBe(maxA._max.number);
  });
});

describe("TEST-F01-05 / AC-F01-05: data survives an app restart", () => {
  test("an entry written before a restart is readable by a new client and app", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const customer = await prisma.user.findUniqueOrThrow({ where: { email: "customer4@example.test" } });
    const created = await prisma.queueEntry.create({
      data: { queueId: b.id, customerId: customer.id, number: 1, status: "WAITING" },
    });
    await prisma.$disconnect();

    const restarted = newPrisma();
    try {
      const res = await request(createApp(restarted)).get("/api/health");
      expect(res.status).toBe(200);
      const found = await restarted.queueEntry.findUnique({ where: { id: created.id } });
      expect(found?.number).toBe(1);
      await restarted.queueEntry.delete({ where: { id: created.id } });
    } finally {
      await restarted.$disconnect();
    }
    prisma = newPrisma();
  });
});
