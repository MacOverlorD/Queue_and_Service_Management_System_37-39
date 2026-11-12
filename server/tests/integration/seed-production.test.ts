import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const tsx = join(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const seed = join(__dirname, "../../prisma/seed.ts");

function runSeed(env: Record<string, string>) {
  return spawnSync(process.execPath, [tsx, seed], { env: { ...process.env, ...env }, encoding: "utf8" });
}

// Lab 5 (R-02): production must never fall back to the development demo password.
// Runs seed.ts as its own process (what the Cloud Run migration job does), because Vitest
// replaces process.env.NODE_ENV inside imported modules. SEED_PASSWORD is set to "" so a local
// server/.env (loaded by Prisma, absent on Cloud Run) cannot fill it in.
describe("TEST-L5-01: seed refuses to run in production without SEED_PASSWORD", () => {
  test("exits non-zero and names SEED_PASSWORD when it is empty", () => {
    const res = runSeed({ NODE_ENV: "production", SEED_PASSWORD: "" });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain("SEED_PASSWORD");
  });
});
