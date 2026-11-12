import { afterEach, describe, expect, test } from "vitest";
import { seedDatabase } from "../../prisma/seed";
import { newPrisma } from "../helpers";

// Lab 5 (R-02): production must never fall back to the development demo password.
describe("TEST-L5-01: seed refuses to run in production without SEED_PASSWORD", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, SEED_PASSWORD: process.env.SEED_PASSWORD };
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test("rejects before touching the database when SEED_PASSWORD is unset", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.SEED_PASSWORD;
    await expect(seedDatabase(newPrisma())).rejects.toThrow(/SEED_PASSWORD/);
  });
});
