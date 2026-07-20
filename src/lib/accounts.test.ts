import { describe, expect, it } from "vitest";
import {
  filterAccounts,
  getAccountKindLabel,
  getMissingForeignAccounts,
  summarizeAccounts,
  validateAccountForm,
  validateBalanceForm,
  validateTransferForm,
  type AccountOverviewRecord,
} from "./accounts";

const accounts: AccountOverviewRecord[] = [
  {
    id: "jago",
    name: "Jago Utama",
    institution: "Bank Jago",
    kind: "bank",
    currency: "IDR",
    current_balance: 10_000_000,
    reporting_balance_idr: null,
    is_active: true,
    updated_at: "2026-07-19T08:00:00.000Z",
  },
  {
    id: "gopay",
    name: "GoPay",
    institution: null,
    kind: "ewallet",
    currency: "IDR",
    current_balance: 500_000,
    reporting_balance_idr: null,
    is_active: false,
    updated_at: "2026-07-18T08:00:00.000Z",
  },
  {
    id: "stockbit",
    name: "Stockbit",
    institution: "Stockbit",
    kind: "investment",
    currency: "IDR",
    current_balance: 25_000_000,
    reporting_balance_idr: null,
    is_active: true,
    updated_at: "2026-07-17T08:00:00.000Z",
  },
  {
    id: "broker",
    name: "Broker USD",
    institution: "HFM",
    kind: "trading",
    currency: "USD",
    current_balance: 1_000,
    reporting_balance_idr: 16_000_000,
    is_active: true,
    updated_at: "2026-07-16T08:00:00.000Z",
  },
  {
    id: "unreported",
    name: "Broker Cadangan",
    institution: null,
    kind: "trading",
    currency: "USD",
    current_balance: 250,
    reporting_balance_idr: null,
    is_active: true,
    updated_at: "2026-07-15T08:00:00.000Z",
  },
  {
    id: "credit",
    name: "Kartu Kredit",
    institution: "BCA",
    kind: "liability",
    currency: "IDR",
    current_balance: 4_000_000,
    reporting_balance_idr: null,
    is_active: true,
    updated_at: "2026-07-14T08:00:00.000Z",
  },
];

describe("account overview helpers", () => {
  it("summarizes active assets, liabilities, net worth, and account count in IDR", () => {
    expect(summarizeAccounts(accounts)).toEqual({
      assets: 51_000_000,
      liabilities: 4_000_000,
      netWorth: 47_000_000,
      activeCount: 5,
      missingForeignCount: 1,
    });
  });

  it("excludes inactive and unreported foreign balances without hiding the missing account", () => {
    expect(getMissingForeignAccounts(accounts).map((account) => account.id)).toEqual(["unreported"]);
  });

  it("treats a non-finite stored balance as zero in overview totals", () => {
    const corrupted = [{ ...accounts[0], current_balance: Number.NaN }];
    expect(summarizeAccounts(corrupted).assets).toBe(0);
  });

  it("maps liquid accounts and direct account kinds to the selected filter", () => {
    expect(filterAccounts(accounts, "liquid").map((account) => account.id)).toEqual(["jago", "gopay"]);
    expect(filterAccounts(accounts, "investment").map((account) => account.id)).toEqual(["stockbit"]);
    expect(filterAccounts(accounts, "all")).toHaveLength(accounts.length);
  });

  it("uses readable Indonesian labels for every account kind", () => {
    expect(getAccountKindLabel("bank")).toBe("Bank");
    expect(getAccountKindLabel("ewallet")).toBe("E-wallet");
    expect(getAccountKindLabel("investment")).toBe("Investasi");
    expect(getAccountKindLabel("trading")).toBe("Trading");
    expect(getAccountKindLabel("liability")).toBe("Kewajiban");
  });
});

describe("account form validation", () => {
  it("accepts a valid IDR account and ignores a reporting value", () => {
    expect(validateAccountForm({
      name: "Jago Utama",
      currency: "IDR",
      currentBalance: "2500000",
      reportingBalanceIdr: "",
    })).toEqual({ valid: true, errors: {} });
  });

  it("returns field errors for an empty name, invalid currency, and invalid balances", () => {
    const result = validateAccountForm({
      name: "   ",
      currency: "rupiah",
      currentBalance: "not-a-number",
      reportingBalanceIdr: "-1",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({
      name: expect.any(String),
      currency: expect.any(String),
      currentBalance: expect.any(String),
      reportingBalanceIdr: expect.any(String),
    });
  });

  it("requires valid source, destination, amount, currencies, and date for transfers", () => {
    expect(validateTransferForm({
      sourceAccountId: "jago",
      destinationAccountId: "broker",
      sourceAmount: "1000000",
      destinationAmount: "60",
      sourceCurrency: "IDR",
      destinationCurrency: "USD",
      date: "2026-07-19",
    })).toEqual({ valid: true, errors: {} });

    const invalid = validateTransferForm({
      sourceAccountId: "jago",
      destinationAccountId: "jago",
      sourceAmount: "0",
      destinationAmount: "",
      sourceCurrency: "IDR",
      destinationCurrency: "USD",
      date: "",
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toMatchObject({
      destinationAccountId: expect.any(String),
      sourceAmount: expect.any(String),
      destinationAmount: expect.any(String),
      date: expect.any(String),
    });

    const missingAccounts = validateTransferForm({
      sourceAccountId: "",
      destinationAccountId: "",
      sourceAmount: "1000",
      destinationAmount: "",
      sourceCurrency: "",
      destinationCurrency: "",
      date: "2026-07-19",
    });
    expect(missingAccounts.errors).toMatchObject({
      sourceAccountId: expect.any(String),
      destinationAccountId: expect.any(String),
    });
  });

  it("validates account balance snapshots and optional foreign IDR reporting values", () => {
    expect(validateBalanceForm({ currentBalance: "1250.5", reportingBalanceIdr: "20000000", currency: "USD" }))
      .toEqual({ valid: true, errors: {} });

    const invalid = validateBalanceForm({ currentBalance: "NaN", reportingBalanceIdr: "-10", currency: "USD" });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toMatchObject({
      currentBalance: expect.any(String),
      reportingBalanceIdr: expect.any(String),
    });
  });
});
