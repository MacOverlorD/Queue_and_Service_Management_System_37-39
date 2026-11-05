import { execSync } from "node:child_process";
import { resolve } from "node:path";

// Reset and seed the test database before the browsers start.
export default function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://queue_dev:queue_dev_password@localhost:5432/queue_test";
  execSync("npx tsx scripts/reset-test-db.ts", {
    cwd: resolve(__dirname, "../server"),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
