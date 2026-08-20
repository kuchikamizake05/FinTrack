import type { FinanceTransaction, TransactionType } from "./finance";

type Budget = { category: string; limitAmount: number; month: string };
type ControlTransaction = FinanceTransaction & { merchant?: string | null; note?: string | null };

export function buildBudgetProgress(budget: Budget, transactions: readonly ControlTransaction[]) {
  const spentAmount = transactions.reduce((total, transaction) => (
    transaction.status === "confirmed" && transaction.type === "expense" && transaction.category === budget.category && transaction.date.startsWith(budget.month)
      ? total + Number(transaction.amount)
      : total
  ), 0);
  const percentage = budget.limitAmount > 0 ? Math.round((spentAmount / budget.limitAmount) * 100) : 0;
  return { ...budget, spentAmount, remainingAmount: budget.limitAmount - spentAmount, percentage, state: percentage >= 100 ? "over" : percentage >= 80 ? "warning" : "on_track" } as const;
}

export function getIdrBudgetScope<T extends Pick<FinanceTransaction, "status" | "type"> & { account_id: string | null }>(
  transactions: readonly T[],
  accountCurrencies: ReadonlyMap<string, string>,
) {
  const idrTransactions: T[] = [];
  let excludedExpenseCount = 0;

  for (const transaction of transactions) {
    const currency = transaction.account_id ? accountCurrencies.get(transaction.account_id) : undefined;
    if (currency === "IDR") idrTransactions.push(transaction);
    else if (transaction.status === "confirmed" && transaction.type === "expense") excludedExpenseCount += 1;
  }

  return { idrTransactions, excludedExpenseCount };
}

export type RecurringTransaction = { merchant: string; category: string; amount: number; type: TransactionType; accountId: string; nextRunDate: string; interval: "weekly" | "monthly" | "yearly"; note?: string | null };

export function buildRecurringTransactionDraft(rule: RecurringTransaction) {
  return { date: rule.nextRunDate, merchant: rule.merchant, category: rule.category, amount: rule.amount, type: rule.type, accountId: rule.accountId, source: "recurring" as const, ...(rule.note ? { note: rule.note } : {}) };
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export function serializeTransactionsCsv(transactions: readonly ControlTransaction[]) {
  const header = "date,type,merchant,category,amount,note";
  return [header, ...transactions.map((item) => [item.date, item.type, item.merchant, item.category, item.amount, item.note].map(csvCell).join(","))].join("\n");
}

function parseCsvLine(line: string) {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value); return values;
}

export function parseTransactionCsv(csv: string) {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (header !== "date,type,merchant,category,amount,note") throw new Error("Format CSV tidak dikenali.");
  return rows.filter(Boolean).map((row) => {
    const [date, type, merchant, category, amount, note] = parseCsvLine(row);
    const numericAmount = Number(amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (type !== "income" && type !== "expense") || !category || !Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error("Ada baris CSV yang tidak valid.");
    return { date, type, merchant, category, amount: numericAmount, note } as { date: string; type: TransactionType; merchant: string; category: string; amount: number; note: string };
  });
}

export function buildReconciliation({ expectedBalance, statementBalance }: { expectedBalance: number; statementBalance: number }) {
  const difference = statementBalance - expectedBalance;
  return { difference, isMatched: difference === 0 };
}

export function buildFinancialAlerts({ budgets, transactions, accountFreshness, today }: { budgets: readonly Budget[]; transactions: readonly ControlTransaction[]; accountFreshness: readonly { accountName: string; lastUpdatedAt: string | null }[]; today: string }) {
  const alerts: { kind: "budget" | "review" | "balance_freshness"; message: string }[] = [];
  for (const budget of budgets) { const progress = buildBudgetProgress(budget, transactions); if (progress.percentage >= 80) alerts.push({ kind: "budget", message: `Budget ${budget.category} sudah ${progress.percentage}%.` }); }
  const reviewCount = transactions.filter((item) => item.status === "needs_review" || item.status === "pending_approval").length;
  if (reviewCount) alerts.push({ kind: "review", message: `${reviewCount} transaksi perlu ditinjau.` });
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  for (const account of accountFreshness) { if (!account.lastUpdatedAt || todayMs - Date.parse(account.lastUpdatedAt) >= 14 * 86_400_000) alerts.push({ kind: "balance_freshness", message: `Saldo ${account.accountName} belum diperbarui.` }); }
  return alerts;
}
