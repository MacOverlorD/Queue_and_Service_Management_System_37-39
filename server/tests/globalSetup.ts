import { execSync } from "node:child_process";

// Apply migrations to the test database (non-destructive) and generate the client.
// Each test file then resets and reseeds its own data with resetAndSeed().
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://queue_dev:queue_dev_password@localhost:5432/queue_test";
  const env = { ...process.env, DATABASE_URL: url };
  const run = (cmd: string) => execSync(cmd, { cwd: __dirname + "/..", env, stdio: "inherit" });
  run("npx prisma migrate deploy");
  run("npx prisma generate");
}
