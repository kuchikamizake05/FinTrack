import { describe, expect, it } from "vitest";
import { journeyLevel, parseJourney, JOURNEY_MISSIONS } from "./journey";

const streak = {
  current: 0,
  longest: 0,
  completedToday: false,
  days: ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"].map((date) => ({ date, completed: false })),
};

describe("financial journey", () => {
  it("keeps earned levels at weekly resets and advances at 300 XP", () => {
    expect(journeyLevel(0)).toEqual({ level: 1, progress: 0 });
    expect(journeyLevel(299)).toEqual({ level: 1, progress: 299 });
    expect(journeyLevel(300)).toEqual({ level: 2, progress: 0 });
    expect(journeyLevel(640)).toEqual({ level: 3, progress: 40 });
  });
  it("accepts an empty authenticated journey", () => {
    expect(parseJourney({ week: "2026-09-07", totalXp: 0, completed: [], completeWeeks: 0, goalAchieved: false, streak }).totalXp).toBe(0);
    expect(JOURNEY_MISSIONS.map((mission) => mission.xp)).toEqual([30, 30, 40]);
  });
  it("accepts a seven-day streak and rejects invalid streak data", () => {
    const valid = { week: "2026-09-07", totalXp: 30, completed: ["transactions"], completeWeeks: 0, goalAchieved: false, streak: { ...streak, current: 3, longest: 7, completedToday: true } };
    expect(parseJourney(valid).streak.current).toBe(3);
    for (const change of [{ streak: { ...streak, current: -1 } }, { streak: { ...streak, days: streak.days.slice(1) } }, { streak: { ...streak, completedToday: "true" } }]) {
      expect(() => parseJourney({ ...valid, ...change })).toThrow();
    }
  });
  it("rejects malformed and duplicate progress instead of showing invented rewards", () => {
    const valid = { week: "2026-09-07", totalXp: 30, completed: ["transactions"], completeWeeks: 0, goalAchieved: false, streak };
    expect(parseJourney(valid).completed).toEqual(["transactions"]);
    for (const change of [{ totalXp: -1 }, { totalXp: 1.5 }, { completed: ["trade"] }, { completed: ["transactions", "transactions"] }, { week: "no" }, { goalAchieved: "false" }]) {
      expect(() => parseJourney({ ...valid, ...change })).toThrow();
    }
  });
});
