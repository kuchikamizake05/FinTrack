import { describe, expect, it } from "vitest";
import {
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
});
