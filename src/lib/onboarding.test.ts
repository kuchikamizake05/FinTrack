import { describe, expect, it } from "vitest";
import {
  buildOnboardingStorageKey,
  buildOnboardingSummary,
  createOnboardingDeferral,
  getOnboardingProgressInfo,
  parseOnboardingProgress,
  resolveOnboardingDestination,
  resolveOnboardingEligibility,
  resolveOnboardingStep,
  shouldShowOnboardingResume,
  validateOnboardingAccount,
  validateOnboardingTransaction,
  type OnboardingProgress,
} from "./onboarding";

const userId = "6f432126-65da-4a44-b93d-9d86b2e4c980";
const now = new Date("2026-07-20T08:00:00.000Z");

function progress(overrides: Partial<OnboardingProgress> = {}): OnboardingProgress {
  return {
    version: 1,
    userId,
    step: "welcome",
    intent: null,
    accountId: null,
    accountName: null,
    transactionId: null,
    completedAt: null,
    deferredUntil: null,
    ...overrides,
  };
}

describe("onboarding eligibility", () => {
  it("requires onboarding for a genuinely empty user", () => {
    expect(resolveOnboardingEligibility({ hasAccount: false, hasTransaction: false, progress: null, now })).toBe("onboarding-required");
  });

  it("never forces legacy account-only or transaction-only users", () => {
    expect(resolveOnboardingEligibility({ hasAccount: true, hasTransaction: false, progress: null, now })).toBe("legacy-active");
    expect(resolveOnboardingEligibility({ hasAccount: false, hasTransaction: true, progress: null, now })).toBe("legacy-active");
  });

  it("keeps an already-started journey active after account creation", () => {
    expect(resolveOnboardingEligibility({
      hasAccount: true,
      hasTransaction: false,
      progress: progress({ step: "transaction", accountId: "account-1" }),
      now,
    })).toBe("onboarding-active");
  });

  it("honors completion and only an unexpired deferral", () => {
    expect(resolveOnboardingEligibility({
      hasAccount: true,
      hasTransaction: true,
      progress: progress({ completedAt: "2026-07-19T08:00:00.000Z" }),
      now,
    })).toBe("completed");
    expect(resolveOnboardingEligibility({
      hasAccount: false,
      hasTransaction: false,
      progress: progress({ deferredUntil: "2026-07-21T08:00:00.000Z" }),
      now,
    })).toBe("deferred");
    expect(resolveOnboardingEligibility({
      hasAccount: false,
      hasTransaction: false,
      progress: progress({ deferredUntil: "2026-07-19T08:00:00.000Z" }),
      now,
    })).toBe("onboarding-active");
  });
});

describe("onboarding progress", () => {
  it("uses a stable per-user storage key", () => {
    expect(buildOnboardingStorageKey(userId)).toBe(`fintrack:onboarding:v1:${userId}`);
  });

  it("parses valid progress and rejects malformed, foreign, or unknown versions", () => {
    const valid = progress({ step: "account", intent: "cash-flow" });
    expect(parseOnboardingProgress(JSON.stringify(valid), userId)).toEqual(valid);
    expect(parseOnboardingProgress("not-json", userId)).toBeNull();
    expect(parseOnboardingProgress(JSON.stringify({ ...valid, userId: "another-user" }), userId)).toBeNull();
    expect(parseOnboardingProgress(JSON.stringify({ ...valid, version: 2 }), userId)).toBeNull();
    expect(parseOnboardingProgress(JSON.stringify({ ...valid, step: "unknown" }), userId)).toBeNull();
  });

  it("resolves recovery steps from verified server records", () => {
    expect(resolveOnboardingStep(progress(), { accountExists: false, transactionExists: false })).toBe("welcome");
    expect(resolveOnboardingStep(progress({ intent: "cash-flow", step: "account" }), { accountExists: false, transactionExists: false })).toBe("account");
    expect(resolveOnboardingStep(progress({ step: "transaction", accountId: "account-1" }), { accountExists: true, transactionExists: false })).toBe("transaction");
    expect(resolveOnboardingStep(progress({ step: "summary", accountId: "account-1", transactionId: "tx-1" }), { accountExists: true, transactionExists: true })).toBe("summary");
    expect(resolveOnboardingStep(progress({ step: "transaction", accountId: "missing" }), { accountExists: false, transactionExists: false })).toBe("account");
  });

  it("maps the four visible states to a three-step progress contract", () => {
    expect(getOnboardingProgressInfo("welcome")).toEqual({ current: 1, total: 3, percentage: 0 });
    expect(getOnboardingProgressInfo("account")).toEqual({ current: 2, total: 3, percentage: 50 });
    expect(getOnboardingProgressInfo("transaction")).toEqual({ current: 3, total: 3, percentage: 100 });
    expect(getOnboardingProgressInfo("summary")).toEqual({ current: 3, total: 3, percentage: 100 });
  });

  it("creates a seven-day deferral without changing saved progress", () => {
    const deferred = createOnboardingDeferral(progress({ step: "account", intent: "balance" }), now);
    expect(deferred.step).toBe("account");
    expect(deferred.intent).toBe("balance");
    expect(deferred.deferredUntil).toBe("2026-07-27T08:00:00.000Z");
  });
});

