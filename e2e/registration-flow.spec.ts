import { test, expect } from "@playwright/test";

test.describe("Registration & First-Time Setup", () => {
  const uniqueEmail = `test-${Date.now()}@openpims.dev`;

  test("can register a new practice and reach dashboard", async ({ page }) => {
    await page.goto("/register");

    await page.getByPlaceholder(/your name/i).fill("Test Vet");
    await page.getByPlaceholder(/practice name/i).fill("Test Animal Hospital");
    await page.getByPlaceholder(/email/i).fill(uniqueEmail);
    await page.getByPlaceholder(/password/i).fill("TestPassword123!");

    await page.getByRole("button", { name: /create account/i }).click();

    // Should redirect to login or dashboard after registration
    await expect(page).toHaveURL(/\/(login|$)/, { timeout: 10000 });
  });
});
