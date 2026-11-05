import { APIRequestContext, expect, Page, test } from "@playwright/test";
import { resetDb } from "../reset-db";

const PASSWORD = "DemoPass123!";
const API = "http://localhost:3100";

// customer.spec.ts changes queues A and B first, so this file starts from the documented seed.
test.beforeAll(() => resetDb());

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(queues|operator)$/);
}

// A customer joins a queue through the API, as a separate client from the operator's browser.
async function customerJoins(request: APIRequestContext, email: string, queueName: string) {
  const loginRes = await request.post(`${API}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(loginRes.ok()).toBeTruthy();
  const { queues } = await (await request.get(`${API}/api/queues`)).json();
  const queue = queues.find((q: { name: string }) => q.name === queueName);
  const joined = await request.post(`${API}/api/queues/${queue.id}/entries`);
  expect(joined.status()).toBe(201);
}

// Seed: operator1 serves A = Registrar Desk (customer4 serving #4, customer1 waiting #5, customer2 waiting #6)
// and B = Finance Desk (empty). operator2 serves C = Student Affairs.

test("TEST-F08b-01 / AC-F08b-01: assigned queues, current entry and waiting order", async ({ page }) => {
  await page.goto("/operator");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "operator1@example.test");
  await expect(page).toHaveURL(/\/operator$/);
  await expect(page.getByRole("heading", { name: "Operator console" })).toBeVisible();

  const selector = page.getByLabel("Queue");
  await expect(selector.locator("option")).toHaveText(["Finance Desk", "Registrar Desk"]);

  await selector.selectOption({ label: "Registrar Desk" });
  const serving = page.getByRole("region", { name: "Now serving" });
  await expect(serving).toContainText("#4");
  await expect(serving).toContainText("Customer Four");
  await expect(serving.getByTestId("status-badge")).toHaveText("Serving");
  const waiting = page.getByRole("list", { name: "Waiting list" }).getByRole("listitem");
  await expect(waiting).toHaveText([/#5.*Customer One/, /#6.*Customer Two/]);
});

test("TEST-F08b-02 / AC-F08b-02: call next, start and complete, saved after reload", async ({ page, request }) => {
  await customerJoins(request, "customer3@example.test", "Finance Desk");
  await login(page, "operator1@example.test");
  await page.getByLabel("Queue").selectOption({ label: "Finance Desk" });

  const serving = page.getByRole("region", { name: "Now serving" });
  const waiting = page.getByRole("list", { name: "Waiting list" }).getByRole("listitem");
  await expect(waiting).toHaveText([/#1.*Customer Three/]);

  await page.getByRole("button", { name: "Call next" }).click();
  await expect(serving).toContainText("Customer Three");
  await expect(serving.getByTestId("status-badge")).toHaveText("Called");
  await expect(waiting).toHaveCount(0);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(serving.getByTestId("status-badge")).toHaveText("Serving");
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);

  await page.getByRole("button", { name: "Complete" }).click();
  await expect(serving).toContainText("No one is being served");

  await page.reload();
  await page.getByLabel("Queue").selectOption({ label: "Finance Desk" });
  await expect(page.getByRole("region", { name: "Now serving" })).toContainText("No one is being served");
  await expect(page.getByText("No one is waiting")).toBeVisible();

  const mine = await (await request.get(`${API}/api/me/entries`)).json();
  const ticket = mine.entries.find((e: { queueName: string }) => e.queueName === "Finance Desk");
  expect(ticket.status).toBe("COMPLETED");
});

test("TEST-F08b-03 / AC-F08b-03: rejected action, empty state and refresh", async ({ page, request }) => {
  await login(page, "operator1@example.test");

  // Queue A already has a customer being served, so calling next is rejected and nothing changes.
  await page.getByLabel("Queue").selectOption({ label: "Registrar Desk" });
  const serving = page.getByRole("region", { name: "Now serving" });
  await expect(serving).toContainText("Customer Four");
  await page.getByRole("button", { name: "Call next" }).click();
  await expect(page.getByRole("alert")).toContainText("Finish the current customer");
  await expect(serving).toContainText("Customer Four");
  await expect(serving.getByTestId("status-badge")).toHaveText("Serving");

  // Queue B has nobody waiting; a customer who joins appears after the refresh, without a reload.
  await page.getByLabel("Queue").selectOption({ label: "Finance Desk" });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("No one is waiting")).toBeVisible();
  await customerJoins(request, "customer5@example.test", "Finance Desk");
  await expect(page.getByRole("list", { name: "Waiting list" }).getByRole("listitem")).toHaveText(
    [/Customer Five/],
    { timeout: 8000 },
  );
});

test("TEST-F08b-01b / AC-F08b-01: no sideways scrolling at phone width (review of #26)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "operator1@example.test");
  await page.getByLabel("Queue").selectOption({ label: "Registrar Desk" });
  const serving = page.getByRole("region", { name: "Now serving" });
  await expect(serving).toContainText("Customer Four");
  await expect(serving.getByRole("button", { name: "Complete" })).toBeVisible();

  const overflow = await page.evaluate(() => {
    const card = document.querySelector("main.card")!.getBoundingClientRect();
    const row = document.querySelector("[aria-label='Now serving'] .list-item")!.getBoundingClientRect();
    return {
      pageScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rowSticksOut: row.right > card.right + 0.5,
    };
  });
  expect(overflow).toEqual({ pageScrollsSideways: false, rowSticksOut: false });
});

test("TEST-F08b-03c / AC-F08b-03: a rejected action message sits by Call next and survives a refresh (review of #26)", async ({
  page,
}) => {
  await login(page, "operator1@example.test");
  await page.getByLabel("Queue").selectOption({ label: "Registrar Desk" });
  await expect(page.getByRole("region", { name: "Now serving" })).toContainText("Customer Four");
  await page.getByRole("button", { name: "Call next" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Finish the current customer");
  // The message is next to the button, above the waiting list, so a long list cannot push it off-screen.
  const alertBox = (await alert.boundingBox())!;
  const listBox = (await page.getByRole("list", { name: "Waiting list" }).boundingBox())!;
  expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(listBox.y);

  // Two refresh cycles later (VITE_REFRESH_MS is 1500 ms in the suite) the message is still there.
  await page.waitForResponse((r) => r.url().includes("/api/operator/queues"));
  await page.waitForResponse((r) => r.url().includes("/api/operator/queues"));
  await expect(alert).toContainText("Finish the current customer");

  // The next action clears it; switching queue also clears it.
  await page.getByLabel("Queue").selectOption({ label: "Finance Desk" });
  await expect(page.getByRole("alert")).toHaveCount(0);
});
