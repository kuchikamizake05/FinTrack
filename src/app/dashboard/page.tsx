"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, getDaysInMonth, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { enUS, id } from "date-fns/locale";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  EyeOff,
  Goal,
  Flame,
  Loader2,
  ReceiptText,
  RefreshCw,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "@/components/Navbar";
import { useFinancialJourney } from "@/components/FinancialJourney";
import JourneySummary from "@/components/JourneySummary";
import { useOnboarding } from "@/components/OnboardingBoundary";
import { Button } from "@/components/ui/Button";
import { CardHeader } from "@/components/ui/CardHeader";
import { calculatePercentageChange } from "@/lib/analytics";
import { groupTransactionAmountsByCurrency } from "@/lib/finance";
import {
  buildCumulativeCashFlowSeries,
  calculateGoalProgress,
  maskAmount,
} from "@/lib/home";
import { reportHandledError } from "@/lib/errors";
import type { FinancialAccountKind } from "@/lib/ledger";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { shouldShowOnboardingResume } from "@/lib/onboarding";
import { useLanguage } from "@/components/LanguageProvider";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  merchant: string | null;
  category: string;
  amount: number;
  note: string | null;
  source: string;
  receipt_url: string | null;
  ai_confidence: number | null;
  status: "confirmed" | "pending_approval" | "needs_review" | "deleted";
  account_id: string | null;
  created_at: string;
};

type FinancialAccount = {
  id: string;
  name: string;
  institution: string | null;
  kind: FinancialAccountKind;
  currency: string;
  current_balance: number;
  reporting_balance_idr: number | null;
  is_active: boolean;
  updated_at: string;
};

type FinancialGoal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  color: string | null;
  due_date: string | null;
};

type FinancialBudget = {
  id: string;
  category: string;
  month: string;
  limit_amount: number;
};

