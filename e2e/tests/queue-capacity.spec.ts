import { Browser, expect, Page, test } from "@playwright/test";
import { resetDb } from "../reset-db";

// CR-01 (Lab 7, #82): TEST-F04-13 covers AC-F04-13, AC-F10-11 and AC-F11-07 in one journey.
// Seed: operator1 has Finance Desk (open, empty) and Registrar Desk; no queue has a waiting limit.
const PASSWORD = "DemoPass123!";

test.beforeAll(() => resetDb());
test.afterAll(() => resetDb());

async function login(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(queues|operator)(\?.*)?$/);
  return page;
}

test("TEST-F04-13 / AC-F04-13, AC-F10-11, AC-F11-07: a full queue is shown as Full everywhere and opens again after a call", async ({ browser }) => {
  const operator = await login(browser, "operator1@example.test");
  const finance = operator.getByRole("list", { name: "Overview" }).getByRole("listitem").filter({ hasText: "Finance Desk" });
  await finance.getByLabel("Waiting limit for Finance Desk").fill("1");
  await finance.getByRole("button", { name: "Save limit" }).click();
  await expect(finance).toContainText("0 / 1 waiting");

  const c3 = await login(browser, "customer3@example.test");
  await c3.getByRole("listitem").filter({ hasText: "Finance Desk" }).getByRole("button", { name: "Join" }).click();
  await c3.waitForURL(/\/my-ticket$/);

  const c4 = await login(browser, "customer4@example.test");
  const card = c4.getByRole("listitem").filter({ hasText: "Finance Desk" });
  await expect(card).toContainText("Full · 1 / 1 waiting");
  await expect(card.getByRole("button", { name: "Full" })).toBeDisabled();
  await expect(finance).toContainText("1 / 1 waiting", { timeout: 5000 });

  const queueId = new URL(operator.url()).searchParams.get("queue");
  const display = await (await browser.newContext()).newPage();
  await display.goto(`/display/${queueId}`);
  await expect(display.getByTestId("display-full")).toHaveText("Full: not taking new tickets");
  await expect(display.getByTestId("display-open")).toHaveText("Open");

  await operator.getByLabel("Queue").selectOption({ label: "Finance Desk" });
  await operator.getByRole("button", { name: "Call next" }).click();
  await expect(operator.getByRole("region", { name: "Now serving" })).toContainText("Customer Three");

  await c4.reload();
  await c4.getByRole("listitem").filter({ hasText: "Finance Desk" }).getByRole("button", { name: "Join" }).click();
  await c4.waitForURL(/\/my-ticket$/);
  await expect(c4.getByRole("listitem").filter({ hasText: "Finance Desk" })).toContainText("Ticket #2");
});
