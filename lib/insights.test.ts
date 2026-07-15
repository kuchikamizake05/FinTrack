import { describe, expect, it } from "vitest";
import {
  buildInsightSnapshot,
  buildPrivateInsightPayload,
  buildDeterministicInsight,
  calculateSavingsRate,
  type InsightTransaction,
} from "./insights";

const current: InsightTransaction[] = [
  { id: "salary", date: "2026-07-01", type: "income", category: "Gaji", amount: 10_000_000, status: "confirmed", merchant: "PT Rahasia", note: "Payroll private" },
  { id: "food-1", date: "2026-07-03", type: "expense", category: "Makanan", amount: 1_500_000, status: "confirmed", merchant: "Merchant Rahasia", note: "Catatan rahasia" },
  { id: "rent", date: "2026-07-05", type: "expense", category: "Hunian", amount: 2_500_000, status: "confirmed" },
  { id: "pending", date: "2026-07-06", type: "expense", category: "Belanja", amount: 9_000_000, status: "pending_approval" },
  { id: "deleted", date: "2026-07-07", type: "expense", category: "Lainnya", amount: 99_000_000, status: "deleted" },
];

const previous: InsightTransaction[] = [
  { id: "old-salary", date: "2026-06-01", type: "income", category: "Gaji", amount: 9_000_000, status: "confirmed" },
  { id: "old-food", date: "2026-06-03", type: "expense", category: "Makanan", amount: 1_000_000, status: "confirmed" },
  { id: "old-rent", date: "2026-06-05", type: "expense", category: "Hunian", amount: 2_500_000, status: "confirmed" },
];

describe("smart insight analytics", () => {
  it("uses confirmed transactions and compares the selected period", () => {
    const snapshot = buildInsightSnapshot({ current, previous, periodLabel: "Juli 2026", previousPeriodLabel: "Juni 2026", activeAccountCount: 2, uncoveredForeignAccountCount: 1 });
    expect(snapshot.current).toMatchObject({ income: 10_000_000, expense: 4_000_000, netCashFlow: 6_000_000, confirmedCount: 3 });
    expect(snapshot.previous).toMatchObject({ income: 9_000_000, expense: 3_500_000, netCashFlow: 5_500_000 });
    expect(snapshot.savingsRate).toBe(60);
    expect(snapshot.expenseChange).toBe(14.3);
    expect(snapshot.incomeChange).toBe(11.1);
    expect(snapshot.pendingCount).toBe(1);
  });

  it("handles savings and zero-baseline boundaries", () => {
    expect(calculateSavingsRate(10_000, 2_500)).toBe(75);
    expect(calculateSavingsRate(0, 2_500)).toBeNull();
    expect(calculateSavingsRate(10_000, 12_000)).toBe(-20);
    const snapshot = buildInsightSnapshot({ current, previous: [], periodLabel: "Juli 2026", previousPeriodLabel: "Juni 2026", activeAccountCount: 1, uncoveredForeignAccountCount: 0 });
    expect(snapshot.expenseChange).toBeNull();
    expect(snapshot.incomeChange).toBeNull();
  });

  it("ranks categories, concentration, and largest movement", () => {
    const snapshot = buildInsightSnapshot({ current, previous, periodLabel: "Juli 2026", previousPeriodLabel: "Juni 2026", activeAccountCount: 2, uncoveredForeignAccountCount: 0 });
    expect(snapshot.topCategories).toEqual([
      { name: "Hunian", amount: 2_500_000, share: 62.5 },
      { name: "Makanan", amount: 1_500_000, share: 37.5 },
    ]);
    expect(snapshot.categoryConcentration).toEqual({ category: "Hunian", share: 62.5, level: "high" });
    expect(snapshot.largestCategoryMovement).toEqual({ category: "Makanan", currentAmount: 1_500_000, previousAmount: 1_000_000, changeAmount: 500_000 });
  });
});

describe("smart insight privacy and fallback", () => {
  it("builds useful deterministic fallback actions", () => {
    const snapshot = buildInsightSnapshot({ current, previous, periodLabel: "Juli 2026", previousPeriodLabel: "Juni 2026", activeAccountCount: 2, uncoveredForeignAccountCount: 1 });
    const fallback = buildDeterministicInsight(snapshot);
    expect(fallback.headline).toContain("arus kas");
    expect(fallback.actions.length).toBeGreaterThan(0);
    expect(fallback.actions.length).toBeLessThanOrEqual(3);
    expect(fallback.actions.some((action) => action.id === "review-pending")).toBe(true);
    expect(fallback.actions.some((action) => action.id === "complete-account-reporting")).toBe(true);
  });

  it("sends only bounded aggregate data to the external model", () => {
    const snapshot = buildInsightSnapshot({ current, previous, periodLabel: "Juli 2026", previousPeriodLabel: "Juni 2026", activeAccountCount: 2, uncoveredForeignAccountCount: 1 });
    const payload = buildPrivateInsightPayload(snapshot);
    const serialized = JSON.stringify(payload);
    expect(payload.version).toBe(1);
    expect(payload.topCategories).toHaveLength(2);
    expect(serialized).not.toContain("salary");
    expect(serialized).not.toContain("PT Rahasia");
    expect(serialized).not.toContain("Merchant Rahasia");
    expect(serialized).not.toContain("Catatan rahasia");
    expect(serialized).not.toContain("2026-07-03");
    expect(serialized).not.toContain("user");
  });

  it("trims category labels and limits the external category list", () => {
    const manyCategories = Array.from({ length: 8 }, (_, index) => ({
      id: `tx-${index}`,
      date: "2026-07-01",
      type: "expense" as const,
      category: `${index}-kategori-dengan-nama-yang-sangat-panjang-dan-tidak-perlu-dikirim-penuh`,
      amount: 8_000 - index * 500,
      status: "confirmed" as const,
    }));
    const snapshot = buildInsightSnapshot({ current: manyCategories, previous: [], periodLabel: "Juli 2026", previousPeriodLabel: "Juni 2026", activeAccountCount: 1, uncoveredForeignAccountCount: 0 });
    const payload = buildPrivateInsightPayload(snapshot);
    expect(payload.topCategories).toHaveLength(5);
    expect(payload.topCategories.every((category) => category.name.length <= 40)).toBe(true);
  });
});
