import { describe, expect, it } from "vitest";
import { buildPortfolioWeeklyEquitySeries, buildWeeklyEquitySeries, calculatePercentageChange, calculateTradingPerformance } from "./analytics";

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

describe("buildPortfolioWeeklyEquitySeries", () => {
  it("carries the latest value of each account to form one portfolio curve", () => {
    expect(buildPortfolioWeeklyEquitySeries([
      { accountId: "stockbit", recordedAt: "2026-07-01T08:00:00.000Z", equity: 1_000 },
      { accountId: "bibit", recordedAt: "2026-07-02T08:00:00.000Z", equity: 500 },
      { accountId: "stockbit", recordedAt: "2026-07-09T08:00:00.000Z", equity: 1_200 },
    ])).toEqual([
      { week: "2026-W27", equity: 1_500 },
      { week: "2026-W28", equity: 1_700 },
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

describe("calculatePercentageChange", () => {
  it("compares a current value to a prior value without dividing by zero", () => {
    expect(calculatePercentageChange(120, 100)).toBe(20);
    expect(calculatePercentageChange(10, 0)).toBeNull();
  });
});
