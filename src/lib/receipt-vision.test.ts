import { describe, expect, it } from "vitest";
import {
  buildGeminiReceiptRequest,
  createReceiptRateLimiter,
  mapGeminiFailure,
  parseGeminiReceiptResponse,
  receiptExtractionSchema,
  validateReceiptParseSecurity,
} from "./receipt-vision";

const sampleValidPayload = {
  date: "2026-08-20",
  merchant: "Indomaret Point",
  amount: 45000,
  categoryHint: "Belanja",
  type: "expense",
  proofKind: "receipt",
  note: "Kopi dan roti",
  rawText: "INDOMARET POINT TOTAL 45.000",
  confidence: 0.95,
};

describe("receiptExtractionSchema", () => {
  it("accepts valid extraction data", () => {
    const result = receiptExtractionSchema.safeParse(sampleValidPayload);
    expect(result.success).toBe(true);
  });

  it("accepts transfer proof with income direction", () => {
    expect(receiptExtractionSchema.safeParse({
      ...sampleValidPayload,
      merchant: "Transfer masuk",
      type: "income",
      proofKind: "transfer",
    }).success).toBe(true);
  });

  it("accepts nullable fields as long as at least one core field exists", () => {
    const partial = {
      date: null,
      merchant: "Warung Kopi",
      amount: null,
      categoryHint: null,
      type: null,
      proofKind: null,
      note: null,
      rawText: null,
      confidence: null,
    };
    expect(receiptExtractionSchema.safeParse(partial).success).toBe(true);
  });

  it("rejects payload when all useful fields are null", () => {
    const empty = {
      date: null,
      merchant: null,
      amount: null,
      categoryHint: null,
      type: null,
      proofKind: null,
      note: null,
      rawText: "teks tidak jelas",
      confidence: 0.1,
    };
    expect(receiptExtractionSchema.safeParse(empty).success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const invalidDate = { ...sampleValidPayload, date: "20-08-2026" };
    expect(receiptExtractionSchema.safeParse(invalidDate).success).toBe(false);
  });

  it("rejects negative or zero amount", () => {
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, amount: -5000 }).success).toBe(false);
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, amount: 0 }).success).toBe(false);
  });

  it("rejects out of bound confidence", () => {
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, confidence: 1.5 }).success).toBe(false);
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, confidence: -0.1 }).success).toBe(false);
  });
});

describe("buildGeminiReceiptRequest", () => {
  it("constructs inline data and JSON schema payload", () => {
    const request = buildGeminiReceiptRequest({
      mimeType: "image/jpeg",
      base64Data: "abc123xyz",
    });

    expect(request.contents[0]?.parts[1]?.inline_data?.mime_type).toBe("image/jpeg");
    expect(request.contents[0]?.parts[1]?.inline_data?.data).toBe("abc123xyz");
    expect(request.generationConfig.responseMimeType).toBe("application/json");
  });
});

describe("parseGeminiReceiptResponse", () => {
  it("parses valid Gemini output envelope", () => {
    const providerResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify(sampleValidPayload),
              },
            ],
          },
        },
      ],
    };

    const parsed = parseGeminiReceiptResponse(providerResponse);
    expect(parsed).toEqual(sampleValidPayload);
  });

  it("throws error for missing or malformed candidates", () => {
    expect(() => parseGeminiReceiptResponse({})).toThrow();
    expect(() => parseGeminiReceiptResponse({ candidates: [] })).toThrow();
    expect(() => parseGeminiReceiptResponse({
      candidates: [{ content: { parts: [{ text: "not-json" }] } }],
    })).toThrow();
  });
});

describe("createReceiptRateLimiter", () => {
  it("enforces rate limits within window", () => {
    const limiter = createReceiptRateLimiter({ maxRequests: 2, windowMs: 1000 });
    expect(limiter.consume("user-1", 1000).allowed).toBe(true);
    expect(limiter.consume("user-1", 1200).allowed).toBe(true);
    expect(limiter.consume("user-1", 1300).allowed).toBe(false);
    expect(limiter.consume("user-1", 2100).allowed).toBe(true);
  });
});

describe("validateReceiptParseSecurity", () => {
  it("checks origin and bearer token", () => {
    expect(validateReceiptParseSecurity({
      origin: "https://fintrack.example",
      requestOrigin: "https://fintrack.example",
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
    })).toEqual({ ok: true, accessToken: "eyJhbGciOiJIUzI1NiJ9.payload.signature" });

    expect(validateReceiptParseSecurity({
      origin: "https://evil.example",
      requestOrigin: "https://fintrack.example",
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
    }).ok).toBe(false);

    expect(validateReceiptParseSecurity({
      origin: "https://fintrack.example",
      requestOrigin: "https://fintrack.example",
      authorization: null,
    }).ok).toBe(false);
  });
});

describe("mapGeminiFailure", () => {
  it("maps status codes to helpful messages", () => {
    expect(mapGeminiFailure(429).status).toBe(429);
    expect(mapGeminiFailure(401).status).toBe(503);
    expect(mapGeminiFailure(500).status).toBe(502);
  });
});
