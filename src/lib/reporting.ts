import type { FxRateResult } from "./fx";
import type { TransactionStatus, TransactionType } from "./finance";

export type ReportTransaction = {
  date: string;
  type: TransactionType;
  merchant: string | null;
  category: string;
  amount: number;
  note: string | null;
  status: TransactionStatus;
  source: string;
  account_id: string | null;
};

export type ReportCurrencyGroup = {
  currency: string;
  income: number;
  expense: number;
  net: number;
  convertedIncomeIdr: number | null;
  convertedExpenseIdr: number | null;
  convertedNetIdr: number | null;
  rate: FxRateResult;
};

export type FinancialReport = {
  currencyGroups: ReportCurrencyGroup[];
  categoryTotals: { currency: string; category: string; amount: number }[];
  rows: Array<ReportTransaction & { account: string; currency: string }>;
};

function safeAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function neutralizeSpreadsheetCell(value: unknown) {
  const text = String(value ?? "");
  return typeof value === "string" && /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown) {
  return `"${neutralizeSpreadsheetCell(value).replaceAll('"', '""')}"`;
}

export function serializeCsv(rows: readonly (readonly unknown[])[]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function buildFinancialReport(
  transactions: readonly ReportTransaction[],
  accountNames: ReadonlyMap<string, string>,
  accountCurrencies: ReadonlyMap<string, string>,
  rates: ReadonlyMap<string, FxRateResult>,
): FinancialReport {
  const groups = new Map<string, { income: number; expense: number }>();
  const categories = new Map<string, number>();
  const rows = transactions.map((transaction) => {
    const currency = transaction.account_id ? accountCurrencies.get(transaction.account_id) : undefined;
    const resolvedCurrency = currency ?? "Tidak diketahui";
    const account = transaction.account_id ? accountNames.get(transaction.account_id) : undefined;
    const amount = safeAmount(transaction.amount);
    if (transaction.status === "confirmed") {
      const group = groups.get(resolvedCurrency) ?? { income: 0, expense: 0 };
      if (transaction.type === "income") group.income += amount;
      else {
        group.expense += amount;
        const categoryKey = `${resolvedCurrency}${transaction.category}`;
        categories.set(categoryKey, (categories.get(categoryKey) ?? 0) + amount);
      }
      groups.set(resolvedCurrency, group);
    }
    return { ...transaction, amount, account: account ?? "Akun tidak tersedia", currency: resolvedCurrency };
  });

  return {
    rows,
    currencyGroups: [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, totals]) => {
      const rate = rates.get(currency) ?? {
        base: currency,
        quote: "IDR" as const,
        rate: null,
        providerDate: null,
        retrievedAt: null,
        state: "missing" as const,
      };
      const convert = (value: number) => rate.rate === null ? null : value * rate.rate;
      return {
        currency,
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
        convertedIncomeIdr: convert(totals.income),
        convertedExpenseIdr: convert(totals.expense),
        convertedNetIdr: convert(totals.income - totals.expense),
        rate,
      };
    }),
    categoryTotals: [...categories.entries()]
      .map(([key, amount]) => {
        const [currency, category] = key.split("");
        return { currency, category, amount };
      })
      .sort((left, right) => left.currency.localeCompare(right.currency) || right.amount - left.amount),
  };
}

export function serializeRichTransactionCsv(report: FinancialReport) {
  return serializeCsv([
    ["date", "type", "merchant", "category", "amount", "currency", "account", "note", "status", "source"],
    ...report.rows.map((row) => [row.date, row.type, row.merchant, row.category, row.amount, row.currency, row.account, row.note, row.status, row.source]),
  ]);
}

export function serializeFinancialReportCsv(report: FinancialReport, { generatedAt, filterSummary }: { generatedAt: string; filterSummary: string }) {
  const lines: unknown[][] = [
    ["FinTrack report"],
    ["generated_at", generatedAt],
    ["filters", filterSummary],
    [],
    ["currency", "income", "expense", "net", "income_idr_latest", "expense_idr_latest", "net_idr_latest", "fx_source", "fx_date", "fx_retrieved_at", "fx_state"],
    ...report.currencyGroups.map((group) => [
      group.currency,
      group.income,
      group.expense,
      group.net,
      group.convertedIncomeIdr ?? "",
      group.convertedExpenseIdr ?? "",
      group.convertedNetIdr ?? "",
      group.rate.rate === null ? "" : "Frankfurter",
      group.rate.providerDate ?? "",
      group.rate.retrievedAt ?? "",
      group.rate.state,
    ]),
    [],
    ["currency", "category", "confirmed_expense"],
    ...report.categoryTotals.map((item) => [item.currency, item.category, item.amount]),
    [],
    ["date", "type", "merchant", "category", "amount", "currency", "account", "note", "status", "source"],
    ...report.rows.map((row) => [row.date, row.type, row.merchant, row.category, row.amount, row.currency, row.account, row.note, row.status, row.source]),
  ];
  return serializeCsv(lines);
}
