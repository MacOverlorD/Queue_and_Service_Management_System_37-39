import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, test } from "vitest";
import { createApp } from "../../src/app";
import { newPrisma } from "../helpers";

// Lab 5 (R-01, R-03): one container serves the API and the built client on one origin.
describe("TEST-L5-02: the server serves the built client", () => {
  const dist = mkdtempSync(join(tmpdir(), "client-dist-"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><html><body>QMS</body></html>");
  const app = createApp(newPrisma(), dist);

  test("GET / returns index.html", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("QMS");
  });

  test("a client route falls back to index.html", async () => {
    const res = await request(app).get("/queues/1");
    expect(res.status).toBe(200);
    expect(res.text).toContain("QMS");
  });

  test("an unknown /api path is not answered with the HTML page", async () => {
    const res = await request(app).get("/api/no-such-route");
    expect(res.text).not.toContain("QMS");
  });

  test("API routes still work", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("deliberately-wrong");
  });
});
