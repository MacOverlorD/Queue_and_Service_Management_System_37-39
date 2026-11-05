import { execSync } from "node:child_process";

// Reset the test database, apply migrations, then seed it (TEST-F01-01 precondition).
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://queue_dev:queue_dev_password@localhost:5432/queue_test";
  const env = { ...process.env, DATABASE_URL: url };
  const run = (cmd: string) => execSync(cmd, { cwd: __dirname + "/..", env, stdio: "inherit" });
  run("npx prisma migrate reset --force --skip-generate --skip-seed");
  run("npx prisma generate");
  run("npx tsx prisma/seed.ts");
}
