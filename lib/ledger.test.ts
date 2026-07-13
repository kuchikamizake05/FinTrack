import { describe, expect, it } from "vitest";
import { calculateNetWorth, validateExchangeTransfer, validateTransfer } from "./ledger";

describe("ledger rules", () => {
  it("calculates net worth from active assets minus liabilities", () => {
    expect(calculateNetWorth([
      { id: "jago", kind: "bank", balance: 2_000_000, isActive: true },
      { id: "stockbit", kind: "investment", balance: 5_000_000, isActive: true },
      { id: "credit", kind: "liability", balance: 750_000, isActive: true },
      { id: "old", kind: "bank", balance: 999_999, isActive: false },
    ])).toBe(6_250_000);
  });

  it("accepts a positive transfer between two distinct accounts", () => {
    expect(validateTransfer({ sourceAccountId: "bri", destinationAccountId: "hfm", amount: 1_000_000 })).toEqual({ valid: true });
  });

  it.each([
    { sourceAccountId: "bri", destinationAccountId: "bri", amount: 1 },
    { sourceAccountId: "bri", destinationAccountId: "hfm", amount: 0 },
    { sourceAccountId: "bri", destinationAccountId: "hfm", amount: -1 },
  ])("rejects an invalid transfer %#", (transfer) => {
    expect(validateTransfer(transfer)).toEqual({ valid: false });
  });

  it("accepts an FX transfer only when both sent and received amounts are positive", () => {
    expect(validateExchangeTransfer({ sourceAccountId: "bri", destinationAccountId: "hfm", sourceAmount: 1_000_000, destinationAmount: 60, sourceCurrency: "IDR", destinationCurrency: "USD" })).toEqual({ valid: true });
  });

  it("rejects an FX transfer with a missing conversion result", () => {
    expect(validateExchangeTransfer({ sourceAccountId: "bri", destinationAccountId: "hfm", sourceAmount: 1_000_000, destinationAmount: 0, sourceCurrency: "IDR", destinationCurrency: "USD" })).toEqual({ valid: false });
  });
});
