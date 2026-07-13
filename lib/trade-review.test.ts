import { describe, expect, it } from "vitest";
import { buildTradeReviewDispatch } from "./trade-review";

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
