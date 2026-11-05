import { afterAll, beforeAll, describe, expect, test } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { Express } from "express";
import { createApp } from "../../src/app";
import { newPrisma, resetAndSeed, userByEmail } from "../helpers";

const PASSWORD = process.env.SEED_PASSWORD ?? "DemoPass123!";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

let prisma: PrismaClient;
let app: Express;
beforeAll(async () => {
  prisma = newPrisma();
  await resetAndSeed(prisma);
  app = createApp(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
});

function sidFrom(res: request.Response): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith("sid="));
  return cookie?.split(";")[0].slice("sid=".length);
}

describe("TEST-F02-01 / AC-F02-01: valid login", () => {
  test("returns the user, sets an httpOnly SameSite=Lax cookie, stores an 8 h session", async () => {
    const user = await userByEmail(prisma, "customer1@example.test");
    const before = await prisma.session.count({ where: { userId: user.id } });

    for (const email of ["customer1@example.test", "Customer1@Example.TEST"]) {
      const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: { id: user.id, name: "Customer One", email: "customer1@example.test", role: "CUSTOMER" },
      });
      expect(JSON.stringify(res.body)).not.toContain("passwordHash");

      const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("sid="))!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const session = await prisma.session.findUniqueOrThrow({ where: { id: sidFrom(res)! } });
      expect(session.userId).toBe(user.id);
      expect(Math.abs(session.expiresAt.getTime() - (Date.now() + EIGHT_HOURS_MS))).toBeLessThan(60_000);
    }
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(before + 2);
  });
});

describe("TEST-F02-02 / AC-F02-02: wrong password", () => {
  test("401 INVALID_CREDENTIALS, no cookie, no session", async () => {
    const before = await prisma.session.count();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@example.test", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
    expect(sidFrom(res)).toBeUndefined();
    expect(await prisma.session.count()).toBe(before);
  });
});

describe("TEST-F02-03 / AC-F02-03: unknown email and bad bodies", () => {
  test("unknown email gives the same response as a wrong password", async () => {
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@example.test", password: "wrong-password" });
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.test", password: PASSWORD });
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);
    expect(sidFrom(unknown)).toBeUndefined();
  });

  test("missing or non-string fields give 400 VALIDATION_ERROR and no session", async () => {
    const before = await prisma.session.count();
    for (const body of [{}, { email: 1, password: true }, { email: "customer1@example.test" }, { email: "", password: "" }]) {
      const res = await request(app).post("/api/auth/login").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await prisma.session.count()).toBe(before);
  });
});

describe("TEST-F02-04 / AC-F02-04: current user", () => {
  test("returns the session owner, or 401 without a session", async () => {
    const operator = await userByEmail(prisma, "operator1@example.test");
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "operator1@example.test", password: PASSWORD }).expect(200);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      user: { id: operator.id, name: "Operator One", email: "operator1@example.test", role: "OPERATOR" },
    });

    const anon = await request(app).get("/api/auth/me");
    expect(anon.status).toBe(401);
    expect(anon.body).toEqual({ error: { code: "UNAUTHENTICATED", message: expect.any(String) } });
  });
});

describe("TEST-F02-05 / AC-F02-05: logout", () => {
  test("204, deletes the session, clears the cookie, old sid is rejected", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@example.test", password: PASSWORD });
    const sid = sidFrom(login)!;

    const out = await request(app).post("/api/auth/logout").set("Cookie", `sid=${sid}`);
    expect(out.status).toBe(204);
    const cleared = (out.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("sid="))!;
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    expect(await prisma.session.findUnique({ where: { id: sid } })).toBeNull();

    const me = await request(app).get("/api/auth/me").set("Cookie", `sid=${sid}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("UNAUTHENTICATED");
  });

  test("logout without a session is 401", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("TEST-F02-06 / AC-F02-06: expired session", () => {
  test("an expired session is rejected and deleted", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@example.test", password: PASSWORD });
    const sid = sidFrom(login)!;
    await prisma.session.update({ where: { id: sid }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const me = await request(app).get("/api/auth/me").set("Cookie", `sid=${sid}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("UNAUTHENTICATED");
    expect(await prisma.session.findUnique({ where: { id: sid } })).toBeNull();
  });
});
