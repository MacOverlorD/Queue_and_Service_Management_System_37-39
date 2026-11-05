import { afterAll, beforeAll, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed } from "../helpers";
import { sessionCookie } from "../authHelpers";

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let ids: { a: number; b: number; c: number };

beforeAll(async () => {
  prisma = newPrisma();
  await resetAndSeed(prisma);
  app = createApp(prisma);
  ids = {
    a: (await queueByName(prisma, "Registrar Desk")).id,
    b: (await queueByName(prisma, "Finance Desk")).id,
    c: (await queueByName(prisma, "Student Affairs")).id,
  };
});
afterAll(async () => {
  await prisma.$disconnect();
});

const KEYS = ["currentNumber", "currentStatus", "isOpen", "queueId", "queueName", "waitingCount"];

// Seed: A has SERVING #4 and WAITING #5 #6; B is empty; C is closed with CALLED #1.
describe("TEST-F07-01 / AC-F07-01: public display without a session", () => {
  test("queue with a serving entry shows its number, status and waiting count", async () => {
    const res = await request(app).get(`/api/queues/${ids.a}/display`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      queueId: ids.a,
      queueName: "Registrar Desk",
      isOpen: true,
      currentNumber: 4,
      currentStatus: "SERVING",
      waitingCount: 2,
    });
  });

  test("an empty queue has null current fields and waitingCount 0", async () => {
    const res = await request(app).get(`/api/queues/${ids.b}/display`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      queueId: ids.b,
      queueName: "Finance Desk",
      isOpen: true,
      currentNumber: null,
      currentStatus: null,
      waitingCount: 0,
    });
  });

  test("a closed queue still shows its called entry", async () => {
    const res = await request(app).get(`/api/queues/${ids.c}/display`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isOpen: false, currentNumber: 1, currentStatus: "CALLED", waitingCount: 0 });
  });

  test("works the same for a logged-in user (public, not login-only)", async () => {
    const cookie = await sessionCookie(prisma, "customer1@example.test");
    const res = await request(app).get(`/api/queues/${ids.a}/display`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.currentNumber).toBe(4);
  });
});

describe("TEST-F07-02 / AC-F07-02: no private data", () => {
  test("response keys are exactly the contract keys and no customer data appears", async () => {
    for (const id of [ids.a, ids.b, ids.c]) {
      const res = await request(app).get(`/api/queues/${id}/display`);
      expect(Object.keys(res.body).sort()).toEqual(KEYS);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/Customer|Operator|@example\.test|customerId|entryId|passwordHash/);
    }
  });
});

describe("TEST-F07-03 / AC-F07-03: unknown queue", () => {
  test("unknown and malformed ids give 404 NOT_FOUND in the shared error shape", async () => {
    for (const id of ["9999", "abc", "0", "-1"]) {
      const res = await request(app).get(`/api/queues/${id}/display`);
      expect(res.status, id).toBe(404);
      expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
    }
  });
});
