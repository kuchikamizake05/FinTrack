import { describe, expect, it } from "vitest";
import {
  buildAllTimeCategoryUsage,
  buildCategoryFilterOptions,
  buildCategoryUsage,
  buildTransactionCategoryOptions,
  filterCategories,
  getCategoryEditLocks,
  normalizeCategoryIcon,
  summarizeCategories,
  validateCategoryForm,
  type CategoryRecord,
} from "./categories";

const categories: CategoryRecord[] = [
  { id: "food", user_id: null, name: "Makanan", type: "expense", icon: "Utensils", color: "#166534", created_at: "2026-01-01" },
  { id: "salary", user_id: null, name: "Gaji", type: "income", icon: "BriefcaseBusiness", color: "#047857", created_at: "2026-01-01" },
  { id: "pet", user_id: "user-1", name: "Kucing", type: "expense", icon: "HeartPulse", color: "#0f766e", created_at: "2026-02-01" },
];

describe("category usage", () => {
  it("counts and sums only confirmed transactions for the current-month view", () => {
    expect(buildCategoryUsage([
      { category: "Makanan", amount: 50_000, type: "expense", status: "confirmed" },
      { category: "Makanan", amount: 25_000, type: "expense", status: "needs_review" },
      { category: "Gaji", amount: 8_000_000, type: "income", status: "confirmed" },
      { category: "Kucing", amount: 10_000, type: "expense", status: "deleted" },
    ])).toEqual({
      Makanan: { amount: 50_000, count: 1 },
      Gaji: { amount: 8_000_000, count: 1 },
    });
  });

  it("counts every non-deleted transaction for management locks", () => {
    expect(buildAllTimeCategoryUsage([
      { category: "Kucing", status: "needs_review" },
      { category: "Kucing", status: "confirmed" },
      { category: "Kucing", status: "deleted" },
    ])).toEqual({ Kucing: 2 });
  });

  it("summarizes visible, used, and confirmed transaction totals", () => {
    expect(summarizeCategories(categories, {
      Makanan: { amount: 50_000, count: 2 },
      Gaji: { amount: 8_000_000, count: 1 },
    })).toEqual({ visible: 3, used: 2, transactions: 3 });
  });
});

describe("category browsing and validation", () => {
  it("filters by type and a case-insensitive search", () => {
    expect(filterCategories(categories, { type: "expense", search: "KUC" }).map((category) => category.id)).toEqual(["pet"]);
  });

  it("rejects empty, too-long, and duplicate names while allowing the current edit record", () => {
    expect(validateCategoryForm({ name: " ", type: "expense", icon: "Tag", color: "#166534" }, categories).name).toBeTruthy();
    expect(validateCategoryForm({ name: "x".repeat(49), type: "expense", icon: "Tag", color: "#166534" }, categories).name).toBeTruthy();
    expect(validateCategoryForm({ name: " makanan ", type: "expense", icon: "Tag", color: "#166534" }, categories).name).toContain("sudah");
    expect(validateCategoryForm({ name: "Makanan", type: "expense", icon: "Tag", color: "#166534" }, categories, "food")).toEqual({});
  });

  it("validates the allowed type, icon, and hex color", () => {
    const errors = validateCategoryForm({ name: "Baru", type: "other" as "expense", icon: "Unknown", color: "green" }, categories);
    expect(errors.type).toBeTruthy();
    expect(errors.icon).toBeTruthy();
    expect(errors.color).toBeTruthy();
  });
});

describe("category management rules", () => {
  it("locks built-in categories completely and used custom category identity only", () => {
    expect(getCategoryEditLocks(categories[0], { Makanan: 2 })).toEqual({ canEdit: false, identityLocked: true });
    expect(getCategoryEditLocks(categories[2], { Kucing: 2 })).toEqual({ canEdit: true, identityLocked: true });
    expect(getCategoryEditLocks(categories[2], {})).toEqual({ canEdit: true, identityLocked: false });
  });

  it("normalizes unknown icons to a safe Tag fallback", () => {
    expect(normalizeCategoryIcon("Utensils")).toBe("Utensils");
    expect(normalizeCategoryIcon("RocketShip")).toBe("Tag");
    expect(normalizeCategoryIcon(null)).toBe("Tag");
  });

  it("builds typed transaction options and preserves a deleted historical label", () => {
    expect(buildTransactionCategoryOptions(categories, "expense", "Kategori Lama")).toEqual([
      "Kategori Lama",
      "Kucing",
      "Makanan",
    ]);
    expect(buildTransactionCategoryOptions(categories, "income", "Makanan")).toEqual(["Gaji"]);
  });

  it("combines active categories and historical transaction labels for filters", () => {
    expect(buildCategoryFilterOptions(categories, ["Makanan", "Kategori Lama", "Kucing"])).toEqual([
      "Gaji",
      "Kategori Lama",
      "Kucing",
      "Makanan",
    ]);
  });
});
