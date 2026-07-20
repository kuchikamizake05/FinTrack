import { describe, expect, it } from "vitest";
import {
  buildGroqInsightRequest,
  createInsightRateLimiter,
  insightRequestSchema,
  mapGroqFailure,
  parseGroqInsightResponse,
  validateInsightRequestSecurity,
} from "./insights-api";

const payload = {
  version: 1 as const,
  periodLabel: "Juli 2026",
  previousPeriodLabel: "Juni 2026",
  metrics: {
    income: 10_000_000,
    expense: 4_000_000,
    netCashFlow: 6_000_000,
    savingsRate: 60,
    expenseChange: 14.3,
    incomeChange: 11.1,
    confirmedCount: 3,
    pendingCount: 1,
    averageExpense: 2_000_000,
    activeAccountCount: 2,
    uncoveredForeignAccountCount: 0,
  },
  topCategories: [{ name: "Makanan", amount: 2_000_000, share: 50 }],
  largestCategoryMovement: { category: "Makanan", currentAmount: 2_000_000, previousAmount: 1_000_000, changeAmount: 1_000_000 },
  candidateActions: [{ id: "review-pending" as const, title: "Tinjau transaksi tertunda", reason: "Ada transaksi tertunda.", impact: "high" as const, href: "/transactions" as const }],
};

describe("insight API request validation", () => {
  it("accepts a bounded aggregate and rejects prohibited or oversized shapes", () => {
    expect(insightRequestSchema.safeParse(payload).success).toBe(true);
    expect(insightRequestSchema.safeParse({ ...payload, topCategories: Array(6).fill(payload.topCategories[0]) }).success).toBe(false);
    expect(insightRequestSchema.safeParse({ ...payload, merchant: "secret" }).success).toBe(false);
    expect(insightRequestSchema.safeParse({ ...payload, periodLabel: "x".repeat(41) }).success).toBe(false);
  });

  it("requires JSON, same origin, and a bearer token", () => {
    expect(validateInsightRequestSecurity({
      contentType: "application/json",
      origin: "https://fintrack.example",
      requestOrigin: "https://fintrack.example",
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
      contentLength: "1200",
    })).toEqual({ ok: true, accessToken: "eyJhbGciOiJIUzI1NiJ9.payload.signature" });
    expect(validateInsightRequestSecurity({ contentType: "text/plain", origin: "https://fintrack.example", requestOrigin: "https://fintrack.example", authorization: "Bearer ey.a.b", contentLength: "10" }).ok).toBe(false);
    expect(validateInsightRequestSecurity({ contentType: "application/json", origin: "https://evil.example", requestOrigin: "https://fintrack.example", authorization: "Bearer ey.a.b", contentLength: "10" }).ok).toBe(false);
    expect(validateInsightRequestSecurity({ contentType: "application/json", origin: "https://fintrack.example", requestOrigin: "https://fintrack.example", authorization: null, contentLength: "10" }).ok).toBe(false);
    expect(validateInsightRequestSecurity({ contentType: "application/json", origin: "https://fintrack.example", requestOrigin: "https://fintrack.example", authorization: "Bearer ey.a.b", contentLength: "20001" }).ok).toBe(false);
  });

  it("throttles repeated generation within a bounded window", () => {
    const limiter = createInsightRateLimiter({ maxRequests: 2, windowMs: 1_000 });
    expect(limiter.consume("user-1", 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-1", 1_100)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-1", 1_200)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume("user-1", 2_001)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});

describe("Groq structured insight contract", () => {
  it("builds a strict structured-output request without raw financial fields", () => {
    const request = buildGroqInsightRequest(payload, "openai/gpt-oss-20b");
    expect(request.model).toBe("openai/gpt-oss-20b");
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.response_format.json_schema.schema.additionalProperties).toBe(false);
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain("merchant");
    expect(serialized).not.toContain("receipt_url");
    expect(serialized).toContain("Gunakan hanya angka");
  });

  it("parses a valid provider response and rejects malformed or invented actions", () => {
    const valid = {
      choices: [{ message: { content: JSON.stringify({
        headline: "Arus kas terjaga",
        summary: "Pemasukan masih menutup pengeluaran.",
        tone: "positive",
        actions: [{ candidateId: "review-pending", title: "Tinjau transaksi", reason: "Lengkapi data bulan ini.", impact: "high" }],
        observations: ["Pengeluaran terkonsentrasi pada satu kategori."],
      }) } }],
    };
    expect(parseGroqInsightResponse(valid, ["review-pending"])).toMatchObject({ headline: "Arus kas terjaga", tone: "positive" });
    expect(() => parseGroqInsightResponse({ choices: [] }, ["review-pending"])).toThrow("Invalid Groq response");
    expect(() => parseGroqInsightResponse({ choices: [{ message: { content: "not-json" } }] }, ["review-pending"])).toThrow("Invalid Groq response");
    expect(() => parseGroqInsightResponse({ choices: [{ message: { content: JSON.stringify({ ...JSON.parse(valid.choices[0].message.content), actions: [{ candidateId: "invented", title: "X", reason: "Y", impact: "high" }] }) } }] }, ["review-pending"])).toThrow("Invalid Groq response");
  });

  it("maps provider failures to safe application responses", () => {
    expect(mapGroqFailure(429)).toEqual({ status: 429, message: "Batas AI sedang tercapai. Coba lagi nanti." });
    expect(mapGroqFailure(401)).toEqual({ status: 503, message: "Smart Insights belum tersedia." });
    expect(mapGroqFailure(500)).toEqual({ status: 502, message: "AI belum bisa menyusun insight." });
  });
});
