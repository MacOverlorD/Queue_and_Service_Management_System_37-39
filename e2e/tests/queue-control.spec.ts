import { APIRequestContext, expect, Page, test } from "@playwright/test";
import { resetDb } from "../reset-db";

// F-10 contract: docs/sprints/sprint-2/f-10-queue-control-console.md (TEST-F10-07..09).
// Seed: operator1 has A = Registrar Desk (#4 Serving, 2 waiting) and B = Finance Desk (empty);
// C = Student Affairs belongs to operator2 and is closed.
const PASSWORD = "DemoPass123!";
const API = "http://localhost:3100";

test.beforeEach(() => resetDb());
test.afterAll(() => resetDb());

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(queues|operator)(\?.*)?$/);
}

async function queueIdByName(request: APIRequestContext, name: string): Promise<number> {
  expect((await request.post(`${API}/api/auth/login`, { data: { email: "customer1@example.test", password: PASSWORD } })).ok()).toBeTruthy();
  const { queues } = await (await request.get(`${API}/api/queues`)).json();
  return queues.find((q: { name: string }) => q.name === name).id;
}

const overviewRow = (page: Page, name: string) =>
  page.getByRole("list", { name: "Your queues" }).getByRole("listitem").filter({ hasText: name });

test("TEST-F10-07 / AC-F10-07: the console shows every assigned queue at once, and only those", async ({ page }) => {
  await login(page, "operator1@example.test");
  const rows = page.getByRole("list", { name: "Your queues" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);

  const finance = overviewRow(page, "Finance Desk");
  await expect(finance).toContainText("Open");
  await expect(finance).toContainText("0 waiting");
  await expect(finance).toContainText("No one is being served");

  const registrar = overviewRow(page, "Registrar Desk");
  await expect(registrar).toContainText("Open");
  await expect(registrar).toContainText("2 waiting");
  await expect(registrar).toContainText("#4 Serving");

  await expect(page.getByText("Student Affairs")).toHaveCount(0);
});

test("TEST-F10-08 / AC-F10-08: close and reopen a queue from the console", async ({ page, browser }) => {
  await login(page, "operator1@example.test");
  const finance = overviewRow(page, "Finance Desk");
  await finance.getByRole("button", { name: "Close queue" }).click();
  await expect(finance).toContainText("Closed");

  const customer = await (await browser.newContext()).newPage();
  await login(customer, "customer3@example.test");
  const card = customer.getByRole("listitem").filter({ hasText: "Finance Desk" });
  await expect(card.getByRole("button", { name: "Closed" })).toBeDisabled();

  await finance.getByRole("button", { name: "Open queue" }).click();
  await expect(finance).toContainText("Open");
  await expect(card.getByRole("button", { name: "Join" })).toBeEnabled({ timeout: 5000 });
  await card.getByRole("button", { name: "Join" }).click();
  await customer.waitForURL(/\/my-ticket$/);
  await expect(customer.getByRole("listitem").filter({ hasText: "Finance Desk" })).toContainText("Ticket #1");
});

test("TEST-F10-09 / AC-F10-09: the selected queue survives a reload; bad values fall back", async ({ page, request }) => {
  const registrarId = await queueIdByName(request, "Registrar Desk");
  const financeId = await queueIdByName(request, "Finance Desk");
  const studentAffairsId = await queueIdByName(request, "Student Affairs");

  await login(page, "operator1@example.test");
  await overviewRow(page, "Registrar Desk").getByRole("button", { name: "Select" }).click();
  await expect(page).toHaveURL(new RegExp(`/operator\\?queue=${registrarId}$`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/operator\\?queue=${registrarId}$`));
  await expect(page.getByRole("region", { name: "Now serving" })).toContainText("#4");

  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  for (const bad of [String(studentAffairsId), "abc"]) {
    await page.goto(`/operator?queue=${bad}`);
    await expect(page).toHaveURL(new RegExp(`/operator\\?queue=${financeId}$`));
    await expect(page.getByRole("region", { name: "Now serving" })).toContainText("No one is being served");
  }
  expect(asked.some((u) => u.includes(`/api/queues/${studentAffairsId}/`))).toBe(false);
});
