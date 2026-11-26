import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { Express } from "express";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed } from "../helpers";
import { sessionCookie } from "../authHelpers";

// F-10 contract: docs/sprints/sprint-2/f-10-queue-control-console.md
// Seed: A = Registrar Desk and B = Finance Desk (operator1), C = Student Affairs (operator2, closed). State changes use B.
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

const patch = (id: number | string, body: unknown, cookie?: string) => {
  const r = request(app).patch(`/api/queues/${id}`).send(body as object);
  return cookie ? r.set("Cookie", cookie) : r;
};
const post = (path: string, cookie: string) => request(app).post(path).set("Cookie", cookie);
const queueRow = async (id: number) => prisma.queue.findUniqueOrThrow({ where: { id } });

describe("TEST-F10-01 / AC-F10-01: an assigned operator closes a queue", () => {
  test("200 isOpen false; a join is then refused with QUEUE_CLOSED and uses no number", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const res = await patch(b.id, { isOpen: false }, op1);
    expect(res.status).toBe(200);
    // Revised for CR-01 (Lab 7): the PATCH response also carries maxWaiting.
    expect(res.body).toEqual({ queue: { id: b.id, name: "Finance Desk", isOpen: false, maxWaiting: null } });

    const join = await post(`/api/queues/${b.id}/entries`, c3);
    expect(join.status).toBe(409);
    expect(join.body.error.code).toBe("QUEUE_CLOSED");
    expect((await queueRow(b.id)).lastNumber).toBe(b.lastNumber);
  });
});

describe("TEST-F10-02 / AC-F10-02: an assigned operator reopens a queue", () => {
  test("200 isOpen true; a customer can join again", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    await prisma.queue.update({ where: { id: b.id }, data: { isOpen: false } });
    const res = await patch(b.id, { isOpen: true }, op1);
    expect(res.status).toBe(200);
    expect(res.body.queue.isOpen).toBe(true);
    expect((await post(`/api/queues/${b.id}/entries`, c3)).status).toBe(201);
  });
});

describe("TEST-F10-03 / AC-F10-03: closing keeps the entries workable", () => {
  test("call-next, start, complete and a customer cancel still work in a closed queue", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const c4 = await sessionCookie(prisma, "customer4@example.test");
    const first = await post(`/api/queues/${b.id}/entries`, c3);
    const second = await post(`/api/queues/${b.id}/entries`, c4);
    expect((await patch(b.id, { isOpen: false }, op1)).status).toBe(200);

    const called = await post(`/api/queues/${b.id}/call-next`, op1);
    expect(called.status).toBe(200);
    expect(called.body.entry.id).toBe(first.body.entry.id);
    expect((await post(`/api/entries/${first.body.entry.id}/start`, op1)).status).toBe(200);
    expect((await post(`/api/entries/${first.body.entry.id}/complete`, op1)).status).toBe(200);
    expect((await post(`/api/me/entries/${second.body.entry.id}/cancel`, c4)).status).toBe(200);
    expect((await queueRow(b.id)).isOpen).toBe(false);
  });
});

describe("TEST-F10-04 / AC-F10-04: only an assigned operator may open or close", () => {
  test("customer 403 FORBIDDEN_ROLE; other operator, unknown and malformed id 403 FORBIDDEN_QUEUE; no session 401", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const asCustomer = await patch(b.id, { isOpen: false }, c1);
    expect(asCustomer.status).toBe(403);
    expect(asCustomer.body.error.code).toBe("FORBIDDEN_ROLE");
    for (const id of [b.id, 999999, "abc"]) {
      const res = await patch(id, { isOpen: false }, op2);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_QUEUE");
    }
    const anonymous = await patch(b.id, { isOpen: false });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
    expect((await queueRow(b.id)).isOpen).toBe(true);
  });
});

describe("TEST-F10-05 / AC-F10-05: the body must be exactly { isOpen: boolean }", () => {
  test("missing, string, null and extra fields give 400 VALIDATION_ERROR and change nothing", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    for (const body of [{}, { isOpen: "false" }, { isOpen: null }, { isOpen: false, name: "X" }]) {
      const res = await patch(b.id, body, op1);
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({ code: "VALIDATION_ERROR", message: "isOpen must be true or false." });
    }
    const row = await queueRow(b.id);
    expect(row.isOpen).toBe(true);
    expect(row.name).toBe("Finance Desk");
  });
});

describe("TEST-F10-06 / AC-F10-06: setting the current value is a no-op", () => {
  test("200 and the queue row is unchanged", async () => {
    const b = await queueByName(prisma, "Finance Desk");
    const before = await queueRow(b.id);
    const res = await patch(b.id, { isOpen: true }, op1);
    expect(res.status).toBe(200);
    expect(res.body.queue.isOpen).toBe(true);
    expect(await queueRow(b.id)).toEqual(before);
  });
});
