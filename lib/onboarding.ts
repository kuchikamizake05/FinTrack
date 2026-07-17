import { validateAccountForm } from "./accounts";
import { validateTransactionForm } from "./transactions";

export type OnboardingIntent = "cash-flow" | "balance" | "habit";
export type OnboardingStep = "welcome" | "account" | "transaction" | "summary";
export type OnboardingEligibility =
  | "legacy-active"
  | "onboarding-required"
  | "onboarding-active"
  | "deferred"
  | "completed";

export type OnboardingProgress = {
  version: 1;
  userId: string;
  step: OnboardingStep;
  intent: OnboardingIntent | null;
  accountId: string | null;
  accountName: string | null;
  transactionId: string | null;
  completedAt: string | null;
  deferredUntil: string | null;
};

const progressSteps: OnboardingStep[] = ["welcome", "account", "transaction", "summary"];
const intents: OnboardingIntent[] = ["cash-flow", "balance", "habit"];
const deferralMilliseconds = 7 * 24 * 60 * 60 * 1_000;

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function buildOnboardingStorageKey(userId: string) {
  return `fintrack:onboarding:v1:${userId}`;
}

export function parseOnboardingProgress(raw: string | null, userId: string): OnboardingProgress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OnboardingProgress>;
    if (
      value.version !== 1
      || value.userId !== userId
      || !progressSteps.includes(value.step as OnboardingStep)
      || !(value.intent === null || intents.includes(value.intent as OnboardingIntent))
      || !isNullableString(value.accountId)
      || !isNullableString(value.accountName)
      || !isNullableString(value.transactionId)
      || !isNullableString(value.completedAt)
      || !isNullableString(value.deferredUntil)
    ) return null;
    return value as OnboardingProgress;
  } catch {
    return null;
  }
}

export function resolveOnboardingEligibility({ hasAccount, hasTransaction, progress, now }: {
  hasAccount: boolean;
  hasTransaction: boolean;
  progress: OnboardingProgress | null;
  now: Date;
}): OnboardingEligibility {
  if (progress?.completedAt) return "completed";
  if (progress?.deferredUntil) {
    const deferredUntil = Date.parse(progress.deferredUntil);
    if (Number.isFinite(deferredUntil) && deferredUntil > now.getTime()) return "deferred";
  }
  if (progress) return "onboarding-active";
  if (hasAccount || hasTransaction) return "legacy-active";
  return "onboarding-required";
}

export function resolveOnboardingStep(
  progress: OnboardingProgress,
  records: { accountExists: boolean; transactionExists: boolean },
): OnboardingStep {
  if (progress.transactionId && records.transactionExists && records.accountExists) return "summary";
  if (progress.accountId && records.accountExists) return "transaction";
  if (progress.intent || progress.step !== "welcome") return "account";
  return "welcome";
}

export function getOnboardingProgressInfo(step: OnboardingStep) {
  if (step === "welcome") return { current: 1, total: 3, percentage: 0 };
  if (step === "account") return { current: 2, total: 3, percentage: 50 };
  return { current: 3, total: 3, percentage: 100 };
}

export function createOnboardingDeferral(progress: OnboardingProgress, now: Date): OnboardingProgress {
  return {
    ...progress,
    deferredUntil: new Date(now.getTime() + deferralMilliseconds).toISOString(),
  };
}

export function resolveOnboardingDestination({ pathname, eligibility }: {
  pathname: string;
  eligibility: OnboardingEligibility;
}) {
  if (pathname === "/onboarding") {
    return eligibility === "legacy-active" || eligibility === "completed" ? "/dashboard" : null;
  }
  return eligibility === "onboarding-required" || eligibility === "onboarding-active" ? "/onboarding" : null;
}

export function shouldShowOnboardingResume({ eligibility, hasConfirmedTransaction, dismissed }: {
  eligibility: OnboardingEligibility;
  hasConfirmedTransaction: boolean;
  dismissed: boolean;
}) {
  return eligibility === "deferred" && !hasConfirmedTransaction && !dismissed;
}

export function validateOnboardingAccount(form: {
  name: string;
  currency: string;
  currentBalance: string;
  reportingBalanceIdr: string;
}) {
  return validateAccountForm(form);
}

export function validateOnboardingTransaction(form: {
  accountId: string;
  type: "income" | "expense";
  amount: string;
  merchant: string;
  date: string;
  category: string;
}) {
  const errors: Partial<Record<"accountId" | "amount" | "merchant" | "date" | "category", string>> = {};
  const baseError = validateTransactionForm({ accountId: form.accountId, amount: form.amount });
  const amount = Number(form.amount);
  if (baseError && !form.accountId) errors.accountId = baseError;
  if (baseError && (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0)) errors.amount = baseError;
  if (!form.merchant.trim()) errors.merchant = "Nama merchant atau sumber wajib diisi.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = "Pilih tanggal transaksi.";
  if (!form.category.trim()) errors.category = "Kategori wajib diisi.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildOnboardingSummary({ accountName, currency, openingBalance, transactionType, transactionAmount }: {
  accountName: string;
  currency: string;
  openingBalance: number;
  transactionType: "income" | "expense";
  transactionAmount: number;
}) {
  const cashFlowImpact = transactionType === "income" ? transactionAmount : -transactionAmount;
  return {
    accountName,
    currency,
    currentBalance: openingBalance + cashFlowImpact,
    cashFlowImpact,
  };
}
