import { expect, mockSupabase, test } from "./fixtures";

test("login stays within the initial viewport and uses the shared brand lockup", async ({ page }) => {
  await mockSupabase(page, false);
  await page.goto("/login");

  const brand = page.getByRole("link", { name: "FinTrack beranda", exact: true });
  const submit = page.getByRole("button", { name: "Masuk ke FinTrack", exact: true });

  await expect(brand).toBeVisible();
  await expect(brand.getByText("FinTrack", { exact: true })).toBeVisible();
  await expect(submit).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewportHeight: document.documentElement.clientHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  const submitBox = await submit.boundingBox();

  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(submitBox).not.toBeNull();
  expect((submitBox?.y ?? layout.viewportHeight) + (submitBox?.height ?? 0)).toBeLessThanOrEqual(layout.viewportHeight);
});
