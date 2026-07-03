import type { TransactionStatus, TransactionType } from "./finance";

export const CATEGORY_ICONS = [
  "Tag",
  "Utensils",
  "Car",
  "ShoppingBag",
  "CreditCard",
  "Tv",
  "HeartPulse",
  "GraduationCap",
  "Home",
  "BriefcaseBusiness",
  "Gift",
  "PiggyBank",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
export type CategoryType = TransactionType;

export type CategoryRecord = {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  created_at: string;
};

export type CategoryUsageTransaction = {
  category: string;
  amount: number;
  type: CategoryType;
  status: TransactionStatus;
};

export type CategoryUsage = Record<string, { amount: number; count: number }>;
export type CategoryFilter = { search: string; type: "all" | CategoryType };
export type CategoryFormValues = { name: string; type: CategoryType; icon: string; color: string };
export type CategoryFormErrors = Partial<Record<keyof CategoryFormValues, string>>;

const iconSet = new Set<string>(CATEGORY_ICONS);

export function buildCategoryUsage(transactions: readonly CategoryUsageTransaction[]) {
  return transactions.reduce<CategoryUsage>((usage, transaction) => {
    if (transaction.status !== "confirmed") return usage;
    const current = usage[transaction.category] ?? { amount: 0, count: 0 };
    usage[transaction.category] = {
      amount: current.amount + Number(transaction.amount),
      count: current.count + 1,
    };
    return usage;
  }, {});
}

export function buildAllTimeCategoryUsage(transactions: readonly Pick<CategoryUsageTransaction, "category" | "status">[]) {
  return transactions.reduce<Record<string, number>>((usage, transaction) => {
    if (transaction.status !== "deleted") {
      usage[transaction.category] = (usage[transaction.category] ?? 0) + 1;
    }
    return usage;
  }, {});
}

export function summarizeCategories(categories: readonly CategoryRecord[], usage: CategoryUsage) {
  return categories.reduce(
    (summary, category) => {
      const current = usage[category.name];
      if (current?.count) summary.used += 1;
      summary.transactions += current?.count ?? 0;
      return summary;
    },
    { visible: categories.length, used: 0, transactions: 0 },
  );
}

export function filterCategories(categories: readonly CategoryRecord[], filters: CategoryFilter) {
  const search = filters.search.trim().toLocaleLowerCase("id-ID");
  return categories.filter((category) => {
    if (filters.type !== "all" && category.type !== filters.type) return false;
    return !search || category.name.toLocaleLowerCase("id-ID").includes(search);
  });
}

export function validateCategoryForm(
  form: CategoryFormValues,
  categories: readonly CategoryRecord[],
  currentCategoryId?: string,
) {
  const errors: CategoryFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Nama kategori wajib diisi.";
  else if (name.length > 48) errors.name = "Nama kategori maksimal 48 karakter.";
  else if (categories.some((category) => category.id !== currentCategoryId && category.name.trim().toLocaleLowerCase("id-ID") === name.toLocaleLowerCase("id-ID"))) {
    errors.name = "Nama kategori sudah digunakan.";
  }
  if (form.type !== "income" && form.type !== "expense") errors.type = "Pilih tipe kategori yang valid.";
  if (!iconSet.has(form.icon)) errors.icon = "Pilih ikon yang tersedia.";
  if (!/^#[0-9a-f]{6}$/i.test(form.color)) errors.color = "Pilih warna kategori yang valid.";
  return errors;
}

export function getCategoryEditLocks(category: CategoryRecord, allTimeUsage: Readonly<Record<string, number>>) {
  const isBuiltIn = category.user_id === null;
  return {
    canEdit: !isBuiltIn,
    identityLocked: isBuiltIn || (allTimeUsage[category.name] ?? 0) > 0,
  };
}

export function normalizeCategoryIcon(icon: string | null | undefined): CategoryIcon {
  return icon && iconSet.has(icon) ? icon as CategoryIcon : "Tag";
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "id-ID"));
}

export function buildTransactionCategoryOptions(
  categories: readonly CategoryRecord[],
  type: CategoryType,
  historicalCategory?: string,
) {
  const activeNames = new Set(categories.map((category) => category.name));
  const options = categories.filter((category) => category.type === type).map((category) => category.name);
  if (historicalCategory && !activeNames.has(historicalCategory)) options.push(historicalCategory);
  return uniqueSorted(options);
}

export function buildCategoryFilterOptions(categories: readonly CategoryRecord[], transactionCategories: readonly string[]) {
  return uniqueSorted([...categories.map((category) => category.name), ...transactionCategories]);
}
