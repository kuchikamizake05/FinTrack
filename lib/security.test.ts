import { describe, expect, it } from "vitest";
import { buildSecurityHeaders, getSupabaseConnectSources } from "./security";

describe("getSupabaseConnectSources", () => {
  it("allows the configured HTTPS and WebSocket Supabase origins", () => {
    expect(getSupabaseConnectSources("https://project.supabase.co")).toEqual([
      "https://project.supabase.co",
      "wss://project.supabase.co",
    ]);
  });

  it("ignores invalid configuration", () => {
    expect(getSupabaseConnectSources("javascript:alert(1)")).toEqual([]);
  });
});

describe("buildSecurityHeaders", () => {
  it("returns finance-safe browser headers and a restrictive CSP", () => {
    const headers = Object.fromEntries(buildSecurityHeaders({
      environment: "production",
      supabaseUrl: "https://project.supabase.co",
    }).map(({ key, value }) => [key, value]));

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("https://project.supabase.co");
  });

  it("omits HSTS outside production", () => {
    const keys = buildSecurityHeaders({ environment: "development" }).map(({ key }) => key);
    expect(keys).not.toContain("Strict-Transport-Security");
  });
});
