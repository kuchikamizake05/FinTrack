import { describe, expect, it } from "vitest";
import { buildTradeReviewDispatch, parseTradeReviewRequest } from "./trade-review";

describe("buildTradeReviewDispatch", () => {
  it("builds an authenticated n8n payload without placing secrets in the body", () => {
    expect(buildTradeReviewDispatch({
      webhookUrl: "https://n8n.example/webhook/fintrack-trade-review",
      sharedSecret: "secret-value",
      userId: "user-1",
      tradeId: "trade-1",
    })).toEqual({
      url: "https://n8n.example/webhook/fintrack-trade-review",
      headers: { "Content-Type": "application/json", "x-fintrack-review-secret": "secret-value" },
      body: JSON.stringify({ userId: "user-1", tradeId: "trade-1" }),
    });
  });

  it("rejects missing configuration or identifiers", () => {
    expect(() => buildTradeReviewDispatch({ webhookUrl: "", sharedSecret: "", userId: "", tradeId: "" })).toThrow("not configured");
  });
});

describe("parseTradeReviewRequest", () => {
  it("accepts a UUID trade id and a well-formed bearer token", () => {
    expect(parseTradeReviewRequest({
      tradeId: "7e4f58f8-c5b5-49d6-b66f-16c73bb04d8f",
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
    })).toEqual({
      ok: true,
      tradeId: "7e4f58f8-c5b5-49d6-b66f-16c73bb04d8f",
      accessToken: "eyJhbGciOiJIUzI1NiJ9.payload.signature",
    });
  });

  it("rejects malformed identifiers and authorization headers", () => {
    expect(parseTradeReviewRequest({ tradeId: "../admin", authorization: "Bearer token" })).toEqual({ ok: false });
    expect(parseTradeReviewRequest({ tradeId: "7e4f58f8-c5b5-49d6-b66f-16c73bb04d8f", authorization: "Basic abc" })).toEqual({ ok: false });
  });
});
