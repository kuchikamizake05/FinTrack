import { describe, expect, it } from "vitest";
import {
  buildCategoryTotals,
  buildEmergencyFundRunwayByCurrency,
  calculateEmergencyFundRunway,
  calculateSummary,
  filterTransactions,
  groupTransactionAmountsByCurrency,
} from "./finance";

const transactions = [
  { id: "1", date: "2026-07-01", type: "expense" as const, category: "Makanan & Minuman", amount: 25_000, status: "confirmed" as const, merchant: "Kopi" },
  { id: "2", date: "2026-07-02", type: "income" as const, category: "Freelance", amount: 500_000, status: "confirmed" as const, merchant: "Klien" },
  { id: "3", date: "2026-07-03", type: "expense" as const, category: "Transportasi", amount: 15_000, status: "pending_approval" as const, merchant: "Ojek" },
  { id: "4", date: "2026-06-30", type: "expense" as const, category: "Makanan & Minuman", amount: 40_000, status: "deleted" as const, merchant: "Makan" },
];

describe("finance helpers", () => {
  it("calculates income, expense, and balance from active transactions only", () => {
    expect(calculateSummary(transactions)).toEqual({ income: 500_000, expense: 25_000, balance: 475_000 });
  });

  it("groups only active expenses by category", () => {
    expect(buildCategoryTotals(transactions)).toEqual({ "Makanan & Minuman": 25_000 });
  });

  it("filters by text, type, category, status, and inclusive date range", () => {
    expect(filterTransactions(transactions, {
      search: "kopi",
      type: "expense",
      category: "Makanan & Minuman",
      status: "active",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
    }).map((transaction) => transaction.id)).toEqual(["1"]);
    expect(filterTransactions(transactions, {
      search: "",
      type: "all",
      category: "all",
      status: "review",
      startDate: "",
      endDate: "",
    }).map((transaction) => transaction.id)).toEqual(["3"]);
  });

  it("groups review money by currency without conversion", () => {
    const currencyByAccount = new Map([["account-idr", "IDR"], ["account-usd", "USD"]]);
    expect(groupTransactionAmountsByCurrency([
      { ...transactions[2], account_id: "account-idr" },
      { ...transactions[2], id: "5", amount: 20, status: "needs_review" as const, account_id: "account-usd" },
    ], currencyByAccount, ["pending_approval", "needs_review"])).toEqual({ IDR: 15_000, USD: 20 });
  });

  it("calculates runway from liquid balances and confirmed same-currency expenses only", () => {
    expect(calculateEmergencyFundRunway({ liquidBalance: 600_000, averageMonthlyExpense: 200_000 })).toBe(3);
    expect(calculateEmergencyFundRunway({ liquidBalance: 600_000, averageMonthlyExpense: 0 })).toBeNull();
    expect(buildEmergencyFundRunwayByCurrency([
      { id: "idr-bank", currency: "IDR", current_balance: 600_000, kind: "bank", is_active: true },
      { id: "usd-wallet", currency: "USD", current_balance: 100, kind: "ewallet", is_active: true },
      { id: "investment", currency: "IDR", current_balance: 1_000_000, kind: "investment", is_active: true },
    ], [
      { ...transactions[0], account_id: "idr-bank" },
      { ...transactions[2], account_id: "idr-bank" },
      { ...transactions[0], id: "usd", amount: 20, account_id: "usd-wallet" },
    ])).toEqual([
      { currency: "IDR", liquidBalance: 600_000, averageMonthlyExpense: 25_000, runwayMonths: 24 },
      { currency: "USD", liquidBalance: 100, averageMonthlyExpense: 20, runwayMonths: 5 },
    ]);
  });
});
