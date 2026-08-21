import { describe, expect, it } from "vitest";
import { buildPasskeyDeviceStorageKey, maskPasskeyEmail, parsePasskeyDeviceState } from "./passkeys";

const userId = "user-1";

function state(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    userId,
    emailHint: "qa••@fintrack.local",
    enabled: true,
    locked: true,
    updatedAt: "2026-08-22T00:00:00.000Z",
    ...overrides,
  });
}

describe("passkey device state", () => {
  it("builds user-scoped storage keys and parses only matching valid states", () => {
    expect(buildPasskeyDeviceStorageKey(userId)).toBe("fintrack:passkey-device:v1:user-1");
    expect(parsePasskeyDeviceState(state(), userId)?.locked).toBe(true);
    expect(parsePasskeyDeviceState(state(), "other-user")).toBeNull();
  });

  it("rejects corrupted, outdated, and malformed local state", () => {
    expect(parsePasskeyDeviceState("{", userId)).toBeNull();
    expect(parsePasskeyDeviceState(state({ version: 2 }), userId)).toBeNull();
    expect(parsePasskeyDeviceState(state({ updatedAt: "not-a-date" }), userId)).toBeNull();
  });

  it("masks display email without retaining full local part", () => {
    expect(maskPasskeyEmail("qa@fintrack.local")).toBe("qa••@fintrack.local");
    expect(maskPasskeyEmail(null)).toBe("Akun FinTrack");
  });
});
