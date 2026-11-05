import { execSync } from "node:child_process";
import { resolve } from "node:path";

// Resets and seeds queue_test (plus customer5). Used once before the suite and by spec files
// that change shared queues and need the documented seed state.
export function resetDb(): void {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://queue_dev:queue_dev_password@localhost:5432/queue_test";
  execSync("npx tsx scripts/reset-test-db.ts", {
    cwd: resolve(__dirname, "../server"),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
