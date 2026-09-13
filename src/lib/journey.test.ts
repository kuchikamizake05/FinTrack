import { describe, expect, it } from "vitest";
import { journeyLevel, parseJourney, JOURNEY_MISSIONS } from "./journey";

describe("financial journey", () => {
  it("keeps earned levels at weekly resets and advances at 300 XP", () => {
    expect(journeyLevel(0)).toEqual({ level: 1, progress: 0 });
    expect(journeyLevel(299)).toEqual({ level: 1, progress: 299 });
    expect(journeyLevel(300)).toEqual({ level: 2, progress: 0 });
    expect(journeyLevel(640)).toEqual({ level: 3, progress: 40 });
  });
  it("accepts an empty authenticated journey", () => {
    expect(parseJourney({ week: "2026-09-07", totalXp: 0, completed: [], completeWeeks: 0, goalAchieved: false }).totalXp).toBe(0);
    expect(JOURNEY_MISSIONS.map((mission) => mission.xp)).toEqual([30, 30, 40]);
  });
  it("rejects malformed and duplicate progress instead of showing invented rewards", () => {
    const valid = { week: "2026-09-07", totalXp: 30, completed: ["transactions"], completeWeeks: 0, goalAchieved: false };
    expect(parseJourney(valid).completed).toEqual(["transactions"]);
    for (const change of [{ totalXp: -1 }, { totalXp: 1.5 }, { completed: ["trade"] }, { completed: ["transactions", "transactions"] }, { week: "no" }, { goalAchieved: "false" }]) {
      expect(() => parseJourney({ ...valid, ...change })).toThrow();
    }
  });
});
