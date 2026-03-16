import { expect, test } from "@playwright/test";

function parseMoney(text) {
  const normalized = String(text || "").replace(/[^0-9.-]/g, "");
  return Number(normalized || 0);
}

async function fillRequiredQuoteFields(page, { guests = 72, eventName = "E2E Launch Dinner", venue = "Birmingham Civic Hall" } = {}) {
  await page.getByLabel("Event date", { exact: true }).fill("2026-06-14");
  await page.getByLabel("Start time", { exact: true }).fill("18:00");
  await page.getByLabel("Event hours", { exact: true }).fill("4");
  await page.getByLabel("Guests (max 400)", { exact: true }).fill(String(guests));
  await page.getByLabel("Event name", { exact: true }).fill(eventName);
  await page.getByLabel("Venue", { exact: true }).fill(venue);
  await page.getByLabel("Venue address", { exact: true }).fill("123 Event Way, Birmingham, AL");
  await page.getByLabel("Your name", { exact: true }).fill("E2E Staff");
  await page.getByLabel("Phone", { exact: true }).fill("205-555-0184");
  await page.getByLabel("Email", { exact: true }).fill("client@example.com");
}

async function createQuoteToHistory(page, { guests = 72 } = {}) {
  await fillRequiredQuoteFields(page, { guests });

  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Package tier").selectOption("premium");
  await page.getByLabel("Travel (round trip miles)").fill("28");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Deposit payment link (optional)").fill("https://pay.example.com/e2e-deposit");
  await page.getByRole("button", { name: "Accept & Continue" }).click();

  await expect(page.getByRole("heading", { name: "Quote History" })).toBeVisible();
  await expect(page.getByText(/saved to/i)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    // Disable worker cache side effects across tests.
    sessionStorage.clear();
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get Instant Quote" })).toBeVisible();
});

test("new quote flow allows edits before save and persists in history", async ({ page }) => {
  await fillRequiredQuoteFields(page, { guests: 60, eventName: "E2E Quote A", venue: "Hall A" });
  await page.getByRole("button", { name: "Next" }).click();

  const totalLocator = page.locator(".hero-card dd").first();
  const beforeTotal = parseMoney(await totalLocator.innerText());

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByLabel("Guests (max 400)", { exact: true }).fill("110");
  await page.getByRole("button", { name: "Next" }).click();

  const afterTotal = parseMoney(await totalLocator.innerText());
  expect(afterTotal).toBeGreaterThan(beforeTotal);

  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Accept & Continue" }).click();

  await expect(page.getByText(/Quote .* saved to/i)).toBeVisible();
  const firstQuoteRow = page.locator(".history-table-wrap tbody tr").filter({
    has: page.getByRole("button", { name: "Copy Email" })
  }).first();
  await expect(firstQuoteRow).toContainText("E2E Staff");
  await expect(firstQuoteRow).toContainText("110");
});

test("quote history supports export and send actions", async ({ page }) => {
  await createQuoteToHistory(page, { guests: 84 });

  const firstQuoteRow = page.locator(".history-table-wrap tbody tr").filter({
    has: page.getByRole("button", { name: "Copy Email" })
  }).first();
  await expect(firstQuoteRow).toBeVisible();

  await firstQuoteRow.getByRole("button", { name: "Copy Email" }).click();
  await expect(page.getByText(/Email copied/i)).toBeVisible();
  await expect(firstQuoteRow.getByRole("combobox").first()).toHaveValue("sent");

  const downloadPromise = page.waitForEvent("download");
  await firstQuoteRow.getByRole("button", { name: "PDF" }).click();
  const pdfDownload = await downloadPromise;
  expect(pdfDownload.suggestedFilename()).toMatch(/proposal\.pdf$/i);

  await firstQuoteRow.getByRole("button", { name: "Copy Pay Link" }).click();
  await expect(page.getByText(/Deposit link copied/i)).toBeVisible();
});
