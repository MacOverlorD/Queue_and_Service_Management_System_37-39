import { APIRequestContext, expect, Page, test } from "@playwright/test";
import { resetDb } from "../reset-db";

// F-09 contract: docs/sprints/sprint-2/f-09-cancel-no-show.md (TEST-F09-12, TEST-F09-13).
const PASSWORD = "DemoPass123!";
const API = "http://localhost:3100";

test.beforeAll(() => resetDb());
// customer.spec.ts runs next and expects the documented seed (customer4 has no entry in B), so leave it clean.
test.afterAll(() => resetDb());

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(queues|operator)$/);
}

async function customerJoins(request: APIRequestContext, email: string, queueName: string) {
  expect((await request.post(`${API}/api/auth/login`, { data: { email, password: PASSWORD } })).ok()).toBeTruthy();
  const { queues } = await (await request.get(`${API}/api/queues`)).json();
  const queue = queues.find((q: { name: string }) => q.name === queueName);
  const joined = await request.post(`${API}/api/queues/${queue.id}/entries`);
  expect(joined.status()).toBe(201);
  return (await joined.json()).entry as { id: number; number: number };
}

test("TEST-F09-12 / AC-F09-11: customer cancels a waiting ticket, then can join again", async ({ page }) => {
  await login(page, "customer3@example.test");
  const finance = page.getByRole("listitem").filter({ hasText: "Finance Desk" });
  await finance.getByRole("button", { name: "Join" }).click();
  await page.waitForURL(/\/my-ticket$/);

  const ticket = page.getByRole("listitem").filter({ hasText: "Finance Desk" });
  await expect(ticket).toContainText("Ticket #1");
  await ticket.getByRole("button", { name: "Cancel ticket" }).click();
  await expect(page.getByRole("status")).toHaveText("Ticket #1 in Finance Desk is cancelled.");
  await expect(page.getByRole("listitem").filter({ hasText: "Finance Desk" })).toHaveCount(0);

  await page.goto("/queues");
  await page.getByRole("listitem").filter({ hasText: "Finance Desk" }).getByRole("button", { name: "Join" }).click();
  await page.waitForURL(/\/my-ticket$/);
  await expect(page.getByRole("listitem").filter({ hasText: "Finance Desk" })).toContainText("Ticket #2");
});

test("TEST-F09-13 / AC-F09-11: operator marks the called customer as no-show and calls the next one", async ({ page, request }) => {
  await resetDb();
  await customerJoins(request, "customer3@example.test", "Finance Desk");
  await customerJoins(request, "customer4@example.test", "Finance Desk");
  await login(page, "operator1@example.test");
  await page.getByLabel("Queue").selectOption({ label: "Finance Desk" });
  const serving = page.getByRole("region", { name: "Now serving" });

  await page.getByRole("button", { name: "Call next" }).click();
  await expect(serving).toContainText("#1 Customer Three");
  await expect(serving.getByTestId("status-badge")).toHaveText("Called");
  await page.getByRole("button", { name: "No-show" }).click();
  await expect(serving).toContainText("No one is being served");

  // The counter is free again: the next call takes #2 instead of being refused as busy.
  await page.getByRole("button", { name: "Call next" }).click();
  await expect(serving).toContainText("#2 Customer Four");
  await expect(serving.getByTestId("status-badge")).toHaveText("Called");
});
