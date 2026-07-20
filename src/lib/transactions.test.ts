import { describe, expect, it } from "vitest";
import {
  getTransactionSourceLabel,
  getTransactionStatusLabel,
  hasActiveTransactionFilters,
  summarizeTransactionList,
  validateTransactionForm,
} from "./transactions";

const transactions = [
  {
    id: "1",
    date: "2026-07-19",
    type: "income" as const,
    category: "Freelance",
    amount: 1_500_000,
    status: "confirmed" as const,
    merchant: "Studio, Inc.",
    note: "Invoice \"Juli\"",
    source: "manual",
    account_id: "account-1",
  },
  {
    id: "2",
    date: "2026-07-18",
    type: "expense" as const,
    category: "Transportasi",
    amount: 75_000,
    status: "confirmed" as const,
    merchant: "KRL",
    note: null,
    source: "telegram_text",
    account_id: "account-1",
  },
  {
    id: "3",
    date: "2026-07-17",
    type: "expense" as const,
    category: "Makanan & Minuman",
    amount: 50_000,
    status: "pending_approval" as const,
    merchant: "Kopi",
    note: null,
    source: "telegram_receipt",
    account_id: "account-2",
  },
];

describe("transaction presentation helpers", () => {
  it("summarizes confirmed transactions without counting review items", () => {
    expect(summarizeTransactionList(transactions)).toEqual({
      income: 1_500_000,
      expense: 75_000,
      net: 1_425_000,
    });
  });

  it("detects filters beyond the default active status", () => {
    expect(hasActiveTransactionFilters({
      search: "",
      category: "all",
      type: "all",
      status: "active",
      startDate: "",
      endDate: "",
    })).toBe(false);

    expect(hasActiveTransactionFilters({
      search: "kopi",
      category: "all",
      type: "all",
      status: "active",
      startDate: "",
      endDate: "",
    })).toBe(true);
  });

  it("returns a concise validation error for missing account and invalid amount", () => {
    expect(validateTransactionForm({ accountId: "", amount: "0" })).toBe(
      "Pilih akun dan masukkan nominal lebih dari nol.",
    );
    expect(validateTransactionForm({ accountId: "account-1", amount: "125000" })).toBeNull();
  });

  it("maps technical source and status values to readable Indonesian labels", () => {
    expect(getTransactionSourceLabel("telegram_text")).toBe("Bot Telegram");
    expect(getTransactionSourceLabel("telegram_receipt")).toBe("Scan struk");
    expect(getTransactionSourceLabel("manual")).toBe("Input manual");
    expect(getTransactionStatusLabel("pending_approval")).toBe("Perlu persetujuan");
    expect(getTransactionStatusLabel("needs_review")).toBe("Perlu ditinjau");
  });

});
