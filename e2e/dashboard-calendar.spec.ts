import type { Page } from "@playwright/test";
import { expect, mockSupabase, test } from "./fixtures";

async function prepareDashboard(page: Page, language: "id" | "en") {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.clock.setFixedTime(new Date("2026-10-08T05:00:00Z"));
  await mockSupabase(page, true);
  await page.addInitScript((value) => localStorage.setItem("fintrack-language", value), language);
  await page.route("https://e2e-project.supabase.co/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    let rows: unknown[] = [];
    if (table === "financial_accounts") rows = [{ id: "bank", name: "BCA", kind: "bank", currency: "IDR", current_balance: 1000000, is_active: true, updated_at: "2026-10-08T00:00:00Z" }];
    if (table === "financial_budgets") rows = [{ id: "budget", category: "Makanan", month: "2026-10-01", limit_amount: 1000000 }];
    if (table === "transactions" && !url.searchParams.getAll("status").some((value) => value.startsWith("in.")) && !url.searchParams.getAll("date").includes("gte.2026-09-01")) rows = [
      { id: "expense", date: "2026-10-08", type: "expense", merchant: "Lunch", category: "Makanan", amount: 250000, account_id: "bank", status: "confirmed", created_at: "2026-10-08T00:00:00Z" },
      { id: "income", date: "2026-10-09", type: "income", merchant: "Salary", category: "Gaji", amount: 1000000, account_id: "bank", status: "confirmed", created_at: "2026-10-09T00:00:00Z" },
    ];
    await route.fulfill({ status: 200, json: rows });
  });
  await page.goto("/dashboard");
  await expect(page.locator("#mobile-calendar-title")).toBeVisible();
}

for (const language of ["id", "en"] as const) {
  test(`calendar aligns weekdays and protects amounts in ${language}`, async ({ page }, testInfo) => {
    await prepareDashboard(page, language);
    const calendar = page.locator("section[aria-labelledby='mobile-calendar-title']");
    const first = calendar.locator("a[href='/transactions?new=1&date=2026-10-01']");
    const weekday = calendar.getByText(language === "id" ? "Km" : "Th", { exact: true });
    const [dateBox, weekdayBox] = await Promise.all([first.boundingBox(), weekday.boundingBox()]);
    expect(dateBox).not.toBeNull();
    expect(weekdayBox).not.toBeNull();
    expect(Math.abs((dateBox!.x + dateBox!.width / 2) - (weekdayBox!.x + weekdayBox!.width / 2))).toBeLessThan(1);
    const populated = calendar.locator("a[href='/transactions?date=2026-10-08']");
    await expect(populated).toContainText("-250K");
    await expect(populated).toHaveAttribute("aria-label", /250K/);
    const darkAmount = page.locator("#mobile-cash-flow-title + p");
    await expect(darkAmount).toContainText(/750/);
    await expect(darkAmount).toHaveCSS("color", "rgb(255, 255, 255)");
    await testInfo.attach(`dashboard-${language}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("button", { name: language === "id" ? "Sembunyikan nominal" : "Hide amounts", exact: true }).click();
    await expect(populated).not.toContainText("250");
    await expect(populated).not.toHaveAttribute("aria-label", /250/);
    await expect(populated).toContainText("••••••");
    await page.reload();
    await expect(calendar.locator("a[href='/transactions?date=2026-10-08']")).not.toContainText("250");
  });
}

test("calendar opens populated dates and prefills empty dates", async ({ page }) => {
  await prepareDashboard(page, "id");
  const calendar = page.locator("section[aria-labelledby='mobile-calendar-title']");
  await expect(calendar.locator("a[href='/transactions?date=2026-10-09']")).toBeVisible();
  await calendar.locator("a[href='/transactions?date=2026-10-08']").click();
  await expect(page).toHaveURL(/transactions\?date=2026-10-08$/);
  await expect(page.locator("#filter-start-date")).toHaveValue("2026-10-08");
  await expect(page.locator("#filter-end-date")).toHaveValue("2026-10-08");
  await page.goto("/dashboard");
  await calendar.locator("a[href='/transactions?new=1&date=2026-10-10']").click();
  await expect(page.locator("#transaction-date")).toBeVisible();
  await expect(page.locator("#transaction-date")).toHaveValue("2026-10-10");
});
