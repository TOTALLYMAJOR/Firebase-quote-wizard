import { expect, test } from "@playwright/test";

function parseMoney(text) {
  const normalized = String(text || "").replace(/[^0-9.-]/g, "");
  return Number(normalized || 0);
}

async function fillRequiredQuoteFields(page, { guests = 72, eventName = "E2E Launch Dinner", venue = "Birmingham Civic Hall" } = {}) {
  const eventType = page.getByLabel("Event type", { exact: true });
  if (await eventType.count()) {
    const optionCount = await eventType.locator("option").count();
    if (optionCount > 1) {
      await eventType.selectOption({ index: 1 });
    }
  }
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

async function advanceToSaveButton(page, saveButtonLabel) {
  for (let step = 0; step < 6; step += 1) {
    const packageTier = page.getByLabel("Package tier");
    if (await packageTier.count()) {
      await packageTier.selectOption("premium");
    }
    const travelMiles = page.getByLabel("Travel (round trip miles)");
    if (await travelMiles.count()) {
      await travelMiles.fill("28");
    }
    const depositLink = page.getByLabel("Deposit payment link (optional)");
    if (await depositLink.count()) {
      await depositLink.fill("https://pay.example.com/e2e-deposit");
    }

    const saveButton = page.getByRole("button", { name: saveButtonLabel });
    if (await saveButton.count()) {
      await expect(saveButton).toBeVisible();
      await saveButton.click();
      return;
    }

    const nextButton = page.getByRole("button", { name: "Next" });
    if (!(await nextButton.count())) {
      break;
    }
    await nextButton.click();
  }
  throw new Error(`Unable to reach save button: ${saveButtonLabel}`);
}

async function createQuoteToHistory(page, { guests = 72 } = {}) {
  await fillRequiredQuoteFields(page, { guests });
  await advanceToSaveButton(page, "Save & Submit");
  await expect(page.getByText(/saved to/i)).toBeVisible();

  const historyHeading = page.getByRole("heading", { name: "Quote History" });
  if (!(await historyHeading.isVisible())) {
    await page.getByRole("button", { name: "Quote History" }).click();
  }
  await expect(historyHeading).toBeVisible();
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
  await page.getByRole("button", { name: "Save & Submit" }).click();

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

test("create then edit keeps one quote row and reflects updated fields", async ({ page }) => {
  await createQuoteToHistory(page, { guests: 70 });

  const quoteRows = page.locator(".history-table-wrap tbody tr").filter({
    has: page.getByRole("button", { name: "Copy Email" })
  });
  await expect(quoteRows).toHaveCount(1);
  await expect(quoteRows.first()).toContainText("70");

  await quoteRows.first().getByRole("button", { name: "Edit" }).click();
  await expect(page.getByText(/Editing quote/i)).toBeVisible();

  await page.getByLabel("Guests (max 400)", { exact: true }).fill("95");
  await advanceToSaveButton(page, "Save Changes");

  await expect(page.getByText(/updated in/i)).toBeVisible();
  await expect(quoteRows).toHaveCount(1);
  await expect(quoteRows.first()).toContainText("95");
});
