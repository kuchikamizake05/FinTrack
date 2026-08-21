import { describe, expect, it } from "vitest";
import { clearFxCachesForTest, getIdrRate, isCurrencyCode } from "./fx";

const now = () => new Date("2026-08-21T10:00:00.000Z");

describe("FX helpers", () => {
  it("validates ISO-like codes and keeps IDR at one", async () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("usd")).toBe(false);
    expect(await getIdrRate("IDR", { now })).toMatchObject({ rate: 1, state: "fresh" });
  });

  it("accepts a positive Frankfurter rate", async () => {
    clearFxCachesForTest();
    const rate = await getIdrRate("USD", {
      now,
      fetcher: async () => new Response(JSON.stringify([{ base: "USD", quote: "IDR", rate: 16_200, date: "2026-08-20" }]), { status: 200 }),
    });
    expect(rate).toMatchObject({ base: "USD", quote: "IDR", rate: 16_200, providerDate: "2026-08-20", state: "fresh" });
  });

  it("does not turn an invalid provider response into a zero rate", async () => {
    clearFxCachesForTest();
    const rate = await getIdrRate("EUR", {
      now,
      fetcher: async () => new Response(JSON.stringify([{ base: "EUR", quote: "IDR", rate: 0 }]), { status: 200 }),
      allowStale: false,
    });
    expect(rate).toMatchObject({ rate: null, state: "missing" });
  });

  it("returns stale cached rate when refresh fails", async () => {
    clearFxCachesForTest();
    await getIdrRate("JPY", {
      now: () => new Date("2026-08-20T00:00:00.000Z"),
      fetcher: async () => new Response(JSON.stringify([{ base: "JPY", quote: "IDR", rate: 110, date: "2026-08-19" }]), { status: 200 }),
    });
    const rate = await getIdrRate("JPY", {
      now: () => new Date("2026-08-21T10:00:00.000Z"),
      fetcher: async () => new Response(null, { status: 503 }),
    });
    expect(rate).toMatchObject({ rate: 110, state: "stale" });
  });
});
