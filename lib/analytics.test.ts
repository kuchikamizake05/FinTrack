import { describe, expect, it } from "vitest";
import { buildWeeklyEquitySeries, calculateTradingPerformance } from "./analytics";

describe("buildWeeklyEquitySeries", () => {
  it("keeps the latest manual snapshot from each week", () => {
    expect(buildWeeklyEquitySeries([
      { recordedAt: "2026-07-01T08:00:00.000Z", equity: 1_000 },
      { recordedAt: "2026-07-03T08:00:00.000Z", equity: 1_100 },
      { recordedAt: "2026-07-09T08:00:00.000Z", equity: 1_250 },
    ])).toEqual([
      { week: "2026-W27", equity: 1_100 },
      { week: "2026-W28", equity: 1_250 },
    ]);
  });
});

describe("calculateTradingPerformance", () => {
  it("calculates win rate, profit factor, and max drawdown from closed trades", () => {
    expect(calculateTradingPerformance([
      { netPnl: 100 },
      { netPnl: -40 },
      { netPnl: 60 },
      { netPnl: -80 },
    ])).toEqual({ winRate: 50, profitFactor: 1.33, maxDrawdown: 80, totalPnl: 40 });
  });
});
