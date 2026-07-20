import { calculatePercentageChange } from "./analytics";

export type InsightTransaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  status: "confirmed" | "pending_approval" | "needs_review" | "deleted";
  merchant?: string | null;
  note?: string | null;
  receipt_url?: string | null;
};

export type InsightActionId =
  | "review-pending"
  | "review-top-category"
  | "protect-positive-cashflow"
  | "improve-negative-cashflow"
  | "complete-account-reporting";

export type InsightAction = {
  id: InsightActionId;
  title: string;
  reason: string;
  impact: "high" | "medium" | "low";
  href: "/transactions" | "/categories" | "/accounts" | "/dashboard";
};

type PeriodMetrics = {
  income: number;
  expense: number;
  netCashFlow: number;
  confirmedCount: number;
  expenseCount: number;
  averageExpense: number;
};

export type InsightSnapshot = {
  periodLabel: string;
  previousPeriodLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  savingsRate: number | null;
  expenseChange: number | null;
  incomeChange: number | null;
  pendingCount: number;
  activeAccountCount: number;
  uncoveredForeignAccountCount: number;
  topCategories: Array<{ name: string; amount: number; share: number }>;
  categoryConcentration: { category: string; share: number; level: "normal" | "high" } | null;
  largestCategoryMovement: { category: string; currentAmount: number; previousAmount: number; changeAmount: number } | null;
};

export type DeterministicInsight = {
  headline: string;
  summary: string;
  tone: "positive" | "neutral" | "attention";
  actions: InsightAction[];
  observations: string[];
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function summarize(transactions: readonly InsightTransaction[]): PeriodMetrics {
  const confirmed = transactions.filter((transaction) => transaction.status === "confirmed");
  const income = confirmed
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const expenses = confirmed.filter((transaction) => transaction.type === "expense");
  const expense = expenses.reduce((total, transaction) => total + Number(transaction.amount), 0);
  return {
    income,
    expense,
    netCashFlow: income - expense,
    confirmedCount: confirmed.length,
    expenseCount: expenses.length,
    averageExpense: expenses.length ? round(expense / expenses.length) : 0,
  };
}

function categoryTotals(transactions: readonly InsightTransaction[]) {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (transaction.status !== "confirmed" || transaction.type !== "expense") return totals;
    const category = transaction.category.trim() || "Tanpa kategori";
    totals[category] = (totals[category] ?? 0) + Number(transaction.amount);
    return totals;
  }, {});
}

export function calculateSavingsRate(income: number, expense: number) {
  if (!Number.isFinite(income) || !Number.isFinite(expense) || income <= 0) return null;
  return round(((income - expense) / income) * 100, 1);
}

export function buildInsightSnapshot({
  current,
  previous,
  periodLabel,
  previousPeriodLabel,
  activeAccountCount,
  uncoveredForeignAccountCount,
}: {
  current: readonly InsightTransaction[];
  previous: readonly InsightTransaction[];
  periodLabel: string;
  previousPeriodLabel: string;
  activeAccountCount: number;
  uncoveredForeignAccountCount: number;
}): InsightSnapshot {
  const currentMetrics = summarize(current);
  const previousMetrics = summarize(previous);
  const currentCategories = categoryTotals(current);
  const previousCategories = categoryTotals(previous);
  const topCategories = Object.entries(currentCategories)
    .sort((left, right) => right[1] - left[1])
    .map(([name, amount]) => ({
      name,
      amount,
      share: currentMetrics.expense ? round((amount / currentMetrics.expense) * 100, 1) : 0,
    }));
  const largestCategoryMovement = [...new Set([...Object.keys(currentCategories), ...Object.keys(previousCategories)])]
    .map((category) => ({
      category,
      currentAmount: currentCategories[category] ?? 0,
      previousAmount: previousCategories[category] ?? 0,
      changeAmount: (currentCategories[category] ?? 0) - (previousCategories[category] ?? 0),
    }))
    .sort((left, right) => Math.abs(right.changeAmount) - Math.abs(left.changeAmount))[0] ?? null;
  const primaryCategory = topCategories[0];

  return {
    periodLabel,
    previousPeriodLabel,
    current: currentMetrics,
    previous: previousMetrics,
    savingsRate: calculateSavingsRate(currentMetrics.income, currentMetrics.expense),
    expenseChange: calculatePercentageChange(currentMetrics.expense, previousMetrics.expense),
    incomeChange: calculatePercentageChange(currentMetrics.income, previousMetrics.income),
    pendingCount: current.filter((transaction) => transaction.status === "pending_approval" || transaction.status === "needs_review").length,
    activeAccountCount,
    uncoveredForeignAccountCount,
    topCategories,
    categoryConcentration: primaryCategory ? {
      category: primaryCategory.name,
      share: primaryCategory.share,
      level: primaryCategory.share >= 50 ? "high" : "normal",
    } : null,
    largestCategoryMovement,
  };
}

