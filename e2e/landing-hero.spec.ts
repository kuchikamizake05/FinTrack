import { expect, test } from "@playwright/test";

test("landing hero keeps the headline compact and CTA above the fold", async ({ page }) => {
  await page.goto("/");

  const emphasizedHeadline = page.locator("h1 em");
  const primaryCta = page.getByRole("link", { name: "Mulai gratis", exact: true });

  await expect(emphasizedHeadline).toBeVisible();
  await expect(primaryCta).toBeVisible();

  const emphasizedLineCount = await emphasizedHeadline.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects().length;
  });
  const ctaBox = await primaryCta.boundingBox();
  const viewportHeight = page.viewportSize()?.height ?? 0;

  expect(emphasizedLineCount).toBe(1);
  expect(ctaBox).not.toBeNull();
  expect((ctaBox?.y ?? viewportHeight) + (ctaBox?.height ?? 0)).toBeLessThanOrEqual(viewportHeight);
});
