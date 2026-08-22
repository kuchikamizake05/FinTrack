import { describe, expect, it } from "vitest";
import { consumeRouteRateLimit, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("isolates users and reports retry time", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1_000 });

    expect(limiter.consume("user-1", 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-2", 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-1", 1_200)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-1", 1_250)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume("user-1", 2_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("uses hashed Upstash keys when configured", async () => {
    const fallback = createRateLimiter({ maxRequests: 1, windowMs: 1_000 });
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl = async (input: string, init: RequestInit) => {
      calls.push({ input, init });
      return { ok: true, json: async () => ({ result: [2, 900] }) };
    };

    await expect(consumeRouteRateLimit({
      route: "receipts:parse",
      userId: "user-secret-id",
      maxRequests: 1,
      windowMs: 1_000,
      fallback,
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "secret-token" },
      fetchImpl,
    })).resolves.toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("https://example.upstash.io");
    expect(calls[0]?.init.headers).toEqual({ Authorization: "Bearer secret-token", "Content-Type": "application/json" });
    expect(calls[0]?.init.body).not.toContain("user-secret-id");
  });

  it("falls back locally when Upstash fails", async () => {
    const fallback = createRateLimiter({ maxRequests: 1, windowMs: 1_000 });
    const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
    const options = {
      route: "insights:generate",
      userId: "user-1",
      maxRequests: 1,
      windowMs: 1_000,
      fallback,
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "secret-token" },
      fetchImpl,
    };

    await expect(consumeRouteRateLimit(options)).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    await expect(consumeRouteRateLimit(options)).resolves.toEqual({ allowed: false, retryAfterSeconds: 1 });
  });
});
