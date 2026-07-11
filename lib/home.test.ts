import { describe, expect, it } from "vitest";
import {
  buildCumulativeCashFlowSeries,
  calculateAccountMonthlyMovement,
  calculateGoalProgress,
  getTimeGreeting,
  maskAmount,
} from "./home";

describe("home dashboard helpers", () => {
  it("uses an Indonesian greeting that follows the local hour", () => {
    expect(getTimeGreeting(7)).toBe("Selamat pagi");
    expect(getTimeGreeting(13)).toBe("Selamat siang");
    expect(getTimeGreeting(18)).toBe("Selamat sore");
    expect(getTimeGreeting(22)).toBe("Selamat malam");
  });

  it("masks an amount without changing the visible value when enabled", () => {
    expect(maskAmount("Rp1.250.000", true)).toBe("Rp1.250.000");
    expect(maskAmount("Rp1.250.000", false)).toBe("Rp••••••");
  });

  it("calculates a capped goal progress and remaining amount", () => {
    expect(calculateGoalProgress(250_000, 1_000_000)).toEqual({
      percentage: 25,
      remaining: 750_000,
    });
    expect(calculateGoalProgress(1_200_000, 1_000_000)).toEqual({
      percentage: 100,
      remaining: 0,
    });
  });

  it("summarises income and expenses per account for the selected month", () => {
    const movement = calculateAccountMonthlyMovement([
      { accountId: "jago", type: "income", amount: 3_000_000 },
      { accountId: "jago", type: "expense", amount: 750_000 },
      { accountId: "bri", type: "expense", amount: 200_000 },
    ]);

    expect(movement.get("jago")).toBe(2_250_000);
    expect(movement.get("bri")).toBe(-200_000);
  });

  it("builds cumulative cash-flow points across sparse transaction days", () => {
    expect(buildCumulativeCashFlowSeries([
      { date: "2026-07-01", type: "income", amount: 5_000_000 },
      { date: "2026-07-07", type: "expense", amount: 750_000 },
      { date: "2026-07-10", type: "income", amount: 2_000_000 },
      { date: "2026-07-13", type: "expense", amount: 250_000 },
    ], [1, 7, 13])).toEqual([
      { day: 1, label: "1 Jul", income: 5_000_000, expense: 0 },
      { day: 7, label: "7 Jul", income: 5_000_000, expense: 750_000 },
      { day: 13, label: "13 Jul", income: 7_000_000, expense: 1_000_000 },
    ]);
  });

  it("returns stable zero-value cash-flow points when the month is empty", () => {
    expect(buildCumulativeCashFlowSeries([], [1, 15, 31])).toEqual([
      { day: 1, label: "1 Jul", income: 0, expense: 0 },
      { day: 15, label: "15 Jul", income: 0, expense: 0 },
      { day: 31, label: "31 Jul", income: 0, expense: 0 },
    ]);
  });
});
