import type { Page, Route } from "@playwright/test";
import { expect, mockAuthenticatedSession, mockSupabase, test, user } from "./fixtures";

const account = {
  id: "account-1",
  name: "BCA Utama",
  currency: "IDR",
  current_balance: 1_000_000,
  is_active: true,
};

const transaction = {
  id: "transaction-1",
  date: "2026-08-10",
  type: "expense" as const,
  merchant: "Belanja bulanan",
  category: "Kebutuhan",
  amount: 125_000,
  note: null,
  source: "manual",
  receipt_url: null,
  ai_confidence: null,
  status: "confirmed" as const,
  created_at: "2026-08-10T08:00:00.000Z",
  account_id: account.id,
};

const category = {
  id: "category-1",
  user_id: user.id,
  name: "Kebutuhan",
  type: "expense" as const,
  icon: "ShoppingBag",
  color: "#166534",
  created_at: "2026-01-01T00:00:00.000Z",
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

async function mockTransactionsPage(page: Page) {
  let deleteRequests = 0;
  let deleted = false;
  await mockAuthenticatedSession(page);
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
      if (request.method() === "PATCH") {
        deleteRequests += 1;
        deleted = true;
        await fulfillRows(route, []);
        return;
      }
      await fulfillRows(route, deleted ? [{ ...transaction, status: "deleted" }] : [transaction]);
      return;
    }
    await fulfillRows(route, []);
  });
  return () => deleteRequests;
}

async function mockCategoriesPage(page: Page) {
  let deleteRequests = 0;
  let deleted = false;
  await mockAuthenticatedSession(page);
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }
    if (url.pathname === "/rest/v1/categories") {
      if (request.method() === "DELETE") {
        deleteRequests += 1;
        deleted = true;
        await fulfillRows(route, []);
        return;
      }
      await fulfillRows(route, deleted ? [] : [category]);
      return;
    }
    if (url.pathname === "/rest/v1/transactions") {
      await fulfillRows(route, [{ category: category.name, type: "expense", amount: 125_000, status: "confirmed" }]);
      return;
    }
    if (url.pathname === "/rest/v1/financial_accounts") {
      await fulfillRows(route, [account]);
      return;
    }
    await fulfillRows(route, []);
  });
  return () => deleteRequests;
}

test.describe("keyboard and confirmation regressions @critical", () => {
  test("transaction confirmation traps focus, closes safely, and requires explicit delete", async ({ page }) => {
    const getDeleteRequests = await mockTransactionsPage(page);
    await page.goto("/transactions");

    const deleteButton = page.getByRole("button", { name: "Hapus Belanja bulanan" });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const dialog = page.getByRole("alertdialog");
    const cancel = dialog.getByRole("button", { name: "Batal" });
    const confirm = dialog.getByRole("button", { name: "Hapus transaksi" });
    await expect(dialog).toBeVisible();
    await expect(cancel).toBeFocused();
    await expect(dialog).toContainText("dipindahkan ke Sampah");

    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirm).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
    expect(getDeleteRequests()).toBe(0);

    await deleteButton.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hapus transaksi" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(getDeleteRequests()).toBe(1);
  });

  test("category confirmation preserves usage warning and focus restoration", async ({ page }) => {
    const getDeleteRequests = await mockCategoriesPage(page);
    await page.goto("/categories");

    const deleteButton = page.getByRole("button", { name: "Hapus Kebutuhan" });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const dialog = page.getByRole("alertdialog");
    const cancel = dialog.getByRole("button", { name: "Batal" });
    const confirm = dialog.getByRole("button", { name: "Hapus kategori" });
    await expect(dialog).toContainText("1 transaksi lama");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
    expect(getDeleteRequests()).toBe(0);

    await deleteButton.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hapus kategori" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(getDeleteRequests()).toBe(1);
  });

  test("skip link and profile menu support keyboard recovery", async ({ page }) => {
    await mockSupabase(page, true);
    await page.goto("/dashboard");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Lewati ke konten" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const profileTrigger = page.locator('button[aria-haspopup="menu"]:visible');
    await profileTrigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(profileTrigger).toBeFocused();
  });
});
