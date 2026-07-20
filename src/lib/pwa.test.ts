import { describe, expect, it } from "vitest";
import {
  getInstallPromptState,
  getNetworkSnapshot,
  getServerNetworkSnapshot,
  shouldRegisterServiceWorker,
} from "./pwa";

describe("shouldRegisterServiceWorker", () => {
  it("disables the service worker while Next.js runs in development", () => {
    expect(shouldRegisterServiceWorker("development", true)).toBe(false);
  });

  it("enables the service worker only in production browsers", () => {
    expect(shouldRegisterServiceWorker("production", true)).toBe(true);
    expect(shouldRegisterServiceWorker("production", false)).toBe(false);
  });
});

describe("getInstallPromptState", () => {
  it("hides the prompt in standalone mode", () => {
    expect(getInstallPromptState({ standalone: true, dismissedAt: null, now: 1_000 })).toBe("hidden");
  });

  it("respects a seven-day dismissal window", () => {
    const day = 24 * 60 * 60 * 1_000;
    expect(getInstallPromptState({ standalone: false, dismissedAt: String(10 * day), now: 12 * day })).toBe("dismissed");
    expect(getInstallPromptState({ standalone: false, dismissedAt: String(10 * day), now: 18 * day })).toBe("eligible");
  });

  it("treats missing or malformed dismissals as eligible", () => {
    expect(getInstallPromptState({ standalone: false, dismissedAt: null, now: 1_000 })).toBe("eligible");
    expect(getInstallPromptState({ standalone: false, dismissedAt: "invalid", now: 1_000 })).toBe("eligible");
  });
});

describe("network status snapshots", () => {
  it("keeps the server snapshot deterministic for hydration", () => {
    expect(getServerNetworkSnapshot()).toBe(true);
  });

  it("falls back to online outside a browser", () => {
    expect(getNetworkSnapshot()).toBe(true);
  });
});
