import { describe, expect, it } from "vitest";
import { shouldRegisterServiceWorker } from "./pwa";

describe("shouldRegisterServiceWorker", () => {
  it("disables the service worker while Next.js runs in development", () => {
    expect(shouldRegisterServiceWorker("development", true)).toBe(false);
  });

  it("enables the service worker only in production browsers", () => {
    expect(shouldRegisterServiceWorker("production", true)).toBe(true);
    expect(shouldRegisterServiceWorker("production", false)).toBe(false);
  });
});
