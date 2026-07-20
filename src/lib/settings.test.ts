import { describe, expect, it } from "vitest";
import { maskUserIdentifier } from "./settings";

describe("maskUserIdentifier", () => {
  it("keeps short identifiers readable and masks long user ids", () => {
    expect(maskUserIdentifier("abc123")).toBe("abc123");
    expect(maskUserIdentifier("12345678-1234-5678-9012-123456789012")).toBe("12345678…9012");
  });

  it("returns a loading label for an absent id", () => {
    expect(maskUserIdentifier(null)).toBe("Memuat identitas...");
  });
});
