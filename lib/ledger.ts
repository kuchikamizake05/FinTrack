export type FinancialAccountKind = "bank" | "ewallet" | "investment" | "trading" | "liability";

export type LedgerAccount = {
  id: string;
  kind: FinancialAccountKind;
  balance: number;
  isActive: boolean;
};

export type TransferInput = {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
};

export function calculateNetWorth(accounts: readonly LedgerAccount[]) {
  return accounts.reduce((total, account) => {
    if (!account.isActive) return total;
    const amount = Number(account.balance);
    return account.kind === "liability" ? total - amount : total + amount;
  }, 0);
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
