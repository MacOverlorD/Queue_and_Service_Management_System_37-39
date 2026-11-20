import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, test } from "vitest";
import { createApp } from "../../src/app";
import { newPrisma } from "../helpers";

// Lab 6 UAT finding #58: an unknown /api route must use the shared error shape
// { error: { code, message } } (Sprint 1 shared conventions), not Express's HTML page.
describe("TEST-L6-58: unknown /api routes return the JSON 404 error", () => {
  const dist = mkdtempSync(join(tmpdir(), "client-dist-"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><html><body>QMS</body></html>");

  for (const [label, app] of [
    ["without the built client", createApp(newPrisma(), join(tmpdir(), "no-client-dist"))],
    ["with the built client", createApp(newPrisma(), dist)],
  ] as const) {
    test(`GET /api/does-not-exist → 404 NOT_FOUND JSON (${label})`, async () => {
      const res = await request(app).get("/api/does-not-exist");
      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
    });

    test(`POST /api/does-not-exist → 404 NOT_FOUND JSON (${label})`, async () => {
      const res = await request(app).post("/api/does-not-exist").send({});
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
    });
  }

  test("known routes are unchanged: GET /api/health still answers", async () => {
    const res = await request(createApp(newPrisma(), dist)).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
