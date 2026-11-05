import { describe, expect, test } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("TEST-F01-07 / AC-F01-07: configuration is documented, no secret files tracked", () => {
  test("every process.env variable read by the server is listed in .env.example", () => {
    const example = readFileSync(join(root, ".env.example"), "utf8");
    const listed = new Set(
      example.split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split("=")[0]),
    );
    const files = [...sourceFiles(join(root, "server/src")), join(root, "server/prisma/seed.ts")];
    const used = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/process\.env\.([A-Z_]+)/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) expect(listed, `${name} missing from .env.example`).toContain(name);
  });

  test("no .env file is tracked by git", () => {
    const tracked = execSync("git ls-files", { cwd: root }).toString().split("\n");
    const envFiles = tracked.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".env.example"));
    expect(envFiles).toEqual([]);
  });
});
