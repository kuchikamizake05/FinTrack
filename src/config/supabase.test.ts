import { describe, expect, it } from "vitest";
import { getSupabasePublicConfiguration } from "./supabase";

describe("getSupabasePublicConfiguration", () => {
  it("accepts HTTPS Supabase configuration", () => {
    expect(getSupabasePublicConfiguration("https://project.supabase.co", "anon-key")).toEqual({
      configured: true,
      url: "https://project.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("accepts local HTTP Supabase only on loopback hosts", () => {
    expect(getSupabasePublicConfiguration("http://127.0.0.1:54321", "local-anon").configured).toBe(true);
    expect(getSupabasePublicConfiguration("http://supabase.internal", "anon-key").configured).toBe(false);
  });

  it("rejects missing and placeholder values with an operator-safe reason", () => {
    expect(getSupabasePublicConfiguration(undefined, undefined)).toEqual({ configured: false, reason: "missing" });
    expect(getSupabasePublicConfiguration("https://placeholder-project.supabase.co", "placeholder-anon-key")).toEqual({ configured: false, reason: "placeholder" });
  });
});
