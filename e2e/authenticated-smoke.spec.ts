import { expect, mockSupabase, test } from "./fixtures";

const routes = [
  ["/dashboard", /^(?:Keuanganmu|Kondisi keuangan bulan ini)$/],
  ["/transactions", "Transaksi"],
  ["/accounts", "Akun & saldo"],
  ["/categories", "Kategori"],
  ["/investments", "Investasi"],
  ["/trading", "Trading"],
  ["/settings", "Pengaturan"],
  ["/insights", "Smart Insights"],
] as const;

test("authenticated application routes render with controlled read-only data @smoke", async ({ page }) => {
  await mockSupabase(page, true);
  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
});
