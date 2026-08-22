import type { Page, Route } from "@playwright/test";
import { expect, mockAuthenticatedSession, test, user } from "./fixtures";

const accounts = [
  { id: "idr-bank", name: "BCA Utama", currency: "IDR", current_balance: 1_000_000, updated_at: "2026-08-20T00:00:00.000Z", is_active: true, kind: "bank" },
  { id: "usd-wallet", name: "USD Wallet", currency: "USD", current_balance: 200, updated_at: "2026-08-20T00:00:00.000Z", is_active: true, kind: "ewallet" },
];

const transactions = [
  { id: "confirmed-idr", date: "2026-08-08", type: "expense", merchant: "Supermarket", category: "Kebutuhan", amount: 250_000, note: null, status: "confirmed", account_id: "idr-bank" },
  { id: "review-idr", date: "2026-08-10", type: "expense", merchant: "Belanja review", category: "Kebutuhan", amount: 75_000, note: null, status: "needs_review", account_id: "idr-bank" },
  { id: "confirmed-usd", date: "2026-08-11", type: "expense", merchant: "Cloud", category: "Langganan", amount: 50, note: null, status: "confirmed", account_id: "usd-wallet" },
];

type Goal = { id: string; name: string; target_amount: number; current_amount: number; currency: string; color: null; due_date: string | null; is_active: boolean };

async function fulfillRows(route: Route, rows: unknown[]) {
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" },
    body: JSON.stringify(rows),
  });
}

async function mockPlanningPage(page: Page, initialGoals: Goal[] = []) {
  const goals: Goal[] = [...initialGoals];
  const importedPayloads: unknown[] = [];
  const archivedGoalIds: string[] = [];
  await mockAuthenticatedSession(page);
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }
    if (url.pathname === "/rest/v1/financial_accounts") {
      await fulfillRows(route, accounts);
      return;
    }
    if (url.pathname === "/rest/v1/transactions") {
      if (request.method() === "POST") {
        importedPayloads.push(request.postDataJSON());
        await fulfillRows(route, []);
        return;
      }
      await fulfillRows(route, transactions);
      return;
    }
    if (url.pathname === "/rest/v1/financial_goals") {
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as Omit<Goal, "id" | "color" | "is_active">;
        goals.push({ ...payload, id: "goal-1", color: null, is_active: true });
        await route.fulfill({ status: 201, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" }, body: JSON.stringify([goals[0]]) });
        return;
      }
      if (request.method() === "PATCH") {
        const goalId = url.searchParams.get("id")?.replace("eq.", "");
        if (goalId) archivedGoalIds.push(goalId);
        const goal = goals.find((item) => item.id === goalId);
        if (goal) goal.is_active = false;
        await fulfillRows(route, goal ? [goal] : []);
        return;
      }
      await fulfillRows(route, goals.filter((goal) => goal.is_active));
      return;
    }
    await fulfillRows(route, []);
  });
  return { getImportedPayloads: () => importedPayloads, getArchivedGoalIds: () => archivedGoalIds };
}

test.describe("planning controls @critical", () => {
  test("keeps runway currencies separate, saves and archives goal", async ({ page }) => {
    const state = await mockPlanningPage(page, [{
      id: "goal-1",
      name: "Dana darurat",
      target_amount: 12_000_000,
      current_amount: 3_000_000,
      currency: "IDR",
      color: null,
      due_date: null,
      is_active: true,
    }]);
    await page.goto("/planning");

    const runway = page.getByRole("heading", { name: "Cadangan dana" }).locator("..");
    await expect(runway).toContainText("IDR · 4.0 bulan cadangan");
    await expect(runway).toContainText("USD · 4.0 bulan cadangan");
    await expect(runway).not.toContainText("1.000.200");

    await expect(page.getByText("Dana darurat")).toBeVisible();
    await page.getByRole("button", { name: "Arsipkan" }).click();
    await expect(page.getByText("Target diarsipkan.")).toBeVisible();
    expect(state.getArchivedGoalIds()).toEqual(["goal-1"]);
  });

  test("previews duplicates, imports selected rows as needs_review, separates review totals", async ({ page }) => {
    const state = await mockPlanningPage(page);
    await page.goto("/planning");

    await page.getByLabel("Akun untuk rekonsiliasi saldo").selectOption("idr-bank");
    await expect(page.getByText(/1 transaksi review belum masuk saldo/)).toBeVisible();
    await expect(page.getByText(/pengeluaran Rp\s*75\.000/)).toBeVisible();

    await page.getByLabel("Akun tujuan impor CSV").selectOption("idr-bank");
    const csv = [
      "date,type,merchant,category,amount,note",
      '"2026-08-08","expense","Supermarket","Kebutuhan","250000","sudah ada"',
      '"2026-08-20","income","Bonus","Pemasukan","500000","baru"',
    ].join("\n");
    await page.getByLabel("Pilih file CSV untuk diimpor").setInputFiles({ name: "ledger.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    await expect(page.getByText("Tinjau impor")).toBeVisible();
    await expect(page.getByText("Kemungkinan sudah ada")).toBeVisible();
    await page.getByLabel("Impor transaksi 1").uncheck();
    await page.getByRole("button", { name: "Impor 1 transaksi" }).click();
    await expect(page.getByText("1 transaksi diimpor sebagai Perlu ditinjau.")).toBeVisible();

    expect(state.getImportedPayloads()).toHaveLength(1);
    expect(state.getImportedPayloads()[0]).toEqual([expect.objectContaining({
      merchant: "Bonus",
      status: "needs_review",
      source: "manual",
      account_id: "idr-bank",
    })]);
  });
});
