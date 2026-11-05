import { afterAll, beforeAll, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed } from "../helpers";
import { sessionCookie } from "../authHelpers";

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let queueA: number;
let queueB: number;
let cookies: Record<string, string>;
const ids: Record<string, number> = {};

beforeAll(async () => {
  prisma = newPrisma();
  await resetAndSeed(prisma);
  app = createApp(prisma);
  queueA = (await queueByName(prisma, "Registrar Desk")).id;
  queueB = (await queueByName(prisma, "Finance Desk")).id;
  const entries = await prisma.queueEntry.findMany({ where: { queueId: queueA } });
  for (const en of entries) ids[`A${en.number}`] = en.id;
  cookies = {};
  for (const email of ["customer1", "customer2", "customer4", "operator1", "operator2"]) {
    cookies[email] = await sessionCookie(prisma, `${email}@example.test`);
  }
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Seed, queue A: #1 COMPLETED c1, #2 CANCELLED c2, #3 NO_SHOW c3, #4 SERVING c4, #5 WAITING c1, #6 WAITING c2.

describe("TEST-F05-01 / AC-F05-01: a customer sees only their own entries", () => {
  test("customer2 gets own entries with peopleAhead only for waiting ones", async () => {
    const res = await request(app).get("/api/me/entries").set("Cookie", cookies.customer2);
    expect(res.status).toBe(200);
    const byNumber = Object.fromEntries(res.body.entries.map((e: { number: number }) => [e.number, e]));
    expect(Object.keys(byNumber).sort()).toEqual(["2", "6"]);
    expect(byNumber[6]).toMatchObject({ queueId: queueA, queueName: "Registrar Desk", status: "WAITING", peopleAhead: 1 });
    expect(byNumber[2]).toMatchObject({ status: "CANCELLED", peopleAhead: null });
    expect(typeof byNumber[6].createdAt).toBe("string");
  });

  test("the head of the waiting line has peopleAhead 0", async () => {
    const res = await request(app).get("/api/me/entries").set("Cookie", cookies.customer1);
    const waiting = res.body.entries.find((e: { status: string }) => e.status === "WAITING");
    expect(waiting).toMatchObject({ number: 5, peopleAhead: 0 });
  });

  test("status=active returns only waiting, called and serving entries; a customer with none gets an empty list", async () => {
    const active = await request(app).get("/api/me/entries?status=active").set("Cookie", cookies.customer1);
    expect(active.body.entries.map((e: { status: string }) => e.status)).toEqual(["WAITING"]);
    const customer3 = await sessionCookie(prisma, "customer3@example.test");
    const none = await request(app).get("/api/me/entries?status=active").set("Cookie", customer3);
    expect(none.status).toBe(200);
    expect(none.body.entries.map((e: { queueName: string }) => e.queueName)).toEqual(["Student Affairs"]);
    const empty = await request(app).get("/api/me/entries").set("Cookie", await sessionCookie(prisma, "customer4@example.test"));
    expect(empty.body.entries.every((e: { status: string }) => e.status === "SERVING")).toBe(true);
  });

  test("GET /api/me/entries/:id returns one own entry", async () => {
    const res = await request(app).get(`/api/me/entries/${ids.A5}`).set("Cookie", cookies.customer1);
    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ id: ids.A5, number: 5, status: "WAITING", peopleAhead: 0 });
  });
});

describe("TEST-F05-02 / AC-F05-02: another customer's entry is not visible", () => {
  test("another customer's id, a missing id and a malformed id all give the same 404", async () => {
    const other = await request(app).get(`/api/me/entries/${ids.A6}`).set("Cookie", cookies.customer1);
    const missing = await request(app).get("/api/me/entries/999999").set("Cookie", cookies.customer1);
    const malformed = await request(app).get("/api/me/entries/abc").set("Cookie", cookies.customer1);
    for (const res of [other, missing, malformed]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
    }
    expect(other.body).toEqual(missing.body);
    expect(JSON.stringify(other.body)).not.toMatch(/Customer Two|number|status|queueName/);
  });
});

describe("TEST-F05-03 / AC-F05-03: operator sees the active entries of an assigned queue", () => {
  test("operator1 on queue A gets WAITING, WAITING and SERVING sorted by number; final statuses are excluded", async () => {
    const res = await request(app).get(`/api/queues/${queueA}/entries`).set("Cookie", cookies.operator1);
    expect(res.status).toBe(200);
    expect(res.body.queue).toEqual({ id: queueA, name: "Registrar Desk", isOpen: true });
    expect(res.body.entries.map((e: { number: number; status: string }) => [e.number, e.status])).toEqual([
      [4, "SERVING"],
      [5, "WAITING"],
      [6, "WAITING"],
    ]);
    expect(res.body.entries[0]).toMatchObject({ id: ids.A4, customerName: "Customer Four" });
  });

  test("a queue with no active entries returns an empty list", async () => {
    const res = await request(app).get(`/api/queues/${queueB}/entries`).set("Cookie", cookies.operator1);
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
    expect(res.body.queue.name).toBe("Finance Desk");
  });
});

describe("TEST-F05-04 / AC-F05-04: an unassigned operator gets nothing", () => {
  test("operator2 gets 403 FORBIDDEN_QUEUE and no entries field", async () => {
    const res = await request(app).get(`/api/queues/${queueA}/entries`).set("Cookie", cookies.operator2);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_QUEUE");
    expect(res.body.entries).toBeUndefined();
  });
});

describe("TEST-F05-05 / AC-F05-05: no email or password hash in any response", () => {
  test("responses contain neither passwordHash nor an email address", async () => {
    const responses = [
      await request(app).get("/api/me/entries").set("Cookie", cookies.customer1),
      await request(app).get(`/api/me/entries/${ids.A5}`).set("Cookie", cookies.customer1),
      await request(app).get(`/api/queues/${queueA}/entries`).set("Cookie", cookies.operator1),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|email|@example\.test/);
    }
  });

  test("a customer never receives another customer's entries in the list", async () => {
    const res = await request(app).get("/api/me/entries").set("Cookie", cookies.customer4);
    const numbersAndQueues = res.body.entries.map((e: { queueId: number; number: number }) => `${e.queueId}:${e.number}`);
    expect(numbersAndQueues).toEqual([`${queueA}:4`]);
  });
});
