import { describe, expect, it } from "vitest";
import { calculateForexRMultiple, summarizeStockPosition } from "./trading";

describe("summarizeStockPosition", () => {
  it("tracks weighted-average cost basis and realized profit after a partial sale", () => {
    expect(
      summarizeStockPosition([
        { side: "buy", quantity: 10, price: 100, fee: 10 },
        { side: "buy", quantity: 10, price: 120, fee: 10 },
        { side: "sell", quantity: 5, price: 150, fee: 10 },
      ]),
    ).toEqual({
      quantity: 15,
      costBasis: 1_665,
      averageCost: 111,
      realizedPnl: 185,
      oversoldQuantity: 0,
    });
  });

  it("flags sales that exceed the recorded position instead of inventing a cost basis", () => {
    expect(
      summarizeStockPosition([
        { side: "buy", quantity: 2, price: 100, fee: 0 },
        { side: "sell", quantity: 3, price: 120, fee: 0 },
      ]),
    ).toMatchObject({ quantity: 0, costBasis: 0, realizedPnl: 40, oversoldQuantity: 1 });
  });
});

describe("calculateForexRMultiple", () => {
  it("expresses a profitable closed trade relative to its planned cash risk", () => {
    expect(calculateForexRMultiple({ netPnl: 250, riskAmount: 100 })).toBe(2.5);
  });

  it("returns null when the original risk is absent or invalid", () => {
    expect(calculateForexRMultiple({ netPnl: 250, riskAmount: 0 })).toBeNull();
  });
});
