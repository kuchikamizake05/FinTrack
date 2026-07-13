import { describe, expect, it } from "vitest";
import { calculateForexRMultiple, calculateTradingJournalMetrics, filterForexTrades, summarizeStockPosition, validateForexTradeForm } from "./trading";

describe("summarizeStockPosition", () => {
  it("tracks weighted-average cost basis and realized profit after a partial sale", () => {
    expect(
      summarizeStockPosition([
        { side: "buy", quantity: 10, price: 100, fee: 10 },
        { side: "buy", quantity: 10, price: 120, fee: 10 },
        { side: "sell", quantity: 5, price: 150, fee: 10 },
      ]),
    ).toEqual({
      quantity: 15,
      costBasis: 1_665,
      averageCost: 111,
      realizedPnl: 185,
      oversoldQuantity: 0,
    });
  });

  it("flags sales that exceed the recorded position instead of inventing a cost basis", () => {
    expect(
      summarizeStockPosition([
        { side: "buy", quantity: 2, price: 100, fee: 0 },
        { side: "sell", quantity: 3, price: 120, fee: 0 },
      ]),
    ).toMatchObject({ quantity: 0, costBasis: 0, realizedPnl: 40, oversoldQuantity: 1 });
  });
});

describe("calculateForexRMultiple", () => {
  it("expresses a profitable closed trade relative to its planned cash risk", () => {
    expect(calculateForexRMultiple({ netPnl: 250, riskAmount: 100 })).toBe(2.5);
  });

  it("returns null when the original risk is absent or invalid", () => {
    expect(calculateForexRMultiple({ netPnl: 250, riskAmount: 0 })).toBeNull();
  });
});

describe("trading journal", () => {
  const trades = [
    { symbol: "EURUSD", status: "closed" as const, direction: "long" as const, net_pnl: 200, risk_amount: 100, setup_tag: "Breakout" },
    { symbol: "XAUUSD", status: "closed" as const, direction: "short" as const, net_pnl: -50, risk_amount: 50, setup_tag: "Reversal" },
    { symbol: "GBPUSD", status: "open" as const, direction: "long" as const, net_pnl: 0, risk_amount: 75, setup_tag: null },
  ];

  it("summarizes closed performance and open exposure", () => {
    expect(calculateTradingJournalMetrics(trades)).toEqual({ open: 1, closed: 2, pnl: 150, winRate: 50, averageR: 0.5 });
  });

  it("filters by status and journal text", () => {
    expect(filterForexTrades(trades, { status: "closed", search: "reversal" }).map((trade) => trade.symbol)).toEqual(["XAUUSD"]);
  });

  it("requires exit data for a closed trade", () => {
    const base = { accountId: "broker", symbol: "EURUSD", lotSize: "0.1", entryPrice: "1.1", commission: "0", swap: "0", grossPnl: "20", exitPrice: "", stopLoss: "1", takeProfit: "1.2", riskAmount: "10", openedAt: "2026-01-01T10:00", closedAt: "" };
    expect(validateForexTradeForm({ ...base, status: "closed" })).toBeTruthy();
    expect(validateForexTradeForm({ ...base, status: "closed", exitPrice: "1.2", closedAt: "2026-01-01T11:00" })).toBeNull();
  });
});
