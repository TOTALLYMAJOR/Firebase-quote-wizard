import { expect, test } from "@playwright/test";

const STAFF_EMAIL = process.env.E2E_FIREBASE_EMAIL || "e2e-admin@local.test";
const STAFF_PASSWORD = process.env.E2E_FIREBASE_PASSWORD || "Passw0rd!";

async function signInAsStaff(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Staff Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(STAFF_EMAIL);
  await page.getByLabel("Password").fill(STAFF_PASSWORD);
  await page.locator(".auth-actions").getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("button", { name: "Get Instant Quote" })).toBeVisible({ timeout: 45_000 });
}

async function fillRequiredQuoteFields(page) {
  const eventType = page.getByLabel("Event type", { exact: true });
  const optionCount = await eventType.locator("option").count();
  if (optionCount > 1) {
    await eventType.selectOption({ index: 1 });
  }

  await page.getByLabel("Event date", { exact: true }).fill("2026-08-22");
  await page.getByLabel("Start time", { exact: true }).fill("18:00");
  await page.getByLabel("Event hours", { exact: true }).fill("4");
  await page.getByLabel("Guests (max 400)", { exact: true }).fill("88");
  await page.getByLabel("Event name", { exact: true }).fill("Firebase E2E Dinner");
  await page.getByLabel("Venue", { exact: true }).fill("Birmingham Test Hall");
  await page.getByLabel("Venue address", { exact: true }).fill("123 Emu Lane, Birmingham, AL");
  await page.getByLabel("Your name", { exact: true }).fill("E2E Admin");
  await page.getByLabel("Phone", { exact: true }).fill("205-555-0101");
  await page.getByLabel("Email", { exact: true }).fill("client@example.com");
}

async function advanceToSave(page, saveLabel = "Save & Submit") {
  for (let i = 0; i < 6; i += 1) {
    const saveButton = page.getByRole("button", { name: saveLabel });
    if (await saveButton.count()) {
      await expect(saveButton).toBeVisible();
      await saveButton.click();
      return;
    }

    const nextButton = page.getByRole("button", { name: "Next" });
    if (!(await nextButton.count())) break;
    await nextButton.click();
  }

  throw new Error(`Unable to reach ${saveLabel}`);
}

test("firebase auth + firestore rules flow allows staff quote save", async ({ page }) => {
  await signInAsStaff(page);
  await fillRequiredQuoteFields(page);
  await advanceToSave(page, "Save & Submit");

  await expect(page.getByText(/saved to firebase/i)).toBeVisible();

  const historyHeading = page.getByRole("heading", { name: "Quote History" });
  if (!(await historyHeading.isVisible())) {
    await page.getByRole("button", { name: "Quote History" }).click();
  }
  await expect(historyHeading).toBeVisible();

  const rows = page.locator(".history-table-wrap tbody tr").filter({
    has: page.getByRole("button", { name: "Copy Email" })
  });
  await expect(rows.first()).toContainText("88");
});
