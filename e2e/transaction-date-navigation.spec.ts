import type { Page } from "@playwright/test";
import { expect, mockSupabase, test } from "./fixtures";

function visibleMerchant(page: Page, merchant: string) {
  return page.getByText(merchant, { exact: true }).filter({ visible: true });
}

async function prepareTransactions(page: Page) {
  await mockSupabase(page, true);
  await page.addInitScript(() => localStorage.setItem("fintrack-language", "id"));
  await page.route("https://e2e-project.supabase.co/rest/v1/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").at(-1);
    let rows: unknown[] = [];
    if (table === "financial_accounts") rows = [{ id: "bank", name: "BCA", currency: "IDR" }];
    if (table === "transactions") rows = [
      { id: "chosen", date: "2026-10-08", merchant: "Belanja tanggal pilihan" },
      { id: "other", date: "2026-10-07", merchant: "Belanja tanggal lain" },
    ].map((transaction) => ({
      ...transaction,
      type: "expense",
      category: "Makanan",
      amount: 25000,
      account_id: "bank",
      status: "confirmed",
      source: "manual",
      note: null,
      receipt_url: null,
      raw_text: null,
      ai_confidence: null,
      created_at: "2026-10-08T00:00:00Z",
      updated_at: "2026-10-08T00:00:00Z",
    }));
    await route.fulfill({ status: 200, json: rows });
  });
}

test.beforeEach(async ({ page }) => {
  await prepareTransactions(page);
});

test("chosen calendar date includes only transactions on that date", async ({ page }) => {
  await page.goto("/transactions?date=2026-10-08");
  await expect(page.getByLabel("Mulai tanggal", { exact: true })).toHaveValue("2026-10-08");
  await expect(page.getByLabel("Sampai tanggal", { exact: true })).toHaveValue("2026-10-08");
  await expect(visibleMerchant(page, "Belanja tanggal pilihan")).toBeVisible();
  await expect(visibleMerchant(page, "Belanja tanggal lain")).toHaveCount(0);
});

test("empty calendar date prefills new transaction and keeps date filter", async ({ page }) => {
  await page.goto("/transactions?new=1&date=2026-10-10");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Tanggal", { exact: true })).toHaveValue("2026-10-10");
  await expect(page).toHaveURL(/\/transactions\?date=2026-10-10$/);
  await page.getByRole("button", { name: "Tutup form transaksi", exact: true }).click();
  await expect(page.getByLabel("Mulai tanggal", { exact: true })).toHaveValue("2026-10-10");
  await expect(page.getByLabel("Sampai tanggal", { exact: true })).toHaveValue("2026-10-10");
  await expect(page.getByText("Tidak ada transaksi yang cocok", { exact: true })).toBeVisible();
});

test("invalid calendar date does not filter out transactions", async ({ page }) => {
  await page.goto("/transactions?date=2026-02-29");
  await expect(page.getByLabel("Mulai tanggal", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Sampai tanggal", { exact: true })).toHaveValue("");
  await expect(visibleMerchant(page, "Belanja tanggal pilihan")).toBeVisible();
  await expect(visibleMerchant(page, "Belanja tanggal lain")).toBeVisible();
});

test("reset clears chosen calendar date from filters and URL", async ({ page }) => {
  await page.goto("/transactions?date=2026-10-08");
  await expect(visibleMerchant(page, "Belanja tanggal pilihan")).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByLabel("Mulai tanggal", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Sampai tanggal", { exact: true })).toHaveValue("");
  await expect(visibleMerchant(page, "Belanja tanggal lain")).toBeVisible();
});
