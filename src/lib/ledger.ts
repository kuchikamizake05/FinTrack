export type FinancialAccountKind = "bank" | "ewallet" | "investment" | "trading" | "liability";

export type LedgerAccount = {
  id: string;
  kind: FinancialAccountKind;
  balance: number;
  isActive: boolean;
};

export type ReportingLedgerAccount = LedgerAccount & {
  currency: string;
  reportingBalanceIdr: number | null;
};

export type TransferInput = {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
};

export type ExchangeTransferInput = {
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: number;
  destinationAmount: number;
  sourceCurrency: string;
  destinationCurrency: string;
};

export function calculateNetWorth(accounts: readonly LedgerAccount[]) {
  return accounts.reduce((total, account) => {
    if (!account.isActive) return total;
    const amount = Number(account.balance);
    return account.kind === "liability" ? total - amount : total + amount;
  }, 0);
}

export function calculateIdrNetWorth(accounts: readonly ReportingLedgerAccount[]) {
  return calculateNetWorth(accounts.map((account) => ({
    ...account,
    balance: account.currency === "IDR" ? account.balance : (account.reportingBalanceIdr ?? 0),
  })));
}

export function validateTransfer(transfer: TransferInput) {
  const valid =
    transfer.sourceAccountId.trim().length > 0 &&
    transfer.destinationAccountId.trim().length > 0 &&
    transfer.sourceAccountId !== transfer.destinationAccountId &&
    Number.isFinite(transfer.amount) &&
    transfer.amount > 0;

  return { valid };
}

export function validateExchangeTransfer(transfer: ExchangeTransferInput) {
  const valid =
    transfer.sourceAccountId.trim().length > 0 &&
    transfer.destinationAccountId.trim().length > 0 &&
    transfer.sourceAccountId !== transfer.destinationAccountId &&
    Number.isFinite(transfer.sourceAmount) &&
    transfer.sourceAmount > 0 &&
    Number.isFinite(transfer.destinationAmount) &&
    transfer.destinationAmount > 0 &&
    /^[A-Z]{3}$/.test(transfer.sourceCurrency) &&
    /^[A-Z]{3}$/.test(transfer.destinationCurrency);

  return { valid };
}
