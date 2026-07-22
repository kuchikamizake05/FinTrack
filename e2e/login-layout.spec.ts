import { expect, mockSupabase, test } from "./fixtures";

test("auth typography matches the landing page", async ({ page }) => {
  await mockSupabase(page, false);
  await page.goto("/");

  const landingBrand = page.getByRole("link", { name: "FinTrack beranda", exact: true }).first().getByText("FinTrack", { exact: true });
  const landingBody = page.getByText("Satu tempat untuk memahami arus kas, menjaga target, dan membuat keputusan finansial dengan tenang.", { exact: true });
  await expect(landingBrand).toBeVisible();
  await expect(landingBody).toBeVisible();
  const landingFonts = await Promise.all([
    landingBrand.evaluate((element) => getComputedStyle(element).fontFamily),
    landingBody.evaluate((element) => getComputedStyle(element).fontFamily),
  ]);

  await page.goto("/login");
  const authBrand = page.getByRole("link", { name: "FinTrack beranda", exact: true }).getByText("FinTrack", { exact: true });
  const authBody = page.getByText("Masuk menggunakan email dan kata sandi atau akun Google.", { exact: true });
  await expect(authBrand).toBeVisible();
  await expect(authBody).toBeVisible();
  const authFonts = await Promise.all([
    authBrand.evaluate((element) => getComputedStyle(element).fontFamily),
    authBody.evaluate((element) => getComputedStyle(element).fontFamily),
  ]);

  expect(authFonts).toEqual(landingFonts);
});

test("the complete login card stays within a short desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await mockSupabase(page, false);
  await page.goto("/login");

  const brand = page.getByRole("link", { name: "FinTrack beranda", exact: true });
  const card = page.getByRole("region", { name: "Selamat datang kembali", exact: true });
  const submit = page.getByRole("button", { name: "Masuk ke FinTrack", exact: true });
  const privacyNote = page.getByText("Setiap akun hanya dapat mengakses data miliknya melalui kebijakan RLS.", { exact: true });

  await expect(brand).toBeVisible();
  await expect(brand.getByText("FinTrack", { exact: true })).toBeVisible();
  await expect(submit).toBeVisible();
  await expect(privacyNote).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  const cardBox = await card.boundingBox();
  const headerBox = await page.locator("header").boundingBox();
  const cardCenterX = (cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2;
  const cardCenterY = (cardBox?.y ?? 0) + (cardBox?.height ?? 0) / 2;
  const mainCenterY = (headerBox?.height ?? 0) + (layout.viewportHeight - (headerBox?.height ?? 0)) / 2;

  await expect(page.getByText("Kembali ke angka yang benar-benar penting.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Arus kas jelas", { exact: true })).toHaveCount(0);
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(cardBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(Math.abs(cardCenterX - layout.viewportWidth / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(cardCenterY - mainCenterY)).toBeLessThanOrEqual(2);
  expect((cardBox?.y ?? layout.viewportHeight) + (cardBox?.height ?? 0)).toBeLessThanOrEqual(layout.viewportHeight);
});

test("password controls are compact and preserve the password value", async ({ page }) => {
  await mockSupabase(page, false);
  await page.goto("/login");

  const password = page.getByLabel("Kata sandi", { exact: true });
  const passwordLabel = page.getByText("Kata sandi", { exact: true });
  const recovery = page.getByRole("button", { name: "Lupa kata sandi?", exact: true });
  const showPassword = page.getByRole("button", { name: "Tampilkan kata sandi", exact: true });

  await password.fill("rahasia123");
  await expect(password).toHaveAttribute("type", "password");
  await showPassword.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("rahasia123");
  await expect(page.getByRole("button", { name: "Sembunyikan kata sandi", exact: true })).toBeVisible();

  const labelBox = await passwordLabel.boundingBox();
  const recoveryBox = await recovery.boundingBox();
  expect(labelBox).not.toBeNull();
  expect(recoveryBox).not.toBeNull();
  expect(Math.abs((labelBox?.y ?? 0) - (recoveryBox?.y ?? 0))).toBeLessThanOrEqual(2);
});

test("taller authentication modes remain vertically reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await mockSupabase(page, false);
  await page.goto("/login");
  await page.getByRole("button", { name: "Daftar", exact: true }).click();

  const privacyNote = page.getByText("Setiap akun hanya dapat mengakses data miliknya melalui kebijakan RLS.", { exact: true });
  await privacyNote.scrollIntoViewIfNeeded();

  const layout = await page.evaluate(() => ({
    viewportHeight: document.documentElement.clientHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  const privacyBox = await privacyNote.boundingBox();

  expect(layout.documentHeight).toBeGreaterThan(layout.viewportHeight);
  expect(privacyBox).not.toBeNull();
  expect((privacyBox?.y ?? layout.viewportHeight) + (privacyBox?.height ?? 0)).toBeLessThanOrEqual(layout.viewportHeight);
});
