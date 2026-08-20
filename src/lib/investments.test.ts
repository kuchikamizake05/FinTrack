import { describe, expect, it } from "vitest";
import { buildInvestmentPositions, filterStockExecutions, validateExecutionForm, validateSnapshotForm } from "./investments";

const executions = [
  { id: "3", ticker: "BBCA", side: "sell" as const, quantity: 2, price: 150, fee: 2, executed_at: "2026-03-03", account_id: "broker", currency: "IDR" },
  { id: "2", ticker: "TLKM", side: "buy" as const, quantity: 5, price: 80, fee: 0, executed_at: "2026-03-02", account_id: "broker", currency: "IDR" },
  { id: "1", ticker: "BBCA", side: "buy" as const, quantity: 10, price: 100, fee: 10, executed_at: "2026-03-01", account_id: "broker", currency: "IDR" },
];

describe("investment positions", () => {
  it("groups executions chronologically and sorts positions by remaining cost basis", () => {
    const positions = buildInvestmentPositions(executions, "IDR");
    expect(positions.map((position) => position.ticker)).toEqual(["BBCA", "TLKM"]);
    expect(positions[0].summary).toMatchObject({ quantity: 8, costBasis: 808, averageCost: 101, realizedPnl: 96 });
  });

  it("keeps matching tickers from different accounts separate", () => {
    const positions = buildInvestmentPositions([
      ...executions,
      { id: "4", ticker: "BBCA", side: "buy" as const, quantity: 4, price: 50, fee: 0, executed_at: "2026-03-04", account_id: "second-broker", currency: "IDR" },
      { id: "5", ticker: "BBCA", side: "buy" as const, quantity: 3, price: 20, fee: 0, executed_at: "2026-03-05", account_id: "usd-broker", currency: "USD" },
    ], "IDR");

    expect(positions.filter((position) => position.ticker === "BBCA")).toMatchObject([
      { accountId: "broker", currency: "IDR", summary: { quantity: 8 } },
      { accountId: "second-broker", currency: "IDR", summary: { quantity: 4 } },
    ]);
  });

  it("filters the execution journal by side, ticker, and account name", () => {
    const accountNames = new Map([["broker", "Stockbit utama"]]);
    expect(filterStockExecutions(executions, { side: "buy", search: "stockbit" }, accountNames).map((item) => item.id)).toEqual(["2", "1"]);
    expect(filterStockExecutions(executions, { side: "all", search: "bbca" }, accountNames).map((item) => item.id)).toEqual(["3", "1"]);
  });

  it("recalculates open position after deleting an execution from its source list", () => {
    const remaining = executions.filter((execution) => execution.id !== "3");
    expect(buildInvestmentPositions(remaining, "IDR").find((position) => position.ticker === "BBCA")?.summary).toMatchObject({ quantity: 10, costBasis: 1_010, realizedPnl: 0 });
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
