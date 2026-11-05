import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://queue_dev:queue_dev_password@localhost:5432/queue_test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: TEST_DATABASE_URL },
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
