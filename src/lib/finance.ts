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
  status: "all" | "active" | TransactionStatus;
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

export function filterTransactions<T extends FinanceTransaction>(
  transactions: readonly T[],
  filters: TransactionFilters,
): T[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (filters.status === "active" && transaction.status === "deleted") return false;
    if (filters.status !== "all" && filters.status !== "active" && transaction.status !== filters.status) return false;
    if (filters.type !== "all" && transaction.type !== filters.type) return false;
    if (filters.category !== "all" && transaction.category !== filters.category) return false;
    if (filters.startDate && transaction.date < filters.startDate) return false;
    if (filters.endDate && transaction.date > filters.endDate) return false;

    if (!normalizedSearch) return true;
    const haystack = `${transaction.merchant ?? ""} ${transaction.note ?? ""} ${transaction.category}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}
