import { APIRequestContext, expect, test } from "@playwright/test";
import { resetDb } from "../reset-db";

const PASSWORD = "DemoPass123!";
const API = "http://localhost:3100";

// customer.spec.ts changes queues A and B first, so this file starts from the documented seed.
test.beforeAll(() => resetDb());

// Seed: A = Registrar Desk (customer4 serving #4, customer1 waiting #5, customer2 waiting #6),
// B = Finance Desk (empty), C = Student Affairs (closed, customer3 called #1).

async function login(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

async function queueId(request: APIRequestContext, name: string): Promise<number> {
  await login(request, "customer1@example.test");
  const { queues } = await (await request.get(`${API}/api/queues`)).json();
  return queues.find((q: { name: string }) => q.name === name).id;
}

test("TEST-F11-01 / AC-F11-01: the display shows the queue without logging in", async ({ page, request }) => {
  const id = await queueId(request, "Registrar Desk");
  await page.goto(`/display/${id}`);
  await expect(page).toHaveURL(new RegExp(`/display/${id}$`));
  await expect(page.getByRole("heading", { name: "Registrar Desk" })).toBeVisible();
  await expect(page.getByTestId("display-open")).toHaveText("Open");
  await expect(page.getByTestId("display-current-number")).toHaveText("4");
  await expect(page.getByTestId("display-current-status")).toHaveText("Serving");
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 2");
});

test("TEST-F11-02 / AC-F11-02: the display updates without a reload", async ({ page, request }) => {
  const id = await queueId(request, "Registrar Desk");
  await page.goto(`/display/${id}`);
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 2");

  // customer3 joins A (waiting becomes 3); the open page must pick it up by itself.
  await login(request, "customer3@example.test");
  const joined = await request.post(`${API}/api/queues/${id}/entries`);
  expect(joined.status()).toBe(201);
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 3", { timeout: 5000 });

  // operator1 completes #4 and calls the next entry (#5).
  await login(request, "operator1@example.test");
  const { queues } = await (await request.get(`${API}/api/operator/queues`)).json();
  const current = queues.find((q: { id: number }) => q.id === id).current;
  expect((await request.post(`${API}/api/entries/${current.entryId}/complete`)).ok()).toBeTruthy();
  expect((await request.post(`${API}/api/queues/${id}/call-next`)).ok()).toBeTruthy();
  await expect(page.getByTestId("display-current-number")).toHaveText("5", { timeout: 5000 });
  await expect(page.getByTestId("display-current-status")).toHaveText("Called");
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 2");
});

test("TEST-F11-03 / AC-F11-03: no customer data on the page", async ({ page, request }) => {
  const id = await queueId(request, "Student Affairs"); // C has customer3 as the called entry
  await page.goto(`/display/${id}`);
  await expect(page.getByTestId("display-current-number")).toHaveText("1");
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/Customer (One|Two|Three|Four|Five)/);
  expect(text).not.toContain("@example.test");
  const html = await page.content();
  expect(html).not.toMatch(/customerId|customerName/);
});

test("TEST-F11-04 / AC-F11-04: unknown or malformed queue id", async ({ page }) => {
  for (const id of ["9999", "abc"]) {
    await page.goto(`/display/${id}`);
    await expect(page.getByText("Queue not found.")).toBeVisible();
    await expect(page.getByText(/Waiting:/)).toHaveCount(0);
  }
});

test("TEST-F11-05 / AC-F11-05: a queue with nobody called or served", async ({ page, request }) => {
  const id = await queueId(request, "Finance Desk");
  await page.goto(`/display/${id}`);
  await expect(page.getByText("No one is being served")).toBeVisible();
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 0");
});

test("TEST-F11-06 / AC-F11-06: error keeps the last numbers and recovers", async ({ page, request }) => {
  const id = await queueId(request, "Finance Desk");
  await page.goto(`/display/${id}`);
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 0");

  await page.route("**/api/queues/*/display", (route) => route.abort());
  await expect(page.getByText("Cannot load the display. Retrying.")).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 0");

  await page.unroute("**/api/queues/*/display");
  await expect(page.getByText("Cannot load the display. Retrying.")).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByTestId("display-waiting")).toHaveText("Waiting: 0");
});
