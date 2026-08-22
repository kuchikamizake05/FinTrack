import type { Page, Route } from "@playwright/test";
import { expect, mockAuthenticatedSession, test, user } from "./fixtures";

const account = {
  id: "account-1",
  name: "BCA Utama",
  currency: "IDR",
};

const category = {
  id: "category-income",
  user_id: user.id,
  name: "Pemasukan lain",
  type: "income" as const,
  icon: "Wallet",
  color: "#166534",
  created_at: "2026-01-01T00:00:00.000Z",
};

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  merchant: string | null;
  category: string;
  amount: number;
  note: string | null;
  source: "manual";
  status: "confirmed" | "needs_review";
  account_id: string;
  receipt_url: null;
  ai_confidence: null;
  raw_text: null;
  created_at: string;
  updated_at: string;
};

async function fulfillRows(route: Route, rows: unknown[]) {
  await route.fulfill({
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0",
    },
    body: JSON.stringify(rows),
  });
}

async function mockTransactionScanPage(page: Page) {
  const transactions: Transaction[] = [];
  const transactionPayloads: unknown[] = [];
  let parserRequests = 0;

  await mockAuthenticatedSession(page);
  await page.route("**/api/receipts/parse", async (route) => {
    parserRequests += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["content-type"]).toContain("multipart/form-data");
    await route.fulfill({
      status: 200,
      json: {
        extraction: {
          date: "2026-08-22",
          merchant: "Transfer Gaji",
          amount: 7500000,
          categoryHint: "Pemasukan lain",
          type: "income",
          proofKind: "transfer",
          note: "Gaji Agustus",
          rawText: null,
          confidence: null,
        },
      },
    });
  });
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }
    if (url.pathname === "/rest/v1/financial_accounts") {
      await fulfillRows(route, [account]);
      return;
    }
    if (url.pathname === "/rest/v1/categories") {
      await fulfillRows(route, [category]);
      return;
    }
    if (url.pathname === "/rest/v1/transactions") {
      if (request.method() === "POST") {
        const payload = (request.postDataJSON() as Array<Omit<Transaction, "id" | "receipt_url" | "ai_confidence" | "raw_text" | "created_at" | "updated_at">>)[0];
        transactionPayloads.push(payload);
        transactions.unshift({
          ...payload,
          id: "scan-transaction-1",
          receipt_url: null,
          ai_confidence: null,
          raw_text: null,
          created_at: "2026-08-22T08:00:00.000Z",
          updated_at: "2026-08-22T08:00:00.000Z",
        });
        await fulfillRows(route, [transactions[0]]);
        return;
      }
      if (request.method() === "PATCH") {
        const payload = request.postDataJSON() as Partial<Transaction>;
        transactionPayloads.push(payload);
        const current = transactions[0];
        if (current) Object.assign(current, payload);
        await fulfillRows(route, current ? [current] : []);
        return;
      }
      await fulfillRows(route, transactions);
      return;
    }
    await fulfillRows(route, []);
  });

  return { getParserRequests: () => parserRequests, getTransactionPayloads: () => transactionPayloads };
}

test.describe("receipt scan review flow @critical", () => {
  test("parses image, keeps proof data out of ledger payload, then requires approval", async ({ page }) => {
    const state = await mockTransactionScanPage(page);
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Catat" }).click();

    const inputs = page.locator('input[type="file"]');
    await expect(inputs).toHaveCount(2);
    await inputs.nth(0).setInputFiles({ name: "transfer.png", mimeType: "image/png", buffer: Buffer.from("fake image") });

    await expect(page.getByRole("status")).toContainText("Data struk berhasil diekstrak otomatis");
    await expect(page.getByLabel("Merchant atau sumber")).toHaveValue("Transfer Gaji");
    await expect(page.getByLabel("Nominal")).toHaveValue("7500000");
    await expect(page.getByRole("button", { name: "Pemasukan" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Hasil scan sesi ini").locator("..")).toContainText("Transfer Gaji");
    expect(state.getParserRequests()).toBe(1);

    await page.getByLabel("Akun").selectOption(account.id);
    await page.getByRole("button", { name: "Simpan transaksi" }).click();

    await expect.poll(() => state.getTransactionPayloads().length).toBe(1);
    const [createPayload] = state.getTransactionPayloads() as Array<Record<string, unknown>>;
    expect(createPayload).toMatchObject({ status: "needs_review", source: "manual", merchant: "Transfer Gaji", type: "income" });
    expect(JSON.stringify(createPayload)).not.toMatch(/rawText|confidence|receipt_url|image|transfer\.png/i);

    await page.getByRole("button", { name: "Setujui" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Setujui transaksi" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(state.getTransactionPayloads()).toContainEqual({ status: "confirmed" });
  });
});
