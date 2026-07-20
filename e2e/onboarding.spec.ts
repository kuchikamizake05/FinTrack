import type { Page, Route } from "@playwright/test";
import { expect, mockAuthenticatedSession, test, user } from "./fixtures";

const dashboardHeading = /^(?:Keuanganmu|Kondisi keuangan bulan ini)$/;

type MockState = {
  account: null | {
    id: string;
    name: string;
    currency: string;
    current_balance: number;
    institution?: string | null;
    kind?: "bank";
    reporting_balance_idr?: number | null;
    is_active?: boolean;
    updated_at?: string;
  };
  transaction: null | { id: string; type: "income" | "expense"; amount: number; merchant: string; category: string; date: string; account_id: string };
  failNextAccountSave?: boolean;
  failNextTransactionSave?: boolean;
};

async function fulfillRows(route: Route, rows: unknown[]) {
  const accept = route.request().headers().accept ?? "";
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" },
    body: JSON.stringify(accept.includes("application/vnd.pgrst.object+json") ? (rows[0] ?? null) : rows),
  });
}

async function mockOnboardingSupabase(page: Page, initial: Partial<MockState> = {}) {
  const state: MockState = { account: null, transaction: null, ...initial };
  await mockAuthenticatedSession(page, false);
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }

    if (url.pathname === "/rest/v1/financial_accounts") {
      if (request.method() === "POST") {
        if (state.failNextAccountSave) {
          state.failNextAccountSave = false;
          await route.fulfill({ status: 503, json: { message: "temporary account failure" } });
          return;
        }
        const payload = request.postDataJSON() as { name: string; currency: string; current_balance: number };
        state.account = {
          id: "account-1",
          name: payload.name,
          currency: payload.currency,
          current_balance: Number(payload.current_balance),
          institution: null,
          kind: "bank",
          reporting_balance_idr: null,
          is_active: true,
          updated_at: "2026-07-20T08:00:00.000Z",
        };
        await fulfillRows(route, [state.account]);
        return;
      }
      await fulfillRows(route, state.account ? [{
        institution: null,
        kind: "bank",
        reporting_balance_idr: null,
        is_active: true,
        updated_at: "2026-07-20T08:00:00.000Z",
        ...state.account,
      }] : []);
      return;
    }

    if (url.pathname === "/rest/v1/transactions") {
      if (request.method() === "POST") {
        if (state.failNextTransactionSave) {
          state.failNextTransactionSave = false;
          await route.fulfill({ status: 503, json: { message: "temporary transaction failure" } });
          return;
        }
        const raw = request.postDataJSON() as Array<{ type: "income" | "expense"; amount: number; merchant: string; category: string; date: string; account_id: string }>;
        const payload = raw[0];
        state.transaction = { id: "transaction-1", ...payload, amount: Number(payload.amount) };
        if (state.account) state.account.current_balance += payload.type === "income" ? Number(payload.amount) : -Number(payload.amount);
        await fulfillRows(route, [state.transaction]);
        return;
      }
      await fulfillRows(route, state.transaction ? [state.transaction] : []);
      return;
    }

    if (url.pathname === "/rest/v1/financial_goals") {
      await fulfillRows(route, []);
      return;
    }

    await route.fulfill({ status: 404, json: { message: `Unmocked E2E route: ${url.pathname}` } });
  });
  return state;
}

async function chooseIntentAndCreateAccount(page: Page) {
  await page.getByRole("button", { name: /Rapikan arus kas/ }).click();
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await expect(page.getByRole("heading", { name: "Di mana uangmu paling sering bergerak?" })).toBeVisible();
  await page.getByLabel("Nama akun").fill("BCA Utama");
  await page.getByLabel("Saldo awal").fill("1000000");
  await page.getByRole("button", { name: /Simpan akun/ }).click();
  await expect(page.getByRole("heading", { name: "Catat satu aktivitas nyata." })).toBeVisible();
}

test.describe("premium onboarding @critical", () => {
  test("empty user completes a real account and transaction flow", async ({ page }) => {
    await mockOnboardingSupabase(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Apa yang ingin kamu rapikan dulu?" })).toBeVisible();

    await page.getByRole("button", { name: "Lanjutkan" }).click();
    await expect(page.getByText(/Pilih fokus utama agar/)).toBeVisible();
    await chooseIntentAndCreateAccount(page);

    await page.getByRole("button", { name: /Simpan transaksi/ }).click();
    await expect(page.getByText("Nama merchant atau sumber wajib diisi.")).toBeVisible();
    await page.getByLabel("Nominal").fill("125000");
    await page.getByLabel("Merchant atau tujuan").fill("Supermarket");
    await page.getByRole("button", { name: /Simpan transaksi/ }).click();

    await expect(page.getByRole("heading", { name: "Sekarang angkamu punya konteks." })).toBeVisible();
    await expect(page.getByText(/Rp\s*875\.000/)).toBeVisible();
    await page.getByRole("button", { name: /Buka dashboard/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: dashboardHeading })).toBeVisible();
  });

  test("refresh resumes after the account step and deferral can resume from dashboard", async ({ page }) => {
    await mockOnboardingSupabase(page);
    await page.goto("/onboarding");
    await chooseIntentAndCreateAccount(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Catat satu aktivitas nyata." })).toBeVisible();
    await page.getByRole("button", { name: "Lanjutkan nanti" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const setupCard = page.getByRole("region", { name: /Progres penyiapan|Selesaikan penyiapan FinTrack/ });
    await expect(setupCard).toBeVisible();
    await setupCard.getByRole("button", { name: /Lanjutkan penyiapan|Selesaikan penyiapan/ }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Catat satu aktivitas nyata." })).toBeVisible();
  });

  test.describe("save recovery", () => {
    test.use({ allowedConsoleErrors: ["Failed to load resource: the server responded with a status of 503"] });

    test("a failed account save preserves input and succeeds on retry", async ({ page }) => {
      await mockOnboardingSupabase(page, { failNextAccountSave: true });
      await page.goto("/onboarding");
      await page.getByRole("button", { name: /Pantau saldo/ }).click();
      await page.getByRole("button", { name: "Lanjutkan" }).click();
      await page.getByLabel("Nama akun").fill("Jago Harian");
      await page.getByRole("button", { name: /Simpan akun/ }).click();
      await expect(page.getByText(/Inputmu tetap aman/)).toBeVisible();
      await expect(page.getByLabel("Nama akun")).toHaveValue("Jago Harian");
      await page.getByRole("button", { name: /Simpan akun/ }).click();
      await expect(page.getByRole("heading", { name: "Catat satu aktivitas nyata." })).toBeVisible();
    });
  });

  test("legacy data bypasses onboarding", async ({ page }) => {
    await mockOnboardingSupabase(page, { account: { id: "legacy-account", name: "Akun Lama", currency: "IDR", current_balance: 500000 } });
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: dashboardHeading })).toBeVisible();
  });

  test("has no page-level horizontal overflow", async ({ page }) => {
    await mockOnboardingSupabase(page);
    await page.goto("/onboarding");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
