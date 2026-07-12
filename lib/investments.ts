import { summarizeStockPosition, type StockExecution } from "./trading";

export type InvestmentExecution = StockExecution & {
  id: string;
  ticker: string;
  executed_at: string;
  account_id: string;
};

export function buildInvestmentPositions(executions: readonly InvestmentExecution[]) {
  const grouped = new Map<string, InvestmentExecution[]>();
  for (const execution of executions) {
    grouped.set(execution.ticker, [...(grouped.get(execution.ticker) ?? []), execution]);
  }
  return [...grouped.entries()]
    .map(([ticker, tickerExecutions]) => ({
      ticker,
      summary: summarizeStockPosition([...tickerExecutions].sort((left, right) => left.executed_at.localeCompare(right.executed_at))),
    }))
    .sort((left, right) => right.summary.costBasis - left.summary.costBasis || left.ticker.localeCompare(right.ticker));
}

export function filterStockExecutions<T extends InvestmentExecution>(
  executions: readonly T[],
  filters: { side: "all" | StockExecution["side"]; search: string },
  accountNames: ReadonlyMap<string, string>,
) {
  const search = filters.search.trim().toLocaleLowerCase("id-ID");
  return executions.filter((execution) => {
    if (filters.side !== "all" && execution.side !== filters.side) return false;
    if (!search) return true;
    return `${execution.ticker} ${accountNames.get(execution.account_id) ?? ""}`.toLocaleLowerCase("id-ID").includes(search);
  });
}

export function validateExecutionForm(form: { accountId: string; ticker: string; quantity: string; price: string; fee: string; executedAt: string }) {
  const quantity = Number(form.quantity);
  const price = Number(form.price);
  const fee = Number(form.fee);
  if (!form.accountId || !form.ticker.trim() || !form.executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(fee) || fee < 0) {
    return "Lengkapi broker, ticker, waktu, jumlah, harga, dan biaya dengan nilai valid.";
  }
  return null;
}

export function validateSnapshotForm(form: { accountId: string; equity: string; recordedAt: string }) {
  const equity = Number(form.equity);
  if (!form.accountId || !form.recordedAt || !Number.isFinite(equity) || equity < 0) {
    return "Pilih akun, waktu pencatatan, dan masukkan nilai portfolio yang valid.";
  }
  return null;
}
