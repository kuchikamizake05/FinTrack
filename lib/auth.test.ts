import { describe, expect, it } from "vitest";
import { getAuthGateState, isProtectedRoute, isPublicRoute, sanitizeNextPath } from "./auth";

describe("sanitizeNextPath", () => {
  it("keeps an internal protected destination including its query", () => {
    expect(sanitizeNextPath("/transactions?status=pending")).toBe("/transactions?status=pending");
  });

  it("rejects external, protocol-relative, malformed, and public destinations", () => {
    expect(sanitizeNextPath("https://evil.example/steal")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.example/steal")).toBe("/dashboard");
    expect(sanitizeNextPath("/\\evil.example/steal")).toBe("/dashboard");
    expect(sanitizeNextPath("/login")).toBe("/dashboard");
  });
});

describe("public route policy", () => {
  it("allows only the explicit public application routes", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/offline")).toBe(true);
    expect(isPublicRoute("/dashboard")).toBe(false);
    expect(isPublicRoute("/api/trades/id/review")).toBe(false);
  });

  it("treats onboarding as an authenticated application route", () => {
    expect(isProtectedRoute("/onboarding")).toBe(true);
    expect(isProtectedRoute("/onboarding/step")).toBe(true);
  });
});

describe("getAuthGateState", () => {
  it("allows public routes without resolving a session", () => {
    expect(getAuthGateState({ pathname: "/login", configured: true, resolved: false, hasSession: false, online: true })).toBe("public");
  });

  it("fails closed while a protected session is unresolved", () => {
    expect(getAuthGateState({ pathname: "/dashboard", configured: true, resolved: false, hasSession: false, online: true })).toBe("loading");
  });

  it("redirects a signed-out online user and uses offline recovery without connectivity", () => {
    expect(getAuthGateState({ pathname: "/dashboard", configured: true, resolved: true, hasSession: false, online: true })).toBe("redirect-login");
    expect(getAuthGateState({ pathname: "/dashboard", configured: true, resolved: true, hasSession: false, online: false })).toBe("offline");
  });

  it("blocks protected data operations when configuration is missing", () => {
    expect(getAuthGateState({ pathname: "/dashboard", configured: false, resolved: true, hasSession: true, online: true })).toBe("configuration-error");
  });
});
