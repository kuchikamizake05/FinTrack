import type { Page, Route } from "@playwright/test";
import { expect, mockAuthenticatedSession, test, user, userId } from "./fixtures";

const report = {
  id: "report-august",
  period_start: "2026-08-01",
  period_end: "2026-08-31",
  generated_at: "2026-09-01T01:17:00.000Z",
  currency_groups: [
    { currency: "IDR", income: 5_000_000, expense: 1_250_000, net: 3_750_000, convertedIncomeIdr: 5_000_000, convertedExpenseIdr: 1_250_000, convertedNetIdr: 3_750_000, rate: { rate: 1, providerDate: null, retrievedAt: "2026-09-01T01:17:00.000Z", state: "fresh" } },
    { currency: "USD", income: 0, expense: 50, net: -50, convertedIncomeIdr: null, convertedExpenseIdr: null, convertedNetIdr: null, rate: { rate: null, providerDate: null, retrievedAt: null, state: "missing" } },
  ],
  category_totals: [
    { currency: "IDR", category: "Kebutuhan", amount: 750_000 },
    { currency: "IDR", category: "Transportasi", amount: 500_000 },
    { currency: "USD", category: "Langganan", amount: 50 },
  ],
  csv_path: `${userId}/2026-08.csv`,
};

async function fulfillRows(route: Route, rows: unknown[]) {
  const acceptsObject = route.request().headers()["accept"]?.includes("application/vnd.pgrst.object+json");
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" },
    body: JSON.stringify(acceptsObject ? (rows[0] ?? null) : rows),
  });
}

async function mockReportsPage(page: Page) {
  let schedule = { is_active: false, enabled_from_period: null as string | null };
  const scheduleWrites: Array<{ user_id: string; is_active: boolean; enabled_from_period: string | null }> = [];
  let signedRequests = 0;
  await mockAuthenticatedSession(page);
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      return;
    }
    if (url.pathname === "/rest/v1/monthly_report_schedules") {
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as typeof schedule & { user_id: string };
        schedule = { is_active: payload.is_active, enabled_from_period: payload.enabled_from_period };
        scheduleWrites.push(payload);
        await fulfillRows(route, []);
        return;
      }
      await fulfillRows(route, schedule.enabled_from_period === null && !schedule.is_active ? [] : [schedule]);
      return;
    }
    if (url.pathname === "/rest/v1/monthly_financial_reports") {
      await fulfillRows(route, [report]);
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/financial-reports/")) {
      signedRequests++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedURL: "/storage/v1/object/sign/financial-reports/download-token" }) });
      return;
    }
    await fulfillRows(route, []);
  });
  return { scheduleWrites, getSignedRequests: () => signedRequests };
}

test.describe("monthly reports @critical", () => {
  test("enables schedule, renders immutable archive, and signs CSV download", async ({ page }) => {
    const state = await mockReportsPage(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, "open", { value: () => null, writable: true });
    });

    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Laporan bulanan" })).toBeVisible();
    await expect(page.getByText("Ringkasan Agustus 2026")).toBeVisible();
    await expect(page.getByText("Kebutuhan")).toBeVisible();
    await expect(page.getByText("Kurs tidak tersedia")).toBeVisible();

    await page.getByRole("button", { name: "Aktifkan laporan" }).click();
    await expect(page.getByText("Laporan bulanan diaktifkan.")).toBeVisible();
    await expect.poll(() => state.scheduleWrites.length).toBe(1);
    expect(state.scheduleWrites[0]).toMatchObject({ user_id: userId, is_active: true });
    expect(state.scheduleWrites[0].enabled_from_period).toMatch(/^\d{4}-\d{2}-01$/);

    await page.getByRole("button", { name: "Unduh CSV" }).click();
    await expect.poll(state.getSignedRequests).toBe(1);

    await page.getByRole("button", { name: "Nonaktifkan" }).click();
    await expect(page.getByText("Laporan bulanan dinonaktifkan. Arsip lama tetap tersedia.")).toBeVisible();
    await expect(page.getByText("Ringkasan Agustus 2026")).toBeVisible();
    expect(state.scheduleWrites.at(-1)).toMatchObject({ user_id: userId, is_active: false });
  });
});
