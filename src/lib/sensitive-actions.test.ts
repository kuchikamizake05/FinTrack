import { describe, expect, it } from "vitest";
import { getSensitiveActionErrorMessage, hasRecentAal2StepUp } from "./sensitive-actions";

describe("sensitive action helpers", () => {
  it("accepts only recent aal2 factor verification", () => {
    expect(hasRecentAal2StepUp({ aal: "aal2", authenticationMethods: [{ method: "totp", timestamp: 10_000 }], nowSeconds: 10_100 })).toBe(true);
    expect(hasRecentAal2StepUp({ aal: "aal1", authenticationMethods: [{ method: "totp", timestamp: 10_000 }], nowSeconds: 10_100 })).toBe(false);
    expect(hasRecentAal2StepUp({ aal: "aal2", authenticationMethods: [{ method: "totp", timestamp: 9_000 }], nowSeconds: 10_000 })).toBe(false);
    expect(hasRecentAal2StepUp({ aal: "aal2", authenticationMethods: ["password"], nowSeconds: 10_100 })).toBe(false);
  });

  it("keeps denial messages non-sensitive", () => {
    expect(getSensitiveActionErrorMessage(403)).toBe("Verifikasi keamanan terbaru diperlukan.");
  });
});
