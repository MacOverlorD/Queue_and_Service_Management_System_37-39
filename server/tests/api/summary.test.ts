import { afterAll, beforeAll, describe, expect, test } from "vitest";
import request from "supertest";
import { EntryStatus, PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed, userByEmail } from "../helpers";
import { sessionCookie } from "../authHelpers";

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let ids: { a: number; b: number; c: number };
let operator1: number;
let customers: number[];
let nextNumber = 100;

beforeAll(async () => {
  prisma = newPrisma();
  await resetAndSeed(prisma);
  app = createApp(prisma);
  ids = {
    a: (await queueByName(prisma, "Registrar Desk")).id,
    b: (await queueByName(prisma, "Finance Desk")).id,
    c: (await queueByName(prisma, "Student Affairs")).id,
  };
  operator1 = (await userByEmail(prisma, "operator1@example.test")).id;
  customers = await Promise.all(
    [1, 2, 3, 4].map(async (n) => (await userByEmail(prisma, `customer${n}@example.test`)).id),
  );
});
afterAll(async () => {
  await prisma.$disconnect();
});

// One entry that joined at `joined` and has one history event to `to` at `at` (ISO strings with +07:00).
async function entryWithEvent(queueId: number, to: EntryStatus, at: string, joined = at) {
  const entry = await prisma.queueEntry.create({
    data: {
      queueId,
      customerId: customers[nextNumber % customers.length],
      number: nextNumber++,
      status: to, // final statuses are not limited by the active-entry index (D-13)
      createdAt: new Date(joined),
    },
  });
  await prisma.entryEvent.create({
    data: { entryId: entry.id, fromStatus: null, toStatus: to, actorId: operator1, at: new Date(at) },
  });
}

async function summary(queueId: number | string, date?: string, who = "operator1@example.test") {
  const cookie = await sessionCookie(prisma, who);
  const url = `/api/queues/${queueId}/summary${date === undefined ? "" : `?date=${date}`}`;
  return request(app).get(url).set("Cookie", cookie);
}

describe("TEST-F13-01 / AC-F13-01: counts per status for a day", () => {
  test("served, cancelled and no-show come from that day's events", async () => {
    const day = "2026-10-01";
    for (let i = 0; i < 3; i++) await entryWithEvent(ids.b, "COMPLETED", `${day}T10:0${i}:00+07:00`);
    for (let i = 0; i < 2; i++) await entryWithEvent(ids.b, "CANCELLED", `${day}T11:0${i}:00+07:00`);
    await entryWithEvent(ids.b, "NO_SHOW", `${day}T12:00:00+07:00`);
    const res = await summary(ids.b, day);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      queueId: ids.b,
      queueName: "Finance Desk",
      date: day,
      served: 3,
      cancelled: 2,
      noShow: 1,
    });
  });
});

describe("TEST-F13-02 / AC-F13-02: average waiting time", () => {
  test("mean of called time minus join time, in whole seconds", async () => {
    const joined = "2026-10-02T09:00:00+07:00";
    await entryWithEvent(ids.b, "CALLED", "2026-10-02T09:02:00+07:00", joined);
    await entryWithEvent(ids.b, "CALLED", "2026-10-02T09:05:00+07:00", joined);
    const res = await summary(ids.b, "2026-10-02");
    expect(res.status).toBe(200);
    expect(res.body.called).toBe(2);
    expect(res.body.averageWaitSeconds).toBe(210);
  });
});

describe("TEST-F13-03 / AC-F13-03: Bangkok day boundary", () => {
  test("23:59:59 belongs to the day, 00:00:00 to the next day", async () => {
    await entryWithEvent(ids.b, "COMPLETED", "2026-10-03T23:59:59+07:00");
    await entryWithEvent(ids.b, "COMPLETED", "2026-10-04T00:00:00+07:00");
    expect((await summary(ids.b, "2026-10-03")).body.served).toBe(1);
    expect((await summary(ids.b, "2026-10-04")).body.served).toBe(1);
  });
});

describe("TEST-F13-04 / AC-F13-04: empty day", () => {
  test("zeros and a null average", async () => {
    const res = await summary(ids.b, "2026-01-01");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      served: 0,
      cancelled: 0,
      noShow: 0,
      called: 0,
      averageWaitSeconds: null,
    });
  });
});

describe("TEST-F13-05 / AC-F13-05: other queues are not counted", () => {
  test("events on A do not appear in B's summary", async () => {
    const day = "2026-10-05";
    await entryWithEvent(ids.b, "COMPLETED", `${day}T10:00:00+07:00`);
    await entryWithEvent(ids.a, "COMPLETED", `${day}T10:00:00+07:00`);
    await entryWithEvent(ids.a, "CANCELLED", `${day}T10:30:00+07:00`);
    await entryWithEvent(ids.c, "NO_SHOW", `${day}T11:00:00+07:00`);
    const res = await summary(ids.b, day);
    expect(res.body).toMatchObject({ served: 1, cancelled: 0, noShow: 0 });
  });
});

describe("TEST-F13-06 / AC-F13-06: who may read a summary", () => {
  test("no session gets 401", async () => {
    const res = await request(app).get(`/api/queues/${ids.b}/summary?date=2026-10-05`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  test("a customer gets 403 FORBIDDEN_ROLE", async () => {
    const res = await summary(ids.b, "2026-10-05", "customer1@example.test");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  test("an operator not assigned to the queue gets 403 FORBIDDEN_QUEUE", async () => {
    const res = await summary(ids.b, "2026-10-05", "operator2@example.test");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_QUEUE");
  });

  test("an unknown or malformed queue id also gets 403 FORBIDDEN_QUEUE", async () => {
    for (const id of ["9999", "abc"]) {
      const res = await summary(id, "2026-10-05");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_QUEUE");
    }
  });
});

describe("TEST-F13-07 / AC-F13-07: date validation", () => {
  test.each([undefined, "20-11-2026", "2026-13-01", "2026-02-30"])("date %s gets 400 VALIDATION_ERROR", async (date) => {
    const res = await summary(ids.b, date);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
