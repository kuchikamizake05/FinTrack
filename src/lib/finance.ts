export type TransactionStatus = "confirmed" | "pending_approval" | "needs_review" | "deleted";
export type TransactionType = "income" | "expense";

export type FinanceTransaction = {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  status: TransactionStatus;
  merchant?: string | null;
  note?: string | null;
};

export type TransactionFilters = {
  search: string;
  category: string;
  type: "all" | TransactionType;
  status: "all" | "active" | "review" | TransactionStatus;
  startDate: string;
  endDate: string;
};

export function isActiveTransaction(transaction: Pick<FinanceTransaction, "status">) {
  return transaction.status === "confirmed";
}

export function calculateSummary(transactions: readonly FinanceTransaction[]) {
  return transactions.reduce(
    (summary, transaction) => {
      if (!isActiveTransaction(transaction)) return summary;

      if (transaction.type === "income") summary.income += Number(transaction.amount);
      else summary.expense += Number(transaction.amount);

      summary.balance = summary.income - summary.expense;
      return summary;
    },
    { income: 0, expense: 0, balance: 0 },
  );
}

export function buildCategoryTotals(transactions: readonly FinanceTransaction[]) {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (isActiveTransaction(transaction) && transaction.type === "expense") {
      totals[transaction.category] = (totals[transaction.category] ?? 0) + Number(transaction.amount);
    }
    return totals;
  }, {});
}

export function calculateEmergencyFundRunway({
  liquidBalance,
  averageMonthlyExpense,
}: {
  liquidBalance: number;
  averageMonthlyExpense: number;
}) {
  if (!Number.isFinite(liquidBalance) || !Number.isFinite(averageMonthlyExpense) || liquidBalance < 0 || averageMonthlyExpense <= 0) {
    return null;
  }
  return liquidBalance / averageMonthlyExpense;
}

export function buildEmergencyFundRunwayByCurrency<
  TAccount extends { id: string; currency: string; current_balance: number; kind: string; is_active: boolean },
  TTransaction extends Pick<FinanceTransaction, "amount" | "status" | "type"> & { account_id: string | null },
>(accounts: readonly TAccount[], transactions: readonly TTransaction[]) {
  const accountCurrencyById = new Map(accounts.map((account) => [account.id, account.currency]));
  const liquidBalanceByCurrency = new Map<string, number>();

  for (const account of accounts) {
    if (!account.is_active || (account.kind !== "bank" && account.kind !== "ewallet")) continue;
    const amount = Number(account.current_balance);
    if (!Number.isFinite(amount) || amount < 0) continue;
    liquidBalanceByCurrency.set(account.currency, (liquidBalanceByCurrency.get(account.currency) ?? 0) + amount);
  }

  const monthlyExpenseByCurrency = new Map<string, number>();
  for (const transaction of transactions) {
    const currency = transaction.account_id ? accountCurrencyById.get(transaction.account_id) : undefined;
    const amount = Number(transaction.amount);
    if (transaction.status !== "confirmed" || transaction.type !== "expense" || !currency || !Number.isFinite(amount) || amount < 0) continue;
    monthlyExpenseByCurrency.set(currency, (monthlyExpenseByCurrency.get(currency) ?? 0) + amount);
  }

  return [...liquidBalanceByCurrency.entries()].map(([currency, liquidBalance]) => {
    const averageMonthlyExpense = monthlyExpenseByCurrency.get(currency) ?? 0;
    return { currency, liquidBalance, averageMonthlyExpense, runwayMonths: calculateEmergencyFundRunway({ liquidBalance, averageMonthlyExpense }) };
  });
}

export function groupTransactionAmountsByCurrency<T extends Pick<FinanceTransaction, "amount" | "status"> & { account_id: string | null }>(
  transactions: readonly T[],
  accountCurrencies: ReadonlyMap<string, string>,
  statuses: readonly TransactionStatus[],
) {
  const includedStatuses = new Set(statuses);
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (!includedStatuses.has(transaction.status)) return totals;
    const currency = transaction.account_id ? accountCurrencies.get(transaction.account_id) : undefined;
    const key = currency ?? "Tidak diketahui";
    const amount = Number(transaction.amount);
    if (Number.isFinite(amount)) totals[key] = (totals[key] ?? 0) + amount;
    return totals;
  }, {});
}

export function filterTransactions<T extends FinanceTransaction>(
  transactions: readonly T[],
  filters: TransactionFilters,
): T[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (filters.status === "active" && transaction.status === "deleted") return false;
    if (filters.status === "review" && transaction.status !== "pending_approval" && transaction.status !== "needs_review") return false;
    if (filters.status !== "all" && filters.status !== "active" && filters.status !== "review" && transaction.status !== filters.status) return false;
    if (filters.type !== "all" && transaction.type !== filters.type) return false;
    if (filters.category !== "all" && transaction.category !== filters.category) return false;
    if (filters.startDate && transaction.date < filters.startDate) return false;
    if (filters.endDate && transaction.date > filters.endDate) return false;

    if (!normalizedSearch) return true;
    const haystack = `${transaction.merchant ?? ""} ${transaction.note ?? ""} ${transaction.category}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}
