import { describe, expect, it } from "vitest";
import {
  applyReceiptExtractionToTransactionForm,
  canApproveTransaction,
  getTransactionSaveStatus,
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
    expect(validateTransactionForm({ accountId: "account-1", amount: "0125000" })).toBeNull();
  });

  it("maps technical source and status values to readable Indonesian labels", () => {
    expect(getTransactionSourceLabel("telegram_text")).toBe("Bot Telegram");
    expect(getTransactionSourceLabel("telegram_receipt")).toBe("Scan struk");
    expect(getTransactionSourceLabel("manual")).toBe("Input manual");
    expect(getTransactionSourceLabel("recurring")).toBe("Jadwal berulang");
    expect(getTransactionStatusLabel("pending_approval")).toBe("Perlu persetujuan");
    expect(getTransactionStatusLabel("needs_review")).toBe("Perlu ditinjau");
  });

  it("prefills only receipt fields and preserves account and type", () => {
    expect(applyReceiptExtractionToTransactionForm({
      date: "2026-08-22",
      merchant: "",
      category: "Lainnya",
      amount: "0",
      note: "",
      accountId: "account-1",
      type: "expense" as const,
    }, {
      date: "2026-08-20",
      merchant: "Kedai Kopi",
      amount: 25000,
      categoryHint: "Makanan",
      note: "Kopi susu",
      rawText: "private receipt text",
      confidence: 0.9,
    }, ["Makanan", "Transportasi"])).toEqual({
      date: "2026-08-20",
      merchant: "Kedai Kopi",
      category: "Makanan",
      amount: "25000",
      note: "Kopi susu",
      accountId: "account-1",
      type: "expense",
    });
  });

  it("keeps existing form values when receipt fields are absent or unmatched", () => {
    expect(applyReceiptExtractionToTransactionForm({
      date: "2026-08-22",
      merchant: "Manual",
      category: "Transportasi",
      amount: "10000",
      note: "Catatan",
    }, {
      date: null,
      merchant: null,
      amount: null,
      categoryHint: "Tidak ada",
      note: null,
      rawText: null,
      confidence: null,
    }, ["Makanan", "Transportasi"])).toEqual({
      date: "2026-08-22",
      merchant: "Manual",
      category: "Transportasi",
      amount: "10000",
      note: "Catatan",
    });
  });

  it("preserves review status until explicit approval", () => {
    expect(getTransactionSaveStatus("needs_review")).toBe("needs_review");
    expect(getTransactionSaveStatus("pending_approval")).toBe("pending_approval");
    expect(getTransactionSaveStatus()).toBe("confirmed");
    expect(canApproveTransaction("needs_review")).toBe(true);
    expect(canApproveTransaction("pending_approval")).toBe(true);
    expect(canApproveTransaction("confirmed")).toBe(false);
    expect(canApproveTransaction("deleted")).toBe(false);
  });

});
