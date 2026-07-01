import type { FinancialAccountKind } from "./ledger";

export type AccountOverviewRecord = {
  id: string;
  name: string;
  institution: string | null;
  kind: FinancialAccountKind;
  currency: string;
  current_balance: number;
  reporting_balance_idr: number | null;
  is_active: boolean;
  updated_at: string;
};

export type AccountFilter = "all" | "liquid" | "investment" | "trading" | "liability";

type ValidationResult<T extends string> = {
  valid: boolean;
  errors: Partial<Record<T, string>>;
};

const accountKindLabels: Record<FinancialAccountKind, string> = {
  bank: "Bank",
  ewallet: "E-wallet",
  investment: "Investasi",
  trading: "Trading",
  liability: "Kewajiban",
};

export function getAccountKindLabel(kind: FinancialAccountKind) {
  return accountKindLabels[kind];
}

export function getMissingForeignAccounts(accounts: readonly AccountOverviewRecord[]) {
  return accounts.filter(
    (account) => account.is_active && account.currency !== "IDR" && account.reporting_balance_idr === null,
  );
}

export function filterAccounts(accounts: readonly AccountOverviewRecord[], filter: AccountFilter) {
  if (filter === "all") return [...accounts];
  if (filter === "liquid") return accounts.filter((account) => account.kind === "bank" || account.kind === "ewallet");
  return accounts.filter((account) => account.kind === filter);
}

function getReportingValue(account: AccountOverviewRecord) {
  const value = account.currency === "IDR" ? Number(account.current_balance) : Number(account.reporting_balance_idr ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function summarizeAccounts(accounts: readonly AccountOverviewRecord[]) {
  const summary = accounts.reduce(
    (totals, account) => {
      if (!account.is_active) return totals;
      totals.activeCount += 1;
      const value = getReportingValue(account);
      if (account.kind === "liability") totals.liabilities += value;
      else totals.assets += value;
      return totals;
    },
    { assets: 0, liabilities: 0, activeCount: 0 },
  );

  return {
    ...summary,
    netWorth: summary.assets - summary.liabilities,
    missingForeignCount: getMissingForeignAccounts(accounts).length,
  };
}

export function validateAccountForm(form: {
  name: string;
  currency: string;
  currentBalance: string;
  reportingBalanceIdr: string;
}): ValidationResult<"name" | "currency" | "currentBalance" | "reportingBalanceIdr"> {
  const errors: ValidationResult<"name" | "currency" | "currentBalance" | "reportingBalanceIdr">["errors"] = {};
  if (!form.name.trim()) errors.name = "Nama akun wajib diisi.";
  if (!/^[A-Z]{3}$/.test(form.currency)) errors.currency = "Gunakan kode mata uang tiga huruf.";
  if (!form.currentBalance.trim() || !Number.isFinite(Number(form.currentBalance))) {
    errors.currentBalance = "Masukkan saldo awal yang valid.";
  }
  if (
    form.currency !== "IDR"
    && form.reportingBalanceIdr.trim()
    && (!Number.isFinite(Number(form.reportingBalanceIdr)) || Number(form.reportingBalanceIdr) < 0)
  ) {
    errors.reportingBalanceIdr = "Nilai setara IDR tidak boleh negatif.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateTransferForm(form: {
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: string;
  destinationAmount: string;
  sourceCurrency: string;
  destinationCurrency: string;
  date: string;
}): ValidationResult<"sourceAccountId" | "destinationAccountId" | "sourceAmount" | "destinationAmount" | "date"> {
  const errors: ValidationResult<"sourceAccountId" | "destinationAccountId" | "sourceAmount" | "destinationAmount" | "date">["errors"] = {};
  if (!form.sourceAccountId) errors.sourceAccountId = "Pilih akun asal.";
  if (!form.destinationAccountId) errors.destinationAccountId = "Pilih akun tujuan.";
  else if (form.destinationAccountId === form.sourceAccountId) errors.destinationAccountId = "Akun tujuan harus berbeda.";

  const sourceAmount = Number(form.sourceAmount);
  if (!form.sourceAmount.trim() || !Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    errors.sourceAmount = "Nominal dikirim harus lebih dari nol.";
  }

  const isCrossCurrency = form.sourceCurrency !== form.destinationCurrency;
  const destinationAmount = Number(form.destinationAmount);
  if (
    isCrossCurrency
    && (!form.destinationAmount.trim() || !Number.isFinite(destinationAmount) || destinationAmount <= 0)
  ) {
    errors.destinationAmount = "Nominal diterima harus lebih dari nol.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = "Pilih tanggal transfer.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateBalanceForm(form: {
  currentBalance: string;
  reportingBalanceIdr: string;
  currency: string;
}): ValidationResult<"currentBalance" | "reportingBalanceIdr"> {
  const errors: ValidationResult<"currentBalance" | "reportingBalanceIdr">["errors"] = {};
  if (!form.currentBalance.trim() || !Number.isFinite(Number(form.currentBalance))) {
    errors.currentBalance = "Masukkan saldo yang valid.";
  }
  if (
    form.currency !== "IDR"
    && form.reportingBalanceIdr.trim()
    && (!Number.isFinite(Number(form.reportingBalanceIdr)) || Number(form.reportingBalanceIdr) < 0)
  ) {
    errors.reportingBalanceIdr = "Nilai setara IDR tidak boleh negatif.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
