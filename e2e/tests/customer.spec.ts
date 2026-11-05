import { expect, Page, test } from "@playwright/test";

const PASSWORD = "DemoPass123!";
const API = "http://localhost:3100";

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

// Seed: queue A = Registrar Desk (customer1 waiting #5, customer2 #6, customer4 serving #4), B = Finance Desk (empty),
// C = Student Affairs (closed). customer3 has no active entry in A or B. customer5 has no entries at all.

test("TEST-F08a-01 / AC-F08a-01: login, logout and redirect", async ({ page }) => {
  await page.goto("/my-ticket");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "customer1@example.test", "wrong-password");
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "customer1@example.test");
  await expect(page).toHaveURL(/\/queues$/);
  await expect(page.getByRole("heading", { name: "Service queues" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/my-ticket");
  await expect(page).toHaveURL(/\/login$/);
});

test("TEST-F08a-02 / AC-F08a-02: join an open queue and see the new ticket", async ({ page }) => {
  await login(page, "customer3@example.test");
  const card = page.getByRole("listitem").filter({ hasText: "Registrar Desk" });
  await card.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(/\/my-ticket$/);
  await expect(page.getByText("Ticket #7")).toBeVisible();
  await expect(page.getByTestId("status-badge").first()).toHaveText("Waiting");
});

test("TEST-F08a-03 / AC-F08a-03: the saved ticket survives a reload", async ({ page }) => {
  await login(page, "customer3@example.test");
  await page.goto("/my-ticket");
  await page.reload();
  const ticket = page.getByRole("listitem").filter({ hasText: "Registrar Desk" });
  await expect(ticket).toContainText("Ticket #7");
  await expect(ticket.getByTestId("status-badge")).toHaveText("Waiting");
  await expect(ticket).toContainText("People ahead: 2");
});

test("TEST-F08a-04 / AC-F08a-04: duplicate join error and empty state", async ({ page }) => {
  await login(page, "customer1@example.test");
  const card = page.getByRole("listitem").filter({ hasText: "Registrar Desk" });
  await card.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("alert")).toContainText("already have an active ticket");
  await expect(page).toHaveURL(/\/queues$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await login(page, "customer5@example.test");
  await page.goto("/my-ticket");
  await expect(page.getByText("You are not in any queue.")).toBeVisible();

  await page.goto("/queues");
  const closed = page.getByRole("listitem").filter({ hasText: "Student Affairs" });
  await expect(closed.getByRole("button", { name: "Closed" })).toBeDisabled();
});

test("TEST-F08a-05 / AC-F08a-05: status changes by an operator appear without a reload", async ({ page, request }) => {
  await login(page, "customer4@example.test");
  const card = page.getByRole("listitem").filter({ hasText: "Finance Desk" });
  await card.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(/\/my-ticket$/);
  const ticket = page.getByRole("listitem").filter({ hasText: "Finance Desk" });
  await expect(ticket.getByTestId("status-badge")).toHaveText("Waiting");

  // The operator calls the next customer through the API; the page must pick it up by polling.
  const loginRes = await request.post(`${API}/api/auth/login`, {
    data: { email: "operator1@example.test", password: PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const queues = await (await request.get(`${API}/api/operator/queues`)).json();
  const finance = queues.queues.find((q: { name: string }) => q.name === "Finance Desk");
  const called = await request.post(`${API}/api/queues/${finance.id}/call-next`);
  expect(called.status()).toBe(200);

  await expect(ticket.getByTestId("status-badge")).toHaveText("Called", { timeout: 8000 });
});
