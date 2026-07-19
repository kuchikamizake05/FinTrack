import { expect, mockSupabase, test } from "./fixtures";

const protectedRoutes = [
  "/dashboard",
  "/transactions",
  "/accounts",
  "/categories",
  "/investments",
  "/trading",
  "/insights",
  "/settings",
];

test.describe("authentication boundary @critical", () => {
  for (const route of protectedRoutes) {
    test(`redirects signed-out access from ${route}`, async ({ page }) => {
      await mockSupabase(page, false);
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(route)}`));
      await expect(page.getByRole("heading", { name: "Selamat datang kembali" })).toBeVisible();
    });
  }

  test("rejects an external post-login destination", async ({ page }) => {
    await mockSupabase(page, true);
    await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fsteal");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("magic-link login @critical", () => {
  test("uses native email validation", async ({ page }) => {
    await mockSupabase(page, false);
    await page.goto("/login");
    const email = page.getByLabel("Alamat email");
    await email.fill("bukan-email");
    await page.getByRole("button", { name: "Kirim tautan masuk" }).click();
    expect(await email.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows a calm success state without duplicate submission", async ({ page }) => {
    await mockSupabase(page, false);
    await page.goto("/login?next=%2Ftransactions");
    await page.getByLabel("Alamat email").fill("qa@fintrack.local");
    await page.getByRole("button", { name: "Kirim tautan masuk" }).click();
    await expect(page.getByText(/Tautan masuk sudah dikirim/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim tautan masuk" })).toBeEnabled();
  });
});
