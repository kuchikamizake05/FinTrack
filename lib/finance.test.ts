import { describe, expect, it } from "vitest";
import { buildCategoryTotals, calculateSummary, filterTransactions } from "./finance";

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
  });
});