function buildCandidateActions(snapshot: InsightSnapshot): InsightAction[] {
  const actions: InsightAction[] = [];
  if (snapshot.pendingCount > 0) actions.push({
    id: "review-pending",
    title: "Tinjau transaksi tertunda",
    reason: `${snapshot.pendingCount} transaksi belum masuk ke perhitungan terverifikasi.`,
    impact: "high",
    href: "/transactions",
  });
  if (snapshot.current.netCashFlow < 0) actions.push({
    id: "improve-negative-cashflow",
    title: "Pulihkan arus kas bulan ini",
    reason: "Pengeluaran terverifikasi lebih besar daripada pemasukan.",
    impact: "high",
    href: "/transactions",
  });
  if (snapshot.categoryConcentration?.level === "high") actions.push({
    id: "review-top-category",
    title: `Tinjau kategori ${snapshot.categoryConcentration.category}`,
    reason: `Kategori ini menyumbang ${snapshot.categoryConcentration.share}% pengeluaran bulan berjalan.`,
    impact: "medium",
    href: "/categories",
  });
  if (snapshot.uncoveredForeignAccountCount > 0) actions.push({
    id: "complete-account-reporting",
    title: "Lengkapi nilai akun valuta asing",
    reason: `${snapshot.uncoveredForeignAccountCount} akun belum memiliki nilai pelaporan IDR.`,
    impact: "medium",
    href: "/accounts",
  });
  if (snapshot.current.netCashFlow >= 0 && actions.length < 3) actions.push({
    id: "protect-positive-cashflow",
    title: "Pertahankan ruang arus kas",
    reason: "Pemasukan masih menutup pengeluaran pada periode ini.",
    impact: "low",
    href: "/dashboard",
  });
  return actions.slice(0, 3);
}

export function buildDeterministicInsight(snapshot: InsightSnapshot): DeterministicInsight {
  const positive = snapshot.current.netCashFlow >= 0;
  const observations: string[] = [];
  if (snapshot.categoryConcentration) observations.push(
    `${snapshot.categoryConcentration.category} mencakup ${snapshot.categoryConcentration.share}% dari pengeluaran.`,
  );
  if (snapshot.expenseChange !== null) observations.push(
    `Pengeluaran ${snapshot.expenseChange > 0 ? "naik" : "turun"} ${Math.abs(snapshot.expenseChange)}% dibanding ${snapshot.previousPeriodLabel}.`,
  );
  if (snapshot.pendingCount > 0) observations.push(`${snapshot.pendingCount} transaksi masih menunggu peninjauan.`);

  return {
    headline: positive ? "Ruang arus kas masih terjaga" : "Arus kas perlu perhatian",
    summary: positive
      ? "Pemasukan terverifikasi masih lebih besar daripada pengeluaran. Gunakan pola kategori dan transaksi tertunda untuk menentukan langkah berikutnya."
      : "Pengeluaran terverifikasi melewati pemasukan. Mulai dari kategori terbesar dan transaksi yang belum ditinjau.",
    tone: positive ? "positive" : "attention",
    actions: buildCandidateActions(snapshot),
    observations: observations.slice(0, 3),
  };
}

export function buildPrivateInsightPayload(snapshot: InsightSnapshot) {
  const fallback = buildDeterministicInsight(snapshot);
  return {
    version: 1 as const,
    periodLabel: snapshot.periodLabel.slice(0, 40),
    previousPeriodLabel: snapshot.previousPeriodLabel.slice(0, 40),
    metrics: {
      income: round(snapshot.current.income),
      expense: round(snapshot.current.expense),
      netCashFlow: round(snapshot.current.netCashFlow),
      savingsRate: snapshot.savingsRate,
      expenseChange: snapshot.expenseChange,
      incomeChange: snapshot.incomeChange,
      confirmedCount: snapshot.current.confirmedCount,
      pendingCount: snapshot.pendingCount,
      averageExpense: snapshot.current.averageExpense,
      activeAccountCount: snapshot.activeAccountCount,
      uncoveredForeignAccountCount: snapshot.uncoveredForeignAccountCount,
    },
    topCategories: snapshot.topCategories.slice(0, 5).map((category) => ({
      name: category.name.slice(0, 40),
      amount: round(category.amount),
      share: category.share,
    })),
    largestCategoryMovement: snapshot.largestCategoryMovement ? {
      category: snapshot.largestCategoryMovement.category.slice(0, 40),
      currentAmount: round(snapshot.largestCategoryMovement.currentAmount),
      previousAmount: round(snapshot.largestCategoryMovement.previousAmount),
      changeAmount: round(snapshot.largestCategoryMovement.changeAmount),
    } : null,
    candidateActions: fallback.actions.map(({ id, title, reason, impact, href }) => ({ id, title, reason, impact, href })),
  };
}
