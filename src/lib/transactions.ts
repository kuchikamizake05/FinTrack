import type { FinanceTransaction, TransactionFilters, TransactionStatus } from "./finance";
import type { ReceiptExtraction } from "./receipt-vision";

export function summarizeTransactionList(transactions: readonly FinanceTransaction[]) {
  return transactions.reduce(
    (summary, transaction) => {
      if (transaction.status !== "confirmed") return summary;
      if (transaction.type === "income") summary.income += Number(transaction.amount);
      else summary.expense += Number(transaction.amount);
      summary.net = summary.income - summary.expense;
      return summary;
    },
    { income: 0, expense: 0, net: 0 },
  );
}

export function hasActiveTransactionFilters(filters: TransactionFilters) {
  return Boolean(
    filters.search.trim()
      || filters.category !== "all"
      || filters.type !== "all"
      || filters.status !== "active"
      || filters.startDate
      || filters.endDate,
  );
}

export function validateTransactionForm(form: { accountId: string; amount: string }) {
  const amount = Number(form.amount);
  if (!form.accountId || !Number.isFinite(amount) || amount <= 0) {
    return "Pilih akun dan masukkan nominal lebih dari nol.";
  }
  return null;
}

export function applyReceiptExtractionToTransactionForm<T extends {
  date: string;
  type?: "income" | "expense";
  merchant: string;
  category: string;
  amount: string;
  note: string;
}>(form: T, extraction: ReceiptExtraction, categoryOptions: readonly string[]): T {
  const type = extraction.type ?? form.type;
  const category = extraction.categoryHint
    ? categoryOptions.find((option) => option.toLocaleLowerCase() === extraction.categoryHint?.toLocaleLowerCase()) ?? form.category
    : form.category;

  return {
    ...form,
    type,
    date: extraction.date ?? form.date,
    merchant: extraction.merchant ?? form.merchant,
    category,
    amount: extraction.amount === null ? form.amount : String(extraction.amount),
    note: extraction.note ?? form.note,
  };
}

export function getTransactionSaveStatus(existingStatus?: TransactionStatus, scanned = false) {
  return existingStatus ?? (scanned ? "needs_review" : "confirmed");
}

export function canApproveTransaction(status: TransactionStatus) {
  return status === "pending_approval" || status === "needs_review";
}

export function getTransactionSourceLabel(source: string) {
  if (source === "telegram_text") return "Bot Telegram";
  if (source === "telegram_receipt") return "Scan struk";
  if (source === "recurring") return "Jadwal berulang";
  return "Input manual";
}

export function getTransactionStatusLabel(status: TransactionStatus) {
  const labels: Record<TransactionStatus, string> = {
    confirmed: "Terkonfirmasi",
    pending_approval: "Perlu persetujuan",
    needs_review: "Perlu ditinjau",
    deleted: "Dihapus",
  };
  return labels[status];
}
