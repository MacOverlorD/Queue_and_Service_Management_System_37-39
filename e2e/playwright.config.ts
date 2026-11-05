import { defineConfig } from "@playwright/test";

// End-to-end journeys run against their own API, client and the queue_test database.
const API_PORT = 3100;
const CLIENT_PORT = 5273;
const TEST_DB =
  process.env.TEST_DATABASE_URL ?? "postgresql://queue_dev:queue_dev_password@localhost:5432/queue_test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: [["list"]],
  globalSetup: "./global-setup.ts",
  use: { baseURL: `http://localhost:${CLIENT_PORT}`, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "../server",
      port: API_PORT,
      reuseExistingServer: false,
      env: { DATABASE_URL: TEST_DB, PORT: String(API_PORT), CLIENT_ORIGIN: `http://localhost:${CLIENT_PORT}` },
    },
    {
      command: `npx vite --port ${CLIENT_PORT} --strictPort`,
      cwd: "../client",
      port: CLIENT_PORT,
      reuseExistingServer: false,
      env: { VITE_API_PROXY: `http://localhost:${API_PORT}`, VITE_REFRESH_MS: "1500" },
    },
  ],
});