describe("onboarding redirects", () => {
  it("sends required and active users to onboarding from protected routes", () => {
    expect(resolveOnboardingDestination({ pathname: "/dashboard", eligibility: "onboarding-required" })).toBe("/onboarding");
    expect(resolveOnboardingDestination({ pathname: "/transactions", eligibility: "onboarding-active" })).toBe("/onboarding");
  });

  it("lets deferred and active users continue without redirect", () => {
    expect(resolveOnboardingDestination({ pathname: "/dashboard", eligibility: "deferred" })).toBeNull();
    expect(resolveOnboardingDestination({ pathname: "/accounts", eligibility: "legacy-active" })).toBeNull();
  });

  it("moves ineligible users away from the onboarding route", () => {
    expect(resolveOnboardingDestination({ pathname: "/onboarding", eligibility: "legacy-active" })).toBe("/dashboard");
    expect(resolveOnboardingDestination({ pathname: "/onboarding", eligibility: "completed" })).toBe("/dashboard");
    expect(resolveOnboardingDestination({ pathname: "/onboarding", eligibility: "onboarding-active" })).toBeNull();
  });
});

describe("onboarding dashboard continuation", () => {
  it("shows the resume card for a deferred empty overview, including an account-only setup", () => {
    expect(shouldShowOnboardingResume({ eligibility: "deferred", hasConfirmedTransaction: false, dismissed: false })).toBe(true);
    expect(shouldShowOnboardingResume({ eligibility: "deferred", hasConfirmedTransaction: true, dismissed: false })).toBe(false);
    expect(shouldShowOnboardingResume({ eligibility: "deferred", hasConfirmedTransaction: false, dismissed: true })).toBe(false);
    expect(shouldShowOnboardingResume({ eligibility: "completed", hasConfirmedTransaction: false, dismissed: false })).toBe(false);
  });
});

describe("onboarding validation and value summary", () => {
  it("composes account validation", () => {
    expect(validateOnboardingAccount({ name: "", currency: "ID", currentBalance: "x", reportingBalanceIdr: "" })).toEqual({
      valid: false,
      errors: {
        name: "Nama akun wajib diisi.",
        currency: "Gunakan kode mata uang tiga huruf.",
        currentBalance: "Masukkan saldo awal yang valid.",
      },
    });
  });

  it("requires a complete confirmed first transaction", () => {
    expect(validateOnboardingTransaction({ accountId: "", type: "expense", amount: "0", merchant: "", date: "", category: "" })).toEqual({
      valid: false,
      errors: {
        accountId: "Pilih akun dan masukkan nominal lebih dari nol.",
        amount: "Pilih akun dan masukkan nominal lebih dari nol.",
        merchant: "Nama merchant atau sumber wajib diisi.",
        date: "Pilih tanggal transaksi.",
        category: "Kategori wajib diisi.",
      },
    });
    expect(validateOnboardingTransaction({ accountId: "account-1", type: "income", amount: "250000", merchant: "Gaji", date: "2026-07-20", category: "Pemasukan" }).valid).toBe(true);
  });

  it("shows the first real balance and cash-flow impact", () => {
    expect(buildOnboardingSummary({ accountName: "Jago Utama", currency: "IDR", openingBalance: 1_000_000, transactionType: "expense", transactionAmount: 125_000 })).toEqual({
      accountName: "Jago Utama",
      currency: "IDR",
      currentBalance: 875_000,
      cashFlowImpact: -125_000,
    });
  });
});
