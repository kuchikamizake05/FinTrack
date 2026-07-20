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

test.describe("password and Google login @critical", () => {
  test("uses native email validation", async ({ page }) => {
    await mockSupabase(page, false);
    await page.goto("/login");
    const email = page.getByLabel("Alamat email");
    await email.fill("bukan-email");
    await page.getByLabel("Kata sandi", { exact: true }).fill("rahasia123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    expect(await email.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("offers password login, account creation, and Google", async ({ page }) => {
    await mockSupabase(page, false);
    await page.goto("/login?next=%2Ftransactions");
    await expect(page.getByLabel("Kata sandi", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
    await page.getByRole("button", { name: "Daftar" }).click();
    await expect(page.getByLabel("Konfirmasi kata sandi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Buat akun" })).toBeVisible();
  });

  test("validates password confirmation before sign-up", async ({ page }) => {
    await mockSupabase(page, false);
    await page.goto("/login");
    await page.getByRole("button", { name: "Daftar" }).click();
    await page.getByLabel("Alamat email").fill("qa@fintrack.local");
    await page.getByLabel("Kata sandi", { exact: true }).fill("rahasia123");
    await page.getByLabel("Konfirmasi kata sandi").fill("berbeda123");
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(page.getByRole("alert")).toContainText("Konfirmasi kata sandi tidak cocok");
  });

  test("opens password recovery without removing Google login", async ({ page }) => {
    await mockSupabase(page, false);
    await page.goto("/login");
    await page.getByRole("button", { name: "Lupa kata sandi?" }).click();
    await expect(page.getByRole("heading", { name: "Pulihkan kata sandi" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim tautan pemulihan" })).toBeVisible();
  });
});
