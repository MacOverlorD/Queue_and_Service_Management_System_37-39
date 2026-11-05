import { afterAll, beforeAll, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app";
import { newPrisma, queueByName, resetAndSeed } from "../helpers";
import { sessionCookie, snapshotEntries } from "../authHelpers";

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let queueA: number;
let entryInA: number;
let cookies: { customer1: string; operator1: string; operator2: string };

beforeAll(async () => {
  prisma = newPrisma();
  await resetAndSeed(prisma);
  app = createApp(prisma);
  queueA = (await queueByName(prisma, "Registrar Desk")).id;
  entryInA = (await prisma.queueEntry.findFirstOrThrow({ where: { queueId: queueA } })).id;
  cookies = {
    customer1: await sessionCookie(prisma, "customer1@example.test"),
    operator1: await sessionCookie(prisma, "operator1@example.test"),
    operator2: await sessionCookie(prisma, "operator2@example.test"),
  };
});
afterAll(async () => {
  await prisma.$disconnect();
});

type Method = "get" | "post";
type Route = { method: Method; path: () => string };
const q = () => queueA;
const e = () => entryInA;

// Independent oracle: the route permission matrix of the F-03 contract (section 3).
const customerOnly: Route[] = [
  { method: "get", path: () => "/api/queues" },
  { method: "post", path: () => `/api/queues/${q()}/entries` },
  { method: "get", path: () => "/api/me/entries" },
  { method: "get", path: () => `/api/me/entries/${e()}` },
];
const operatorOnly: Route[] = [{ method: "get", path: () => "/api/operator/queues" }];
const operatorQueueScoped: Route[] = [
  { method: "get", path: () => `/api/queues/${q()}/entries` },
  { method: "post", path: () => `/api/queues/${q()}/call-next` },
  { method: "post", path: () => `/api/entries/${e()}/start` },
  { method: "post", path: () => `/api/entries/${e()}/complete` },
];
const loggedInOnly: Route[] = [
  { method: "post", path: () => "/api/auth/logout" },
  { method: "get", path: () => "/api/auth/me" },
];
const allProtected = [...customerOnly, ...operatorOnly, ...operatorQueueScoped, ...loggedInOnly];

function expectErrorShape(body: unknown, code: string) {
  expect(body).toEqual({ error: { code, message: expect.any(String) } });
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/passwordHash|customerId|@example\.test|"entries"|"entry"/);
}

describe("TEST-F03-01 / AC-F03-01: every protected route returns 401 without a valid session", () => {
  test.each(allProtected.map((r, i) => [i, r] as const))("no cookie, route #%i", async (_i, route) => {
    const res = await request(app)[route.method](route.path());
    expect(res.status).toBe(401);
    expectErrorShape(res.body, "UNAUTHENTICATED");
  });

  test("an expired session cookie is also 401", async () => {
    const expired = await sessionCookie(prisma, "customer1@example.test", { expiresInMs: -60_000 });
    const res = await request(app).get("/api/me/entries").set("Cookie", expired);
    expect(res.status).toBe(401);
    expectErrorShape(res.body, "UNAUTHENTICATED");
  });
});

describe("TEST-F03-02 / AC-F03-02: a customer cannot use operator routes", () => {
  test("customer1 gets 403 FORBIDDEN_ROLE and nothing changes", async () => {
    const before = await snapshotEntries(prisma);
    for (const route of [...operatorQueueScoped, ...operatorOnly]) {
      const res = await request(app)[route.method](route.path()).set("Cookie", cookies.customer1);
      expect(res.status, `${route.method} ${route.path()}`).toBe(403);
      expectErrorShape(res.body, "FORBIDDEN_ROLE");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });
});

describe("TEST-F03-03 / AC-F03-03: an operator cannot act on a queue not assigned to them", () => {
  test("operator2 (assigned to queue C only) gets 403 FORBIDDEN_QUEUE on queue A routes", async () => {
    const before = await snapshotEntries(prisma);
    for (const route of operatorQueueScoped) {
      const res = await request(app)[route.method](route.path()).set("Cookie", cookies.operator2);
      expect(res.status, `${route.method} ${route.path()}`).toBe(403);
      expectErrorShape(res.body, "FORBIDDEN_QUEUE");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });

  test("unknown or malformed ids also give 403 FORBIDDEN_QUEUE so existence is not leaked", async () => {
    for (const path of ["/api/queues/999999/entries", "/api/queues/abc/entries"]) {
      const res = await request(app).get(path).set("Cookie", cookies.operator1);
      expect(res.status, path).toBe(403);
      expectErrorShape(res.body, "FORBIDDEN_QUEUE");
    }
    const res = await request(app).post("/api/entries/999999/start").set("Cookie", cookies.operator1);
    expect(res.status).toBe(403);
    expectErrorShape(res.body, "FORBIDDEN_QUEUE");
  });

  test("the assigned operator passes the guard (not 401 or 403)", async () => {
    for (const route of operatorQueueScoped) {
      const res = await request(app)[route.method](route.path()).set("Cookie", cookies.operator1);
      expect([401, 403], `${route.method} ${route.path()}`).not.toContain(res.status);
    }
    const own = await request(app).get("/api/operator/queues").set("Cookie", cookies.operator2);
    expect([401, 403]).not.toContain(own.status);
  });
});

describe("TEST-F03-04 / AC-F03-04: an operator cannot use customer-only routes", () => {
  test("operator1 gets 403 FORBIDDEN_ROLE and no entry is created", async () => {
    const before = await snapshotEntries(prisma);
    for (const route of customerOnly) {
      const res = await request(app)[route.method](route.path()).set("Cookie", cookies.operator1);
      expect(res.status, `${route.method} ${route.path()}`).toBe(403);
      expectErrorShape(res.body, "FORBIDDEN_ROLE");
    }
    expect(await snapshotEntries(prisma)).toEqual(before);
  });

  test("a customer passes the guard on customer-only routes (not 401 or 403)", async () => {
    for (const route of customerOnly) {
      const res = await request(app)[route.method](route.path()).set("Cookie", cookies.customer1);
      expect([401, 403], `${route.method} ${route.path()}`).not.toContain(res.status);
    }
  });
});

describe("TEST-F03-05 / AC-F03-05: error bodies use the shared shape and leak nothing", () => {
  test("401 and 403 bodies contain only error.code and error.message", async () => {
    const cases = [
      await request(app).get("/api/me/entries"),
      await request(app).get(`/api/queues/${q()}/entries`).set("Cookie", cookies.customer1),
      await request(app).get(`/api/queues/${q()}/entries`).set("Cookie", cookies.operator2),
    ];
    for (const res of cases) {
      expect([401, 403]).toContain(res.status);
      expect(Object.keys(res.body)).toEqual(["error"]);
      expect(Object.keys(res.body.error).sort()).toEqual(["code", "message"]);
    }
  });
});
