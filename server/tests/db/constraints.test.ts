import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { PrismaClient } from "@prisma/client";
import { newPrisma, queueByName, userByEmail } from "../helpers";

let prisma: PrismaClient;
beforeAll(() => {
  prisma = newPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
// Queue B (Finance Desk) has no seeded active entries, so tests use it and clean up.
afterEach(async () => {
  const b = await queueByName(prisma, "Finance Desk");
  await prisma.entryEvent.deleteMany({ where: { entry: { queueId: b.id } } });
  await prisma.queueEntry.deleteMany({ where: { queueId: b.id } });
});

describe("TEST-F01-03 / AC-F01-03: one active entry per customer per queue", () => {
  test("DB rejects a second active entry, allows a new one after a final status", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const c4 = await userByEmail(prisma, "customer4@example.test");
    const first = await prisma.queueEntry.create({
      data: { queueId: b.id, customerId: c4.id, number: 1, status: "WAITING" },
    });
    // Arrange: first active entry exists. Act + Assert: second active insert is rejected by the DB.
    await expect(
      prisma.queueEntry.create({
        data: { queueId: b.id, customerId: c4.id, number: 2, status: "WAITING" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await prisma.queueEntry.update({ where: { id: first.id }, data: { status: "COMPLETED" } });
    const again = await prisma.queueEntry.create({
      data: { queueId: b.id, customerId: c4.id, number: 2, status: "WAITING" },
    });
    expect(again.status).toBe("WAITING");
  });
});

describe("TEST-F01-04 / AC-F01-04: unique ticket number per queue", () => {
  test("DB rejects duplicate (queueId, number); same number in another queue is fine", async () => {
    const a = await queueByName(prisma, "Registrar Desk");
    const b = await queueByName(prisma, "Finance Desk");
    const c1 = await userByEmail(prisma, "customer1@example.test");
    const c2 = await userByEmail(prisma, "customer2@example.test");
    await prisma.queueEntry.create({
      data: { queueId: b.id, customerId: c1.id, number: 1, status: "WAITING" },
    });
    await expect(
      prisma.queueEntry.create({
        data: { queueId: b.id, customerId: c2.id, number: 1, status: "WAITING" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    // queue A already uses number 1 (seeded) while queue B also has number 1 above
    const existingInA = await prisma.queueEntry.findFirst({ where: { queueId: a.id, number: 1 } });
    expect(existingInA).not.toBeNull();
  });
});

describe("TEST-F01-06 / AC-F01-06: passwords are bcrypt hashes", () => {
  test("every seeded user stores a bcrypt hash, never the dev password", async () => {
    const users = await prisma.user.findMany();
    expect(users.length).toBeGreaterThanOrEqual(6);
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(u.passwordHash).not.toBe("DemoPass123!");
    }
  });
});
