import { describe, expect, it } from "vitest";
import {
  buildBudgetProgress,
  buildFinancialAlerts,
  buildImportMatchPreview,
  buildReconciliation,
  buildReconciliationReviewSummary,
  getIdrBudgetScope,
  buildRecurringTransactionDraft,
  parseTransactionCsv,
  serializeTransactionsCsv,
} from "./financial-control";

describe("financial control helpers", () => {
  const transactions = [
    { id: "1", date: "2026-08-02", type: "expense" as const, category: "Makan", amount: 80_000, status: "confirmed" as const, merchant: "Warung", note: null },
    { id: "2", date: "2026-08-03", type: "expense" as const, category: "Makan", amount: 15_000, status: "needs_review" as const, merchant: "Kopi", note: null },
  ];

  it("measures confirmed spending against a category budget", () => {
    expect(buildBudgetProgress({ category: "Makan", limitAmount: 100_000, month: "2026-08" }, transactions)).toMatchObject({ spentAmount: 80_000, percentage: 80, state: "warning" });
  });

  it("creates the next recurring transaction without changing its schedule", () => {
    expect(buildRecurringTransactionDraft({ merchant: "Netflix", category: "Tagihan", amount: 65_000, type: "expense", accountId: "a1", nextRunDate: "2026-08-20", interval: "monthly" })).toEqual({ date: "2026-08-20", merchant: "Netflix", category: "Tagihan", amount: 65_000, type: "expense", accountId: "a1", source: "recurring" });
  });

  it("keeps budgets IDR-only and discloses excluded spending", () => {
    const scope = getIdrBudgetScope([
      { ...transactions[0], account_id: "idr" },
      { ...transactions[1], account_id: "usd", status: "confirmed" as const },
    ], new Map([["idr", "IDR"], ["usd", "USD"]]));

    expect(scope.idrTransactions).toHaveLength(1);
    expect(scope.excludedExpenseCount).toBe(1);
  });

  it("exports data safely and imports a valid user-editable CSV", () => {
    const csv = serializeTransactionsCsv(transactions);
    expect(csv).toContain('"Warung"');
    expect(parseTransactionCsv("date,type,merchant,category,amount,note\n2026-08-04,expense,Parkir,Transportasi,5000,Mal")).toEqual([{ date: "2026-08-04", type: "expense", merchant: "Parkir", category: "Transportasi", amount: 5000, note: "Mal" }]);
  });

  it("flags an account balance difference and ledger work requiring attention", () => {
    expect(buildReconciliation({ expectedBalance: 1_000_000, statementBalance: 950_000 })).toEqual({ difference: -50_000, isMatched: false });
    expect(buildFinancialAlerts({ budgets: [{ category: "Makan", limitAmount: 100_000, month: "2026-08" }], transactions, accountFreshness: [{ accountName: "BCA", lastUpdatedAt: "2026-07-01" }], today: "2026-08-17" }).map((alert) => alert.kind)).toEqual(["budget", "review", "balance_freshness"]);
  });

  it("flags existing and in-file CSV duplicates without blocking review import", () => {
    const imported = parseTransactionCsv("date,type,merchant,category,amount,note\n2026-08-02,expense,Warung,Makan,80000,\n2026-08-02,expense,  warung  , Makan ,80000,");
    expect(buildImportMatchPreview(imported, [transactions[0]])).toMatchObject([
      { index: 0, duplicateOfExisting: true, duplicateOfBatch: false, isDuplicate: true },
      { index: 1, duplicateOfExisting: true, duplicateOfBatch: true, isDuplicate: true },
    ]);
  });

  it("summarizes review transactions without treating them as confirmed", () => {
    expect(buildReconciliationReviewSummary(transactions)).toEqual({ count: 1, incomeAmount: 0, expenseAmount: 15_000, netAmount: -15_000 });
  });
});
