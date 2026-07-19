import type { Page, Route } from "@playwright/test";
import { expect, mockAuthenticatedSession, test, user } from "./fixtures";

const currentTransactions = [
  { id: "income-1", date: "2026-07-01", type: "income", category: "Gaji", amount: 10_000_000, status: "confirmed" },
  { id: "expense-1", date: "2026-07-03", type: "expense", category: "Hunian", amount: 2_500_000, status: "confirmed" },
  { id: "expense-2", date: "2026-07-05", type: "expense", category: "Makanan", amount: 1_500_000, status: "confirmed" },
  { id: "pending-1", date: "2026-07-06", type: "expense", category: "Belanja", amount: 500_000, status: "pending_approval" },
];

const previousTransactions = [
  { id: "old-income", date: "2026-06-01", type: "income", category: "Gaji", amount: 9_000_000, status: "confirmed" },
  { id: "old-expense", date: "2026-06-03", type: "expense", category: "Makanan", amount: 3_500_000, status: "confirmed" },
];

async function fulfillRows(route: Route, rows: unknown[]) {
  await route.fulfill({ status: 200, headers: { "Content-Type": "application/json", "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" }, body: JSON.stringify(rows) });
}

async function mockInsights(page: Page, options: { empty?: boolean; aiStatus?: number } = {}) {
  await mockAuthenticatedSession(page);
  const aiPayloads: unknown[] = [];
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }
    if (url.pathname === "/rest/v1/transactions") {
      if (options.empty) {
        await fulfillRows(route, []);
        return;
      }
      const query = decodeURIComponent(url.search);
      await fulfillRows(route, query.includes("2026-06-01") ? previousTransactions : currentTransactions);
      return;
    }
    if (url.pathname === "/rest/v1/financial_accounts") {
      await fulfillRows(route, [{ id: "account-1", currency: "IDR", reporting_balance_idr: null, is_active: true }]);
      return;
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      await fulfillRows(route, []);
      return;
    }
    await route.fulfill({ status: 404, json: { message: `Unmocked route: ${url.pathname}` } });
  });
  await page.route("**/api/insights/generate", async (route) => {
    aiPayloads.push(route.request().postDataJSON());
    if (options.aiStatus) {
      await route.fulfill({ status: options.aiStatus, json: { error: "AI sedang tidak tersedia. Analisis lokal tetap tersedia." } });
      return;
    }
    await route.fulfill({ status: 200, json: {
      insight: {
        headline: "Arus kas bulan ini tetap sehat",
        summary: "Pemasukan masih menutup pengeluaran. Selesaikan transaksi tertunda agar review semakin lengkap.",
        tone: "positive",
        actions: [{ candidateId: "review-pending", title: "Tinjau transaksi tertunda", reason: "Satu transaksi belum masuk perhitungan.", impact: "high" }],
        observations: ["Hunian menjadi kategori pengeluaran terbesar."],
        generatedAt: "2026-07-20T08:00:00.000Z",
        model: "openai/gpt-oss-20b",
      },
    } });
  });
  return aiPayloads;
}

test.describe("Smart Insights @critical", () => {
  test("renders verified metrics before a validated AI explanation", async ({ page }) => {
    const payloads = await mockInsights(page);
    await page.goto("/insights");
    await expect(page.getByRole("heading", { name: "Smart Insights" })).toBeVisible();
    await expect(page.getByText(/Rp\s*10\.000\.000/)).toBeVisible();
    await expect(page.getByText(/Rp\s*4\.000\.000/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Arus kas bulan ini tetap sehat" })).toBeVisible();
    await expect(page.getByText("Dibantu AI")).toBeVisible();
    await expect(page.getByText("Hunian menjadi kategori pengeluaran terbesar.")).toBeVisible();
    expect(payloads).toHaveLength(1);
    const serialized = JSON.stringify(payloads[0]);
    expect(serialized).not.toContain("merchant");
    expect(serialized).not.toContain("note");
    expect(serialized).not.toContain("income-1");
  });

  test.describe("provider fallback", () => {
    test.use({ allowedConsoleErrors: ["Failed to load resource: the server responded with a status of 503"] });

    test("keeps deterministic analysis when AI is unavailable", async ({ page }) => {
      await mockInsights(page, { aiStatus: 503 });
      await page.goto("/insights");
      await expect(page.getByRole("heading", { name: "Ruang arus kas masih terjaga" })).toBeVisible();
      await expect(page.getByText(/Analisis lokal tetap tersedia/)).toBeVisible();
      await expect(page.getByText("Fallback terverifikasi")).toBeVisible();
    });
  });

  test("shows a useful empty state without calling AI", async ({ page }) => {
    const payloads = await mockInsights(page, { empty: true });
    await page.goto("/insights");
    await expect(page.getByRole("heading", { name: /Belum ada data terverifikasi/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Buka transaksi/ })).toBeVisible();
    expect(payloads).toHaveLength(0);
  });

  test("priority actions navigate internally", async ({ page }) => {
    await mockInsights(page);
    await page.goto("/insights");
    await page.getByRole("link", { name: /Tinjau transaksi tertunda/ }).click();
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test("has no page-level horizontal overflow", async ({ page }) => {
    await mockInsights(page);
    await page.goto("/insights");
    await expect(page.getByRole("heading", { name: "Smart Insights" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
