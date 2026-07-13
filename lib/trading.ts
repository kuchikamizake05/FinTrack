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

export type ForexJournalTrade = {
  symbol: string;
  status: "open" | "closed" | "cancelled";
  direction: "long" | "short";
  net_pnl: number;
  risk_amount: number | null;
  setup_tag: string | null;
};

export function calculateTradingJournalMetrics(trades: readonly ForexJournalTrade[]) {
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const pnl = closedTrades.reduce((total, trade) => total + Number(trade.net_pnl), 0);
  const wins = closedTrades.filter((trade) => Number(trade.net_pnl) > 0).length;
  const rValues = closedTrades
    .map((trade) => calculateForexRMultiple({ netPnl: Number(trade.net_pnl), riskAmount: Number(trade.risk_amount) }))
    .filter((value): value is number => value !== null);
  return {
    open: trades.filter((trade) => trade.status === "open").length,
    closed: closedTrades.length,
    pnl,
    winRate: closedTrades.length ? (wins / closedTrades.length) * 100 : 0,
    averageR: rValues.length ? Number((rValues.reduce((total, value) => total + value, 0) / rValues.length).toFixed(2)) : null,
  };
}

export function filterForexTrades<T extends ForexJournalTrade>(
  trades: readonly T[],
  filters: { status: "all" | ForexJournalTrade["status"]; search: string },
) {
  const search = filters.search.trim().toLocaleLowerCase("id-ID");
  return trades.filter((trade) => {
    if (filters.status !== "all" && trade.status !== filters.status) return false;
    if (!search) return true;
    return `${trade.symbol} ${trade.direction} ${trade.setup_tag ?? ""}`.toLocaleLowerCase("id-ID").includes(search);
  });
}

const optionalPositiveNumberIsValid = (value: string) => value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) > 0);

export function validateForexTradeForm(form: {
  accountId: string;
  symbol: string;
  status: string;
  lotSize: string;
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  takeProfit: string;
  riskAmount: string;
  grossPnl: string;
  commission: string;
  swap: string;
  openedAt: string;
  closedAt: string;
}) {
  const lotSize = Number(form.lotSize);
  const entryPrice = Number(form.entryPrice);
  const commission = Number(form.commission);
  const swap = Number(form.swap);
  const grossPnl = Number(form.grossPnl);
  const basicsInvalid = !form.accountId || !form.symbol.trim() || !form.openedAt
    || !Number.isFinite(lotSize) || lotSize <= 0
    || !Number.isFinite(entryPrice) || entryPrice <= 0
    || !Number.isFinite(commission) || commission < 0
    || !Number.isFinite(swap) || !Number.isFinite(grossPnl)
    || ![form.exitPrice, form.stopLoss, form.takeProfit, form.riskAmount].every(optionalPositiveNumberIsValid);
  if (basicsInvalid) return "Lengkapi akun, simbol, waktu, ukuran, harga, risiko, dan biaya dengan nilai valid.";
  if (form.status === "closed" && (!form.closedAt || !optionalPositiveNumberIsValid(form.exitPrice) || !form.exitPrice.trim())) {
    return "Trade tertutup wajib memiliki harga dan waktu keluar.";
  }
  return null;
}
