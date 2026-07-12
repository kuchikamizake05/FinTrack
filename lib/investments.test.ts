import { describe, expect, it } from "vitest";
import { buildInvestmentPositions, filterStockExecutions, validateExecutionForm, validateSnapshotForm } from "./investments";

const executions = [
  { id: "3", ticker: "BBCA", side: "sell" as const, quantity: 2, price: 150, fee: 2, executed_at: "2026-03-03", account_id: "broker" },
  { id: "2", ticker: "TLKM", side: "buy" as const, quantity: 5, price: 80, fee: 0, executed_at: "2026-03-02", account_id: "broker" },
  { id: "1", ticker: "BBCA", side: "buy" as const, quantity: 10, price: 100, fee: 10, executed_at: "2026-03-01", account_id: "broker" },
];

describe("investment positions", () => {
  it("groups executions chronologically and sorts positions by remaining cost basis", () => {
    const positions = buildInvestmentPositions(executions);
    expect(positions.map((position) => position.ticker)).toEqual(["BBCA", "TLKM"]);
    expect(positions[0].summary).toMatchObject({ quantity: 8, costBasis: 808, averageCost: 101, realizedPnl: 96 });
  });

  it("filters the execution journal by side, ticker, and account name", () => {
    const accountNames = new Map([["broker", "Stockbit utama"]]);
    expect(filterStockExecutions(executions, { side: "buy", search: "stockbit" }, accountNames).map((item) => item.id)).toEqual(["2", "1"]);
    expect(filterStockExecutions(executions, { side: "all", search: "bbca" }, accountNames).map((item) => item.id)).toEqual(["3", "1"]);
  });
});

describe("investment forms", () => {
  it("validates execution identity and numeric values", () => {
    expect(validateExecutionForm({ accountId: "", ticker: "", quantity: "0", price: "-1", fee: "-2", executedAt: "" })).toBeTruthy();
    expect(validateExecutionForm({ accountId: "broker", ticker: "bbca", quantity: "10", price: "100", fee: "0", executedAt: "2026-03-01T10:00" })).toBeNull();
  });

  it("validates snapshots without rejecting zero equity", () => {
    expect(validateSnapshotForm({ accountId: "", equity: "100", recordedAt: "" })).toBeTruthy();
    expect(validateSnapshotForm({ accountId: "broker", equity: "0", recordedAt: "2026-03-01T10:00" })).toBeNull();
  });
});