function withTimeout<T>(promise: PromiseLike<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Koneksi terlalu lama. Silakan coba lagi.")), milliseconds);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default function DashboardPage() {
  const journey = useFinancialJourney();
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : id;
  const router = useRouter();
  const onboarding = useOnboarding(false);
  const onboardingEligibility = onboarding?.eligibility;
  const onboardingProgress = onboarding?.progress;
  const saveProgress = onboarding?.saveProgress;
  const [today] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTx, setPendingTx] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [budgets, setBudgets] = useState<FinancialBudget[]>([]);
  const [firstName, setFirstName] = useState("Kamu");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState<Array<Pick<Transaction, "amount" | "account_id">>>([]);
  const [showBalances, setShowBalances] = useState(true);
  const [setupCardDismissed, setSetupCardDismissed] = useState(false);

  const setupDismissKey = onboardingProgress?.deferredUntil
    ? `fintrack:onboarding-resume-hidden:${onboardingProgress.userId}:${onboardingProgress.deferredUntil}`
    : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowBalances(window.localStorage.getItem("fintrack-show-balances") !== "false");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!setupDismissKey) return;
    const timer = window.setTimeout(() => {
      setSetupCardDismissed(window.localStorage.getItem(setupDismissKey) === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setupDismissKey]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      await withTimeout((async () => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;
        const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Kamu";
        setFirstName(String(displayName).split(" ")[0]);

        const start = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
        const end = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
        const previousMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);

        const [txResult, previousResult, pendingResult, accountResult, goalResult, budgetResult] = await Promise.all([
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .neq("status", "deleted")
            .neq("status", "pending_approval")
            .neq("status", "needs_review")
            .gte("date", start)
            .lte("date", end)
            .order("date", { ascending: false }),
          supabase
            .from("transactions")
            .select("amount, account_id")
            .eq("user_id", user.id)
            .eq("type", "expense")
            .neq("status", "deleted")
            .neq("status", "pending_approval")
            .neq("status", "needs_review")
            .gte("date", format(startOfMonth(previousMonth), "yyyy-MM-dd"))
            .lte("date", format(endOfMonth(previousMonth), "yyyy-MM-dd")),
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .in("status", ["pending_approval", "needs_review"])
            .order("created_at", { ascending: false }),
          supabase
            .from("financial_accounts")
            .select("id, name, institution, kind, currency, current_balance, reporting_balance_idr, is_active, updated_at")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("financial_goals")
            .select("id, name, target_amount, current_amount, currency, color, due_date")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("financial_budgets")
            .select("id, category, month, limit_amount")
            .eq("user_id", user.id)
            .eq("month", start)
            .order("category"),
        ]);

        if (txResult.error) throw txResult.error;
        if (previousResult.error) throw previousResult.error;
        if (pendingResult.error) throw pendingResult.error;
        if (accountResult.error) throw accountResult.error;

        setTransactions((txResult.data || []) as Transaction[]);
        setPreviousMonthExpenses((previousResult.data || []) as Array<Pick<Transaction, "amount" | "account_id">>);
        setPendingTx((pendingResult.data || []) as Transaction[]);
        setAccounts((accountResult.data || []) as FinancialAccount[]);

        if (goalResult.error) {
          if (goalResult.error.code !== "42P01" && goalResult.error.code !== "PGRST205") throw goalResult.error;
          setGoals([]);
        } else {
          setGoals((goalResult.data || []) as FinancialGoal[]);
        }

        if (budgetResult.error) {
          if (budgetResult.error.code !== "42P01" && budgetResult.error.code !== "PGRST205") throw budgetResult.error;
          setBudgets([]);
        } else {
          setBudgets((budgetResult.data || []) as FinancialBudget[]);
        }
      })(), 12_000);
    } catch (error) {
      const normalizedError = reportHandledError("Dashboard data unavailable", error, "Data dashboard belum bisa dimuat.");
      setLoadError(normalizedError.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboardData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboardData]);

  const adjustMonth = (amount: number) => {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const toggleBalances = () => {
    setShowBalances((current) => {
      const next = !current;
      window.localStorage.setItem("fintrack-show-balances", String(next));
      return next;
    });
  };

  const accountCurrencies = new Map(accounts.map((account) => [account.id, account.currency]));
  const transactionCurrencies = new Set(transactions.map((transaction) => transaction.account_id ? accountCurrencies.get(transaction.account_id) ?? "Tidak diketahui" : "Tidak diketahui"));
  const cashFlowCurrency = transactionCurrencies.size === 1 && !transactionCurrencies.has("Tidak diketahui") ? [...transactionCurrencies][0] : null;
  const cashFlowTransactions = cashFlowCurrency
    ? transactions.filter((transaction) => transaction.account_id && accountCurrencies.get(transaction.account_id) === cashFlowCurrency)
    : [];
  const totalIncome = cashFlowTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalExpense = cashFlowTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const balance = totalIncome - totalExpense;
  const previousMonthExpense = cashFlowCurrency
    ? previousMonthExpenses
      .filter((transaction) => transaction.account_id && accountCurrencies.get(transaction.account_id) === cashFlowCurrency)
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    : 0;
  const expenseChange = cashFlowCurrency ? calculatePercentageChange(totalExpense, previousMonthExpense) : null;
  const daysInMonth = getDaysInMonth(selectedMonth);
  const sampleDays = [...new Set([1, 7, 13, 19, 25, daysInMonth])].filter((day) => day <= daysInMonth);
  const cashFlowData = buildCumulativeCashFlowSeries(
    cashFlowTransactions.map(({ date, type, amount }) => ({ date, type, amount: Number(amount) })),
    sampleDays,
    format(selectedMonth, "MMM", { locale: id }),
  );
  const formatCurrency = (amount: number, currency?: string | null) => {
    const code = currency ?? "IDR";
    return new Intl.NumberFormat(language === "en" ? "en-US" : "id-ID", { style: "currency", currency: code, maximumFractionDigits: code === "IDR" ? 0 : 2 }).format(Math.abs(amount));
  };
  const displayCurrency = (amount: number, currency?: string | null) => maskAmount(formatCurrency(amount, currency), showBalances);
  const pendingByCurrency = groupTransactionAmountsByCurrency(pendingTx, accountCurrencies, ["pending_approval", "needs_review"]);
  const pendingTotals = Object.entries(pendingByCurrency);
  const cashFlowUnavailable = transactions.length > 0 && !cashFlowCurrency;
  const primaryGoal = goals[0];
  const attentionAccount = accounts.find((account) =>
    (account.institution || account.name).toLowerCase().includes("gopay"),
  ) || accounts.find((account) => account.kind === "ewallet") || accounts[0];
  const recentTransactions = transactions.slice(0, 5);
  const idrExpenses = transactions.filter((transaction) => transaction.type === "expense" && transaction.account_id && accountCurrencies.get(transaction.account_id) === "IDR");
  const spendingByCategory = new Map<string, number>();
  idrExpenses.forEach((transaction) => {
    spendingByCategory.set(transaction.category, (spendingByCategory.get(transaction.category) ?? 0) + Number(transaction.amount));
  });
  const budgetProgress = budgets.map((budget) => ({
    ...budget,
    spent: spendingByCategory.get(budget.category) ?? 0,
  })).sort((left, right) => right.spent - left.spent).slice(0, 4);
  const totalBudget = budgets.reduce((sum, budget) => sum + Number(budget.limit_amount), 0);
  const totalBudgetSpent = [...spendingByCategory.values()].reduce((sum, amount) => sum + amount, 0);
  const budgetRemaining = Math.max(0, totalBudget - totalBudgetSpent);
  const budgetUsedPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalBudgetSpent / totalBudget) * 100)) : 0;
  const isCurrentMonth = selectedMonth.getFullYear() === new Date().getFullYear() && selectedMonth.getMonth() === new Date().getMonth();
  const elapsedDays = isCurrentMonth ? Math.min(new Date().getDate(), daysInMonth) : daysInMonth;
  const dailyAmounts = new Map<number, number>();
  idrExpenses.forEach((transaction) => {
    const day = parseISO(transaction.date).getDate();
    dailyAmounts.set(day, (dailyAmounts.get(day) ?? 0) + Number(transaction.amount));
  });
  const showSetupCard = onboardingEligibility !== undefined && shouldShowOnboardingResume({
    eligibility: onboardingEligibility,
    hasConfirmedTransaction: transactions.length > 0,
    dismissed: setupCardDismissed,
  });
  const completedSetupDataSteps = Number(Boolean(onboardingProgress?.accountId)) + Number(Boolean(onboardingProgress?.transactionId));

  const resumeSetup = () => {
    if (!onboardingProgress || !saveProgress) return;
    saveProgress({ ...onboardingProgress, deferredUntil: null });
    router.push("/onboarding");
  };

  const dismissSetupCard = () => {
    if (setupDismissKey) window.localStorage.setItem(setupDismissKey, "true");
    setSetupCardDismissed(true);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#e9f8ee_0px,#f7fbf8_340px,#f8faf9_100%)] pb-24 text-slate-900 md:pb-10">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="outline-none">
        <div className="relative mx-auto w-full px-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-5 md:hidden">
        <section aria-labelledby="mobile-dashboard-title">
          <p className="text-[13px] font-semibold text-emerald-700">{t("Selamat datang, {name}", { name: firstName })}</p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <h1 id="mobile-dashboard-title" className="text-[27px] font-extrabold leading-[1.1] tracking-[-0.045em] text-slate-900">{t("Keuanganmu")}</h1>
            <button onClick={toggleBalances} aria-label={t(showBalances ? "Sembunyikan nominal" : "Tampilkan nominal")} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-[0_3px_14px_rgba(23,35,59,0.04)] transition active:scale-95">
              {showBalances ? <Eye className="h-[19px] w-[19px]" /> : <EyeOff className="h-[19px] w-[19px]" />}
            </button>
          </div>
        </section>

        {loadError && (
          <div role="alert" className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{loadError}</span>
            <button onClick={() => void fetchDashboardData()} className="shrink-0 font-bold">{t("Coba lagi")}</button>
          </div>
        )}

        {loading ? (
          <MobileDashboardSkeleton />
        ) : (
          <>
            <section aria-labelledby="mobile-cash-flow-title" className="relative mt-3 overflow-hidden rounded-[var(--radius-surface)] border border-emerald-900/10 bg-[#173c32] p-4 text-white shadow-[var(--shadow-surface)]">
              <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full border-[28px] border-white/[0.07]" />
              <div className="pointer-events-none absolute -bottom-20 right-6 h-36 w-36 rounded-full bg-white/[0.06] blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between text-xs text-emerald-100/80">
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{format(selectedMonth, "MMMM yyyy", { locale: language === "en" ? enUS : id })}</span>
                  <span>{elapsedDays} {t("dari")} {daysInMonth} {t("hari")}</span>
                </div>
                {totalBudget > 0 ? (
                  <>
                    <p id="mobile-cash-flow-title" className="mt-3 text-sm font-medium text-emerald-50/90">{t("Sisa anggaran bulan ini")}</p>
                    <p className="mt-1 text-[29px] font-extrabold tracking-[-0.045em] text-white">{displayCurrency(budgetRemaining, "IDR")}</p>
                    <p className="mt-1.5 text-xs leading-5 text-emerald-100/80">{t("Dari anggaran")} {displayCurrency(totalBudget, "IDR")} {t("yang kamu atur.")}</p>
                    <div role="progressbar" aria-label={t("Anggaran terpakai")} aria-valuenow={budgetUsedPercentage} aria-valuemin={0} aria-valuemax={100} className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[var(--brand-lime)]" style={{ width: `${budgetUsedPercentage}%` }} /></div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-emerald-100/80"><span>{budgetUsedPercentage}% {t("terpakai")}</span><Link href="/planning" className="flex min-h-8 items-center gap-1 font-bold text-white">{t("Lihat budget")} <ArrowRight className="size-3.5" /></Link></div>
                  </>
                ) : (
                  <>
                    <p id="mobile-cash-flow-title" className="mt-3 text-base font-bold !text-white">{t("Belum ada anggaran bulan ini")}</p>
                    <p className="mt-1.5 text-xs leading-5 text-emerald-100/80">{t("Atur budget agar sisa pengeluaranmu bisa dipantau dari Beranda.")}</p>
                    <Link href="/planning" className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--brand-lime)] px-3 text-xs font-extrabold text-[var(--brand-ink)]">{t("Atur budget")} <ArrowRight className="size-3.5" /></Link>
                  </>
                )}
                {!cashFlowUnavailable && <div className="mt-3 grid grid-cols-2 gap-4 border-t border-white/15 pt-3"><div><p className="flex items-center gap-1 text-xs text-emerald-100/80"><ArrowDownLeft className="size-3.5" />{language === "en" ? "Income" : "Pemasukan"}</p><p className="mt-1 text-base font-bold">{displayCurrency(totalIncome, cashFlowCurrency)}</p></div><div><p className="flex items-center gap-1 text-xs text-emerald-100/80"><ArrowUpRight className="size-3.5" />{language === "en" ? "Expenses" : "Pengeluaran"}</p><p className="mt-1 text-base font-bold">{displayCurrency(totalExpense, cashFlowCurrency)}</p></div></div>}
              </div>
            </section>

            {pendingTotals.length > 0 && (
              <Link href="/transactions?status=review" className="mt-3 block rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
                <strong>{t("{count} transaksi perlu ditinjau", { count: pendingTx.length })}</strong>
                <span className="mt-1 block">{pendingTotals.map(([currency, amount]) => displayCurrency(amount, currency)).join(" · ")} · {t("semua waktu, belum masuk total terkonfirmasi")}</span>
              </Link>
            )}

            {showSetupCard && (
              <section className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-[#effaf4] px-3.5 py-3" aria-label={t("Progres penyiapan")}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><WalletCards className="h-[17px] w-[17px]" /></span>
                <button onClick={resumeSetup} className="min-w-0 flex-1 text-left">
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">{t("{count} dari 2 selesai", { count: completedSetupDataSteps })}</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-slate-700">{t("Lanjutkan penyiapan data keuanganmu")}</span>
                </button>
                <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700" />
                <button onClick={dismissSetupCard} aria-label={t("Tutup pengingat penyiapan")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
              </section>
            )}

            <MobileStreak journey={journey} />
            <section aria-labelledby="mobile-quick-actions-title" className="mt-5">
              <div className="flex items-center justify-between">
                <h2 id="mobile-quick-actions-title" className="text-sm font-extrabold tracking-[-0.02em] text-slate-900">{t("Rencanakan & pantau")}</h2>
                <Link href="/planning" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold leading-5 text-emerald-700">{t("Lihat semua")}<ArrowRight aria-hidden="true" className="size-3.5" /></Link>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <MobileShortcut href="/planning" icon={Goal} label={t("Budget")} />
                <MobileShortcut href="/goals" icon={Goal} label={t("Goals")} />
                <MobileShortcut href="/investments" icon={CircleDollarSign} label={t("Portofolio")} />
                <MobileShortcut href="/insights" icon={Sparkles} label={t("Analisis")} />
              </div>
            </section>

            <MobileBudgetProgress items={budgetProgress} displayCurrency={displayCurrency} />
            <MobileActivityCalendar month={selectedMonth} daysInMonth={daysInMonth} amounts={dailyAmounts} />

            <section aria-labelledby="mobile-activity-title" className="mt-5 overflow-hidden app-card">
              <CardHeader className="p-4" titleId="mobile-activity-title" title={t("Aktivitas terbaru")} subtitle={format(selectedMonth, "MMMM yyyy", { locale: language === "en" ? enUS : id })} action={{ href: "/transactions", label: t("Lihat semua") }} />
              {recentTransactions.length === 0 ? (
                <div className="border-t border-slate-100 px-5 py-8 text-center">
                  <ReceiptText className="mx-auto h-6 w-6 text-emerald-600" />
                  <p className="mt-2 text-xs font-bold text-slate-700">{t("Belum ada transaksi")}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{t("Catat transaksi pertama untuk melihat aktivitasmu.")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {recentTransactions.slice(0, 3).map((transaction) => (
                    <MobileActivity key={transaction.id} transaction={transaction} amount={displayCurrency(Number(transaction.amount), transaction.account_id ? accountCurrencies.get(transaction.account_id) : undefined)} />
                  ))}
                </div>
              )}
            </section>
            <MobileGoal goal={primaryGoal} displayCurrency={displayCurrency} />
          </>
        )}
        </div>

        <div className="mx-auto hidden w-full max-w-7xl px-4 py-7 sm:px-6 md:block md:py-10">
        <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              {t("Selamat datang, {name}", { name: firstName })} <Sparkles className="h-4 w-4" />
            </p>
            <h1 className="max-w-2xl text-3xl font-bold tracking-[-0.035em] text-slate-900 sm:text-4xl">
              {t("Kondisi keuangan bulan ini")}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">{format(today, "EEEE, dd MMMM yyyy", { locale: dateLocale })}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-12 items-center rounded-xl border border-emerald-100 bg-white p-1 shadow-sm">
              <button onClick={() => adjustMonth(-1)} aria-label={t("Bulan sebelumnya")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-32 px-2 text-center text-sm font-semibold text-slate-700">
                {format(selectedMonth, "MMMM yyyy", { locale: dateLocale })}
              </span>
              <button onClick={() => adjustMonth(1)} aria-label={t("Bulan berikutnya")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={toggleBalances} aria-label={t(showBalances ? "Sembunyikan nominal" : "Tampilkan nominal")} className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-white text-slate-500 shadow-sm hover:bg-emerald-50 hover:text-emerald-700">
              {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </section>

        {loadError && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{loadError}</span>
            <button onClick={() => void fetchDashboardData()} className="inline-flex items-center gap-2 self-start font-semibold hover:text-amber-700 sm:self-auto"><RefreshCw className="h-4 w-4" /> {t("Coba lagi")}</button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
          {showSetupCard && (
            <section className="mb-6 grid gap-5 app-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6" aria-labelledby="setup-card-title">
              <div className="flex min-w-0 gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{t("{count} dari 2 langkah data selesai", { count: completedSetupDataSteps })}</p>
                  <h2 id="setup-card-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900">{t("Selesaikan penyiapan FinTrack")}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{t("Tambahkan data berikutnya agar dashboard mulai menunjukkan kondisi keuanganmu.")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <Button className="flex-1 sm:flex-none" onClick={resumeSetup}>{t("Selesaikan penyiapan")} <ArrowRight className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={t("Sembunyikan pengingat penyiapan")} onClick={dismissSetupCard}><X className="h-4 w-4" /></Button>
              </div>
            </section>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section className="app-card p-5 sm:p-6">
                <div className="grid gap-7 md:grid-cols-[300px_minmax(0,1fr)] md:items-stretch">
                  <div className="flex flex-col justify-between">
                    <div>
                      <h2 className={`text-lg font-bold tracking-tight ${balance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {t(balance >= 0 ? "Arus kas aman" : "Arus kas perlu perhatian")}
                      </h2>
                      {cashFlowUnavailable ? (
                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{t("Ada lebih dari satu mata uang. Arus kas tidak dijumlahkan tanpa kurs.")}</p>
                      ) : (
                        <>
                          <p className={`mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-[2.5rem] ${balance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            {balance < 0 ? "-" : "+"}{displayCurrency(balance, cashFlowCurrency)}
                          </p>
                          <p className="mt-4 text-sm leading-6 text-slate-500">
                            {t(balance >= 0 ? "Pendapatan lebih besar dari pengeluaran. Pertahankan ritme keuangan yang sehat." : "Pengeluaran melewati pemasukan. Cek kembali pos terbesar bulan ini.")}
                          </p>
                        </>
                      )}
                    </div>
                    <Link href="/insights" className="mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                      <CircleDollarSign className="h-4 w-4" /> {t("Lihat ringkasan")}
                    </Link>
                  </div>

                  <div className="min-w-0">
                    <ul aria-label={t("Legenda arus kas")} className="mb-2 flex items-center gap-4 text-xs font-semibold text-slate-500">
                      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-emerald-600" />{t("Pendapatan")}</li>
                      <li className="flex items-center gap-2"><span aria-hidden="true" className="w-4 border-t-2 border-dashed border-rose-500" />{t("Pengeluaran")}</li>
                    </ul>
                    {transactions.length === 0 || cashFlowUnavailable ? (
                      <div className="flex h-40 flex-col items-center justify-center rounded-xl bg-emerald-50/55 px-6 text-center">
                        <CircleDollarSign className="mb-2 h-7 w-7 text-emerald-600" aria-hidden="true" />
                        <p className="font-semibold text-slate-800">{cashFlowUnavailable ? t("Arus kas lintas mata uang tidak tersedia") : t("Belum ada arus kas bulan ini")}</p>
                        <p className="mt-1 text-xs text-slate-500">{cashFlowUnavailable ? t("Pilih satu mata uang atau tambahkan kurs sebelum membandingkan nilai.") : t("Catat transaksi pertama agar polanya mulai terlihat.")}</p>
                      </div>
                    ) : (
                      <>
                        <figure aria-labelledby="cash-flow-chart-caption">
                          <figcaption id="cash-flow-chart-caption" className="sr-only">{t("Grafik akumulasi pendapatan dan pengeluaran bulan terpilih.")}</figcaption>
                          <div className="h-40 w-full" aria-hidden="true">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={cashFlowData} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} dy={10} />
                                <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => new Intl.NumberFormat(language === "en" ? "en-US" : "id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} />
                                <Tooltip
                                  cursor={{ stroke: "#d1fae5", strokeWidth: 1 }}
                                  contentStyle={{ borderRadius: 12, border: "1px solid #d1fae5", boxShadow: "0 8px 24px rgba(15,23,42,.08)", fontSize: 12 }}
                                  formatter={(value) => formatCurrency(Number(value || 0), cashFlowCurrency)}
                                />
                                <Line type="monotone" dataKey="income" name={t("Pemasukan")} stroke="#15803d" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: "#15803d", stroke: "#fff", strokeWidth: 2 }} />
                                <Line type="monotone" dataKey="expense" name={t("Pengeluaran")} stroke="#fb7185" strokeWidth={2.5} strokeDasharray="7 4" dot={false} activeDot={{ r: 4, fill: "#fb7185", stroke: "#fff", strokeWidth: 2 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </figure>
                        <details className="group mt-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                          <summary className="cursor-pointer text-xs font-semibold text-emerald-700 marker:text-emerald-700">{t("Lihat data tabel arus kas")}</summary>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[360px] text-left text-xs">
                              <caption className="sr-only">{t("Data akumulasi pendapatan dan pengeluaran bulan terpilih.")}</caption>
                              <thead className="border-b border-slate-200 text-[11px] uppercase tracking-[0.06em] text-slate-500">
                                <tr><th scope="col" className="pb-2 pr-4">{t("Tanggal")}</th><th scope="col" className="pb-2 pr-4 text-right">{t("Pendapatan")}</th><th scope="col" className="pb-2 text-right">{t("Pengeluaran")}</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {cashFlowData.map((point) => (
                                  <tr key={point.day}>
                                    <th scope="row" className="py-2 pr-4 font-semibold">{point.label}</th>
                                    <td className="py-2 pr-4 text-right font-medium">{displayCurrency(point.income, cashFlowCurrency)}</td>
                                    <td className="py-2 text-right font-medium">{displayCurrency(point.expense, cashFlowCurrency)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </>
                    )}
                    <div className="mt-5 grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 pt-4">
                      <CompactMetric icon={ArrowUpRight} label={t("Pendapatan")} value={cashFlowUnavailable ? "—" : displayCurrency(totalIncome, cashFlowCurrency)} detail={cashFlowUnavailable ? t("Tidak dijumlahkan lintas mata uang") : t("{count} transaksi masuk", { count: cashFlowTransactions.filter((item) => item.type === "income").length })} tone="emerald" />
                      <CompactMetric icon={ArrowDownRight} label={t("Pengeluaran")} value={cashFlowUnavailable ? "—" : displayCurrency(totalExpense, cashFlowCurrency)} detail={cashFlowUnavailable ? t("Tidak dijumlahkan lintas mata uang") : expenseChange === null ? t("Belum ada pembanding") : t("{change}% vs bulan lalu", { change: `${expenseChange > 0 ? "+" : ""}${expenseChange}` })} tone="rose" />
                    </div>
                  </div>
                </div>
              </section>

              <JourneySummary journey={journey} />
              <section className="overflow-hidden app-card">
                <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-6" title={t("Transaksi terbaru")} action={{ href: "/transactions", label: t("Lihat semua") }} />

                {recentTransactions.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <ReceiptText className="mx-auto h-8 w-8 text-emerald-600" />
                    <p className="mt-3 font-semibold text-slate-800">{t("Belum ada transaksi")}</p>
                    <p className="mt-1 text-sm text-slate-500">{t("Transaksi terbaru akan muncul di sini.")}</p>
                  </div>
                ) : (
                  <div>
                    <div className="hidden grid-cols-[110px_minmax(0,1.3fr)_minmax(120px,.8fr)_130px] gap-4 border-b border-slate-100 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:grid">
                      <span>{t("Tanggal")}</span><span>{t("Transaksi")}</span><span>{t("Kategori")}</span><span className="text-right">{t("Nominal")}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {recentTransactions.map((transaction) => (
                        <div key={transaction.id} className="grid gap-3 px-5 py-3 transition-colors hover:bg-emerald-50/40 sm:grid-cols-[110px_minmax(0,1.3fr)_minmax(120px,.8fr)_130px] sm:items-center sm:gap-4 sm:px-6">
                          <span className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarDays className="h-3.5 w-3.5 sm:hidden" />{format(parseISO(transaction.date), "dd MMM yyyy", { locale: dateLocale })}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{transaction.merchant || transaction.category}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">{transaction.note || t("Tanpa catatan")}</p>
                          </div>
                          <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{transaction.category}</span>
                          <span className={`text-sm font-bold sm:text-right ${transaction.type === "income" ? "text-emerald-700" : "text-slate-800"}`}>
                            {transaction.type === "income" ? "+" : "-"}{displayCurrency(Number(transaction.amount), transaction.account_id ? accountCurrencies.get(transaction.account_id) : undefined)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="app-card p-5 lg:sticky lg:top-24 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("Perlu perhatian")}</h2>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600"><AlertCircle className="h-5 w-5" /></span>
              </div>

              <div className="divide-y divide-slate-100 border-y border-slate-100">
                <AttentionRow
                  icon={pendingTx.length > 0 ? ReceiptText : CheckCircle2}
                  title={pendingTx.length > 0 ? t("{count} transaksi perlu ditinjau", { count: pendingTx.length }) : t("Semua transaksi sudah ditinjau")}
                  detail={pendingTx.length > 0 ? `${Object.entries(pendingByCurrency).map(([currency, amount]) => formatCurrency(amount, currency)).join(" · ")} · ${t("semua waktu, belum masuk total terkonfirmasi")}` : t("Tidak ada approval yang tertunda.")}
                  href="/transactions?status=review"
                  tone={pendingTx.length > 0 ? "amber" : "emerald"}
                />
                <AttentionRow
                  icon={WalletCards}
                  title={attentionAccount ? t("Cek saldo {name}", { name: attentionAccount.name }) : t("Tambahkan akun utama")}
                  detail={attentionAccount ? t("Terakhir diperbarui {date}.", { date: format(parseISO(attentionAccount.updated_at), "dd MMM", { locale: dateLocale }) }) : t("Satukan saldo bank dan e-wallet di FinTrack.")}
                  href="/accounts"
                  tone="blue"
                />
                <AttentionRow
                  icon={Goal}
                  title={primaryGoal ? primaryGoal.name : t("Buat target keuangan")}
                  detail={primaryGoal ? t("{percentage}% dari target {amount}{additional}.", { percentage: calculateGoalProgress(Number(primaryGoal.current_amount), Number(primaryGoal.target_amount)).percentage, amount: formatCurrency(Number(primaryGoal.target_amount), primaryGoal.currency), additional: goals.length > 1 ? ` · +${goals.length - 1} ${t("target")}` : "" }) : t("Mulai dari dana darurat atau tabungan tujuan.")}
                  href="/planning"
                  tone="emerald"
                >
                  {goals.map((goal) => {
                    const progress = calculateGoalProgress(Number(goal.current_amount), Number(goal.target_amount));
                    return <div key={goal.id} className="mt-3"><div className="flex justify-between gap-2 text-[11px] font-semibold text-slate-500"><span className="truncate">{goal.name}</span><span>{progress.percentage}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.percentage}%`, backgroundColor: goal.color ?? undefined }} /></div></div>;
                  })}
                </AttentionRow>
              </div>

              <Link href="/transactions" className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(21,128,61,0.18)] transition hover:bg-emerald-800 active:translate-y-px">
                <CircleDollarSign className="h-5 w-5" /> {t("Catat transaksi")}
              </Link>
              <p className="mt-3 text-center text-xs leading-5 text-slate-400">{t("Rata-rata selesai dalam kurang dari satu menit.")}</p>
            </aside>
          </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
}

function MobileShortcut({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex min-h-[82px] flex-col items-center justify-center gap-1.5 rounded-xl text-center text-[10px] font-extrabold text-slate-700 transition active:scale-95">
      <span className="grid size-[52px] place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="size-[22px]" strokeWidth={1.7} /></span>
      <span className="max-w-full truncate px-0.5">{label}</span>
    </Link>
  );
}

function MobileStreak({ journey }: { journey: ReturnType<typeof useFinancialJourney> }) {
  const { data, error, dailySaving, loading, completeDailyReview } = journey;
  const { language, t } = useLanguage();
  if (!data || error) return null;

  return (
    <section aria-label={t("Streak review harian")} className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-orange-100 text-orange-600"><Flame aria-hidden="true" className="size-[18px]" /></span><div><h2 className="text-sm font-bold text-slate-800">{t("Jaga ritmemu")}</h2><p className="text-[11px] text-slate-600">{t("{count} hari berturut-turut", { count: data.streak.current })}</p></div></div>
        <span className="text-[11px] font-semibold text-slate-500">{t("Rekor: {count} hari", { count: data.streak.longest })}</span>
      </div>
      <div aria-label={t("Riwayat tujuh hari terakhir")} className="mt-2.5 grid grid-cols-7 gap-1.5">{data.streak.days.map((day, index) => {
        const completed = day.completed;
        const today = index === data.streak.days.length - 1;
        const weekday = format(parseISO(day.date), "EEEEE", { locale: language === "en" ? enUS : id });
        const dayNumber = format(parseISO(day.date), "d", { locale: language === "en" ? enUS : id });
        return <button type="button" key={day.date} disabled={!today || completed || dailySaving || loading} onClick={() => void completeDailyReview()} aria-label={t("{weekday}, {day}: {status}{today}", { weekday, day: dayNumber, status: t(completed ? "sudah review" : "belum review"), today: today ? `, ${t("hari ini")}` : "" })} className="flex min-h-[50px] flex-col items-center justify-start text-[10px] font-bold disabled:cursor-default"><span className="mb-1 text-[9px] font-semibold text-slate-500">{weekday}</span><span className={`grid size-8 place-items-center rounded-full ${completed ? "bg-orange-600 text-white shadow-[0_4px_10px_rgba(234,88,12,0.22)]" : today ? "border-2 border-orange-500 bg-white text-orange-700 shadow-[0_3px_8px_rgba(234,88,12,0.12)]" : "bg-orange-100 text-orange-300"}`}>{completed ? <Flame aria-hidden="true" size={15} fill="currentColor" /> : dayNumber}</span></button>;
      })}</div>
    </section>
  );
}

function MobileBudgetProgress({ items, displayCurrency }: { items: Array<FinancialBudget & { spent: number }>; displayCurrency: (amount: number, currency?: string | null) => string }) {
  const { t } = useLanguage();
  return (
    <section className="mt-5 overflow-hidden app-card p-4" aria-labelledby="mobile-budget-progress-title">
      <CardHeader titleId="mobile-budget-progress-title" title={t("Progres pengeluaran")} subtitle={t("Berdasarkan budget yang kamu atur")} action={{ href: "/planning", label: t("Lihat detail") }} />
      {items.length === 0 ? <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-900">{t("Belum ada budget bulan ini.")} <Link href="/planning" className="font-bold underline underline-offset-2">{t("Atur budget")}</Link> {t("agar pengeluaranmu lebih mudah dipantau.")}</div> : <div className="mt-4 space-y-4">{items.map((item, index) => {
        const percentage = Math.min(100, Math.round((item.spent / Number(item.limit_amount)) * 100));
        const tone = index === 0 ? "bg-violet-400" : index === 1 ? "bg-orange-400" : "bg-sky-400";
        return <Link href="/planning" key={item.id} className="block"><div className="flex justify-between gap-2 text-xs"><strong className="truncate text-slate-800">{item.category}</strong><strong>{displayCurrency(item.spent, "IDR")}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} /></div><p className="mt-1 text-right text-[10px] text-slate-500">{t("{percentage}% dari {amount}", { percentage, amount: displayCurrency(Number(item.limit_amount), "IDR") })}</p></Link>;
      })}</div>}
    </section>
  );
}

function MobileActivityCalendar({ month, daysInMonth, amounts }: { month: Date; daysInMonth: number; amounts: Map<number, number> }) {
  const { language, t } = useLanguage();
  const leadingBlanks = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const formatShort = (amount: number) => amount >= 1_000_000 ? `-${(amount / 1_000_000).toFixed(1)}JT` : `-${Math.round(amount / 1_000)}K`;
  return (
    <section className="mt-5 overflow-hidden app-card p-4" aria-labelledby="mobile-calendar-title">
      <CardHeader titleId="mobile-calendar-title" title={t("Aktivitas bulan ini")} subtitle={format(month, "MMMM yyyy", { locale: language === "en" ? enUS : id })} action={{ href: "/transactions", label: t("Lihat semua") }} />
      <div className="mt-4 grid grid-cols-7 gap-y-2 text-center">{(language === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"]).map((day) => <span key={day} className="text-[9px] font-bold text-slate-400">{day}</span>)}{Array.from({ length: leadingBlanks }).map((_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }).map((_, index) => {
        const day = index + 1;
        const amount = amounts.get(day);
        return <Link href={amount ? "/transactions" : "/transactions?new=1"} key={day} aria-label={t("{day} {month}{amount}", { day, month: format(month, "MMMM", { locale: language === "en" ? enUS : id }), amount: amount ? `, ${t("pengeluaran")} ${formatShort(amount)}` : "" })} className={`relative mx-auto grid size-[34px] place-items-center rounded-lg text-[10px] font-semibold ${amount ? "bg-emerald-50 text-emerald-800" : "text-slate-500"}`}><span className="self-start pt-1">{day}</span>{amount && <span className="absolute bottom-0.5 text-[7px] font-bold text-rose-500">{formatShort(amount)}</span>}</Link>;
      })}</div>
    </section>
  );
}

function MobileGoal({ goal, displayCurrency }: { goal: FinancialGoal | undefined; displayCurrency: (amount: number, currency?: string | null) => string }) {
  const { t } = useLanguage();
  if (!goal) return <Link href="/planning" className="mt-5 block app-card p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">{t("Mulai dari tujuanmu")}</p><h2 className="mt-1 text-base font-extrabold">{t("Buat goal keuangan")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("Dana darurat atau tabungan tujuanmu bisa dipantau dari sini.")}</p></Link>;
  const progress = calculateGoalProgress(Number(goal.current_amount), Number(goal.target_amount));
  return <Link href="/goals" className="mt-5 block app-card p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">{t("Goal terdekat")}</p><h2 className="mt-1 text-base font-extrabold">{goal.name}</h2></div><span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{t("Lihat goals")}</span></div><div className="mt-4 flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-xl">🎯</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2 text-xs font-semibold"><span>{displayCurrency(Number(goal.current_amount), goal.currency)}</span><span className="text-slate-500">{progress.percentage}%</span></span><span className="mt-2 block h-2 overflow-hidden rounded-full bg-emerald-100"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${progress.percentage}%`, backgroundColor: goal.color ?? undefined }} /></span><span className="mt-2 block text-[11px] text-slate-500">{t("Menuju target {amount}.", { amount: displayCurrency(Number(goal.target_amount), goal.currency) })}</span></span></div></Link>;
}

function MobileActivity({ transaction, amount }: { transaction: Transaction; amount: string }) {
  const { language } = useLanguage();
  const income = transaction.type === "income";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${income ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
        {income ? <ArrowDownRight className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-700">{transaction.merchant || transaction.category}</p>
        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{transaction.category} · {format(parseISO(transaction.date), "dd MMM", { locale: language === "en" ? enUS : id })}</p>
      </div>
      <p className={`text-xs font-extrabold ${income ? "text-emerald-700" : "text-slate-700"}`}>{income ? "+" : "-"}{amount}</p>
    </div>
  );
}

function MobileDashboardSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="mt-4 animate-pulse" aria-label={t("Memuat dashboard mobile")}>
      <div className="h-[229px] rounded-[var(--radius-surface)] bg-emerald-950/15" />
      <div className="mt-3 h-[66px] rounded-2xl bg-emerald-100/70" />
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="h-12 rounded-2xl bg-emerald-200/70" />
        <div className="h-12 rounded-2xl bg-white/80" />
      </div>
      <span className="sr-only"><Loader2 className="h-4 w-4" /> {t("Memuat data keuangan")}</span>
    </div>
  );
}

function CompactMetric({ icon: Icon, label, value, detail, tone }: {
  icon: typeof ArrowUpRight;
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "rose";
}) {
  const tones = {
    emerald: "text-emerald-700",
    rose: "text-rose-600",
  };

  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon className={`h-3.5 w-3.5 ${tones[tone]}`} />{label}
      </div>
      <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">{value}</p>
      <p className={`mt-1 text-[11px] font-medium ${tones[tone]}`}>{detail}</p>
    </div>
  );
}

function AttentionRow({ icon: Icon, title, detail, href, tone, children }: {
  icon: typeof ReceiptText;
  title: string;
  detail: string;
  href: string;
  tone: "amber" | "emerald" | "blue";
  children?: ReactNode;
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
  };

  return (
    <Link href={href} className="group grid grid-cols-[40px_minmax(0,1fr)_20px] gap-3 py-5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-5 text-slate-800 group-hover:text-emerald-800">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
        {children}
      </span>
      <ChevronRight className="mt-1 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
    </Link>
  );
}

function DashboardSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-label={t("Memuat dashboard")}>
      <div className="space-y-6">
        <div className="h-[470px] rounded-2xl border border-emerald-100 bg-white/80" />
        <div className="h-80 rounded-2xl border border-emerald-100 bg-white/80" />
      </div>
      <div className="h-[470px] rounded-2xl border border-emerald-100 bg-white/80" />
      <span className="sr-only"><Loader2 className="h-4 w-4" /> {t("Memuat data keuangan")}</span>
    </div>
  );
}
