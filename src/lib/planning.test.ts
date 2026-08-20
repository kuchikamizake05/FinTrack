import { describe, expect, it } from "vitest";
import { formatLocalDate, formatLocalDateTime, getPlanningDateContext } from "./planning";

describe("planning date helpers", () => {
  it("formats local calendar date without UTC rollover", () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(formatLocalDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("formats local datetime without UTC rollover", () => {
    expect(formatLocalDateTime(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05T23:59");
    expect(formatLocalDateTime(new Date(2026, 11, 31, 0, 5))).toBe("2026-12-31T00:05");
  });

  it("returns current local planning month", () => {
    expect(getPlanningDateContext(new Date(2026, 7, 18))).toEqual({
      today: "2026-08-18",
      month: "2026-08-01",
      monthKey: "2026-08",
      nextMonth: "2026-09-01",
    });
    expect(getPlanningDateContext(new Date(2026, 11, 18)).nextMonth).toBe("2027-01-01");
  });
});
