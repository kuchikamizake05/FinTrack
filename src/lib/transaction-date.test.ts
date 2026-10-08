import { describe, expect, it } from "vitest";
import { parseTransactionDate } from "./transaction-date";

describe("calendar transaction date parameter", () => {
  it.each(["2026-10-08", "2024-02-29", "0001-01-01"])("accepts real date %s", (date) => {
    expect(parseTransactionDate(date)).toBe(date);
  });

  it.each([null, "", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-10-00", "0000-01-01", "2026-1-1", "2026-10-08T00:00:00Z", "<script>"])("rejects invalid date %s", (date) => {
    expect(parseTransactionDate(date)).toBeNull();
  });
});
