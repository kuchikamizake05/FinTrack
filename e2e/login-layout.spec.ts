import { expect, mockSupabase, test } from "./fixtures";

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
    viewportHeight: document.documentElement.clientHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  const cardBox = await card.boundingBox();

  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(cardBox).not.toBeNull();
  expect((cardBox?.y ?? layout.viewportHeight) + (cardBox?.height ?? 0)).toBeLessThanOrEqual(layout.viewportHeight);
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
