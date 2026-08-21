import { describe, expect, it } from "vitest";
import { buildFinancialReport, serializeFinancialReportCsv, serializeRichTransactionCsv } from "./reporting";

const report = buildFinancialReport([
  { date: "2026-08-01", type: "income", merchant: "=Payroll", category: "Gaji", amount: 1_000_000, note: null, status: "confirmed", source: "manual", account_id: "idr" },
  { date: "2026-08-02", type: "expense", merchant: "Warung, \"Rasa\"", category: "Makan", amount: 20, note: "line one\nline two", status: "confirmed", source: "manual", account_id: "usd" },
  { date: "2026-08-03", type: "expense", merchant: "Review", category: "Makan", amount: 30, note: null, status: "needs_review", source: "manual", account_id: "usd" },
], new Map([["idr", "Dompet IDR"], ["usd", "Broker USD"]]), new Map([["idr", "IDR"], ["usd", "USD"]]), new Map([
  ["IDR", { base: "IDR", quote: "IDR" as const, rate: 1, providerDate: null, retrievedAt: "2026-08-21T00:00:00.000Z", state: "fresh" as const }],
  ["USD", { base: "USD", quote: "IDR" as const, rate: null, providerDate: null, retrievedAt: null, state: "missing" as const }],
]));

describe("reporting helpers", () => {
  it("keeps confirmed currency totals separate when a rate is missing", () => {
    expect(report.currencyGroups).toMatchObject([
      { currency: "IDR", income: 1_000_000, expense: 0, convertedNetIdr: 1_000_000 },
      { currency: "USD", income: 0, expense: 20, convertedNetIdr: null },
    ]);
    expect(report.categoryTotals).toEqual([{ currency: "USD", category: "Makan", amount: 20 }]);
  });

  it("exports rich rows without private fields and neutralizes spreadsheet formulas", () => {
    const csv = serializeRichTransactionCsv(report);
    expect(csv).toContain("'=Payroll");
    expect(csv).toContain('"Warung, ""Rasa"""');
    expect(csv).not.toContain("account_id");
    expect(csv).not.toContain("receipt_url");
  });

  it("writes missing FX conversions as blank report cells", () => {
    const csv = serializeFinancialReportCsv(report, { generatedAt: "2026-08-21T00:00:00.000Z", filterSummary: "Semua transaksi" });
    expect(csv).toContain('"USD","0","20","-20","","",""');
    expect(csv).toContain('"missing"');
  });
});
