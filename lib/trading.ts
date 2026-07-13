export type StockExecution = {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
};

export type StockPositionSummary = {
  quantity: number;
  costBasis: number;
  averageCost: number;
  realizedPnl: number;
  oversoldQuantity: number;
};

/**
 * Uses weighted-average cost, including buy fees and deducting sell fees from
 * proceeds. The data model still stores every execution, so a future tax view
 * can use a different lot-matching method without losing source data.
 */
export function summarizeStockPosition(executions: readonly StockExecution[]): StockPositionSummary {
  let quantity = 0;
  let costBasis = 0;
  let realizedPnl = 0;
  let oversoldQuantity = 0;

  for (const execution of executions) {
    const executionQuantity = Number(execution.quantity);
    const executionPrice = Number(execution.price);
    const executionFee = Number(execution.fee);

    if (
      !Number.isFinite(executionQuantity) ||
      !Number.isFinite(executionPrice) ||
      !Number.isFinite(executionFee) ||
      executionQuantity <= 0 ||
      executionPrice < 0 ||
      executionFee < 0
    ) {
      continue;
    }

    if (execution.side === "buy") {
      quantity += executionQuantity;
      costBasis += executionQuantity * executionPrice + executionFee;
      continue;
    }

    const soldQuantity = Math.min(quantity, executionQuantity);
    const averageCost = quantity > 0 ? costBasis / quantity : 0;
    const allocatedCost = soldQuantity * averageCost;
    const proportionalFee = executionFee * (soldQuantity / executionQuantity);
    const proceeds = soldQuantity * executionPrice - proportionalFee;

    quantity -= soldQuantity;
    costBasis -= allocatedCost;
    realizedPnl += proceeds - allocatedCost;
    oversoldQuantity += executionQuantity - soldQuantity;
  }

  const normalizedQuantity = Number(quantity.toFixed(8));
  const normalizedCostBasis = Number(costBasis.toFixed(2));

  return {
    quantity: normalizedQuantity,
    costBasis: normalizedCostBasis,
    averageCost: normalizedQuantity > 0 ? Number((normalizedCostBasis / normalizedQuantity).toFixed(4)) : 0,
    realizedPnl: Number(realizedPnl.toFixed(2)),
    oversoldQuantity: Number(oversoldQuantity.toFixed(8)),
  };
}

export function calculateForexRMultiple({
  netPnl,
  riskAmount,
}: {
  netPnl: number;
  riskAmount: number;
}) {
  if (!Number.isFinite(netPnl) || !Number.isFinite(riskAmount) || riskAmount <= 0) {
    return null;
  }

  return Number((netPnl / riskAmount).toFixed(2));
}
