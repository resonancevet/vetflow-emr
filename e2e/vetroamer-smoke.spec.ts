import { test, expect } from "@playwright/test";

const DEMO_EMAIL = "admin@neighborhoodvet.example.com";
const DEMO_PASSWORD = "password123";

test.describe("VetRoamer v0 smoke", () => {
  test("demo login lands on schedule with v0 nav", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "VetRoamer" })).toBeVisible();

    await page.getByLabel(/email/i).fill(DEMO_EMAIL);
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/schedule/);
    await expect(page.getByRole("heading", { name: "Schedule", level: 2 })).toBeVisible();
  });

  test("can reach patients and clients from v0 shell", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(DEMO_EMAIL);
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/schedule/);

    await page.goto("/patients");
    await expect(page.getByRole("heading", { name: "Patients", level: 2 })).toBeVisible();

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "Clients", level: 2 })).toBeVisible();

    // Legacy /records redirects to the patient list
    await page.goto("/records");
    await expect(page).toHaveURL(/\/patients/);
  });

  test("dark mode toggle is present when logged in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(DEMO_EMAIL);
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/schedule/);

    await expect(
      page.getByRole("button", { name: /switch to dark mode/i })
    ).toBeVisible();
  });
});
