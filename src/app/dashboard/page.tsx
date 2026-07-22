"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, getDaysInMonth, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { enUS, id } from "date-fns/locale";
import {
  AlertCircle,
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
import { useOnboarding } from "@/components/OnboardingBoundary";
import { Button } from "@/components/ui/Button";
import { calculatePercentageChange } from "@/lib/analytics";
import {
  buildCumulativeCashFlowSeries,
  calculateGoalProgress,
  maskAmount,
} from "@/lib/home";
import { normalizeClientError } from "@/lib/errors";
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
  color: string | null;
  due_date: string | null;
};

const formatIdr = (amount: number) => `Rp${Math.abs(amount).toLocaleString("id-ID")}`;

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
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : id;
  const router = useRouter();
  const { eligibility: onboardingEligibility, progress: onboardingProgress, saveProgress } = useOnboarding();
  const [today] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTx, setPendingTx] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [firstName, setFirstName] = useState("Kamu");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [previousMonthExpense, setPreviousMonthExpense] = useState(0);
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

        const [txResult, previousResult, pendingResult, accountResult, goalResult] = await Promise.all([
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
            .select("type, amount")
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
            .select("id, name, target_amount, current_amount, color, due_date")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (txResult.error) throw txResult.error;
        if (previousResult.error) throw previousResult.error;
        if (pendingResult.error) throw pendingResult.error;
        if (accountResult.error) throw accountResult.error;

        setTransactions((txResult.data || []) as Transaction[]);
        setPreviousMonthExpense((previousResult.data || []).reduce(
          (sum, transaction) => sum + Number(transaction.amount),
          0,
        ));
        setPendingTx((pendingResult.data || []) as Transaction[]);
        setAccounts((accountResult.data || []) as FinancialAccount[]);

        if (goalResult.error) {
          if (goalResult.error.code !== "42P01" && goalResult.error.code !== "PGRST205") throw goalResult.error;
          setGoals([]);
        } else {
          setGoals((goalResult.data || []) as FinancialGoal[]);
        }
      })(), 12_000);
    } catch (error) {
      const normalizedError = normalizeClientError(error, "Data dashboard belum bisa dimuat.");
      console.warn("Dashboard data unavailable:", normalizedError);
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

  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalExpense = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const balance = totalIncome - totalExpense;
  const expenseChange = calculatePercentageChange(totalExpense, previousMonthExpense);
  const daysInMonth = getDaysInMonth(selectedMonth);
  const sampleDays = [...new Set([1, 7, 13, 19, 25, daysInMonth])].filter((day) => day <= daysInMonth);
  const cashFlowData = buildCumulativeCashFlowSeries(
    transactions.map(({ date, type, amount }) => ({ date, type, amount: Number(amount) })),
    sampleDays,
    format(selectedMonth, "MMM", { locale: id }),
  );
  const displayIdr = (amount: number) => maskAmount(formatIdr(amount), showBalances);
  const primaryGoal = goals[0];
  const goalProgress = primaryGoal
    ? calculateGoalProgress(Number(primaryGoal.current_amount), Number(primaryGoal.target_amount))
    : null;
  const attentionAccount = accounts.find((account) =>
    (account.institution || account.name).toLowerCase().includes("gopay"),
  ) || accounts.find((account) => account.kind === "ewallet") || accounts[0];
  const recentTransactions = transactions.slice(0, 5);
  const showSetupCard = shouldShowOnboardingResume({
    eligibility: onboardingEligibility,
    hasConfirmedTransaction: transactions.length > 0,
    dismissed: setupCardDismissed,
  });
  const completedSetupDataSteps = Number(Boolean(onboardingProgress?.accountId)) + Number(Boolean(onboardingProgress?.transactionId));

  const resumeSetup = () => {
    if (!onboardingProgress) return;
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

      <main className="relative mx-auto w-full px-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-5 md:hidden">
        <section aria-labelledby="mobile-dashboard-title">
          <p className="text-[13px] font-semibold text-emerald-700">{t("Selamat datang, {name}", { name: firstName })}</p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <div>
              <h1 id="mobile-dashboard-title" className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.045em] text-slate-900">{t("Keuanganmu")}</h1>
              <p className="mt-1 text-xs font-medium text-slate-500">{format(today, "EEEE, dd MMMM yyyy", { locale: dateLocale })}</p>
            </div>
            {!loading && (
              <span className={`mb-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${balance >= 0 ? "bg-emerald-100/80 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                <Sparkles className="h-3 w-3" /> {t(balance >= 0 ? "Terkendali" : "Perlu dicek")}
              </span>
            )}
          </div>
        </section>

        <section aria-label="Pilih periode" className="mt-4 flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center justify-between rounded-xl border border-emerald-900/[0.08] bg-white/90 px-1 shadow-[0_3px_14px_rgba(23,35,59,0.04)]">
            <button onClick={() => adjustMonth(-1)} aria-label="Bulan sebelumnya" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 active:scale-95">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-700">{format(selectedMonth, "MMMM yyyy", { locale: dateLocale })}</span>
            <button onClick={() => adjustMonth(1)} aria-label="Bulan berikutnya" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 active:scale-95">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={toggleBalances} aria-label={showBalances ? "Sembunyikan nominal" : "Tampilkan nominal"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-900/[0.08] bg-white text-slate-500 shadow-[0_3px_14px_rgba(23,35,59,0.04)] transition active:scale-95">
            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
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
            <section aria-labelledby="mobile-cash-flow-title" className={`relative mt-4 overflow-hidden rounded-[24px] px-5 py-5 text-white shadow-[0_18px_36px_rgba(23,60,50,0.20)] ${balance >= 0 ? "bg-[#173c32]" : "bg-[#542a32]"}`}>
              <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full border-[28px] border-white/[0.07]" />
              <div className="pointer-events-none absolute -bottom-20 right-6 h-36 w-36 rounded-full bg-white/[0.06] blur-2xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p id="mobile-cash-flow-title" className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-100/70">{t("Arus kas bulan ini")}</p>
                    <p className="mt-2 text-[29px] font-extrabold tracking-[-0.05em] text-[#ffffff]">{balance < 0 ? "-" : "+"}{displayIdr(balance)}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-emerald-50">
                    {t(balance >= 0 ? "Arus kas aman" : "Butuh perhatian")}
                  </span>
                </div>
                <p className="mt-1.5 max-w-[285px] text-xs leading-5 text-emerald-50/65">
                  {t(balance >= 0 ? "Pendapatan masih lebih besar dari pengeluaran. Pertahankan ritmemu." : "Pengeluaran melewati pemasukan. Cek kembali pos terbesar bulan ini.")}
                </p>
                <div className="mt-5 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-4">
                  <MobileMetric icon={ArrowDownRight} label={language === "en" ? "Income" : "Masuk"} value={displayIdr(totalIncome)} />
                  <MobileMetric icon={ArrowUpRight} label={language === "en" ? "Expenses" : "Keluar"} value={displayIdr(totalExpense)} right />
                </div>
              </div>
            </section>

            {showSetupCard && (
              <section className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-[#effaf4] px-3.5 py-3" aria-label="Progres penyiapan">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><WalletCards className="h-[17px] w-[17px]" /></span>
                <button onClick={resumeSetup} className="min-w-0 flex-1 text-left">
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">{completedSetupDataSteps} dari 2 selesai</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-slate-700">Lanjutkan penyiapan data keuanganmu</span>
                </button>
                <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700" />
                <button onClick={dismissSetupCard} aria-label="Tutup pengingat penyiapan" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
              </section>
            )}

            <section aria-labelledby="mobile-quick-actions-title" className="mt-5">
              <div className="flex items-center justify-between">
                <h2 id="mobile-quick-actions-title" className="text-sm font-extrabold tracking-[-0.02em] text-slate-900">{t("Aksi cepat")}</h2>
                <Link href="/insights" className="text-[11px] font-bold text-emerald-700">{t("Lihat insights")}</Link>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <Link href="/transactions" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(5,150,105,0.18)] transition active:translate-y-px">
                  <CircleDollarSign className="h-4 w-4" /> {t("Catat transaksi")}
                </Link>
                <Link href="/accounts" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-900/[0.08] bg-white px-4 text-xs font-extrabold text-slate-700 shadow-[0_3px_14px_rgba(23,35,59,0.04)] transition active:translate-y-px">
                  <WalletCards className="h-4 w-4 text-emerald-700" /> {t("Lihat akun")}
                </Link>
              </div>
            </section>

            <section aria-labelledby="mobile-activity-title" className="mt-5 overflow-hidden rounded-[20px] border border-emerald-900/[0.07] bg-white shadow-[0_8px_24px_rgba(23,35,59,0.045)]">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("Bulan ini")}</p>
                  <h2 id="mobile-activity-title" className="mt-0.5 text-sm font-extrabold text-slate-900">{t("Aktivitas terbaru")}</h2>
                </div>
                <Link href="/transactions" className="text-[11px] font-bold text-emerald-700">{t("Semua")}</Link>
              </div>
              {recentTransactions.length === 0 ? (
                <div className="border-t border-slate-100 px-5 py-8 text-center">
                  <ReceiptText className="mx-auto h-6 w-6 text-emerald-600" />
                  <p className="mt-2 text-xs font-bold text-slate-700">{t("Belum ada transaksi")}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{t("Catat transaksi pertama untuk melihat aktivitasmu.")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {recentTransactions.slice(0, 2).map((transaction) => (
                    <MobileActivity key={transaction.id} transaction={transaction} amount={displayIdr(Number(transaction.amount))} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <main className="mx-auto hidden w-full max-w-7xl px-4 py-7 sm:px-6 md:block md:py-10">
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
              <button onClick={() => adjustMonth(-1)} aria-label="Bulan sebelumnya" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-32 px-2 text-center text-sm font-semibold text-slate-700">
                {format(selectedMonth, "MMMM yyyy", { locale: dateLocale })}
              </span>
              <button onClick={() => adjustMonth(1)} aria-label="Bulan berikutnya" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={toggleBalances} aria-label={showBalances ? "Sembunyikan nominal" : "Tampilkan nominal"} className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-white text-slate-500 shadow-sm hover:bg-emerald-50 hover:text-emerald-700">
              {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </section>

        {loadError && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{loadError}</span>
            <button onClick={() => void fetchDashboardData()} className="inline-flex items-center gap-2 self-start font-semibold hover:text-amber-700 sm:self-auto"><RefreshCw className="h-4 w-4" /> Coba lagi</button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
          {showSetupCard && (
            <section className="mb-6 grid gap-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-[0_10px_35px_rgba(22,101,52,0.07)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6" aria-labelledby="setup-card-title">
              <div className="flex min-w-0 gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{completedSetupDataSteps} dari 2 langkah data selesai</p>
                  <h2 id="setup-card-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900">Selesaikan penyiapan FinTrack</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Tambahkan data berikutnya agar dashboard mulai menunjukkan kondisi keuanganmu.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <Button className="flex-1 sm:flex-none" onClick={resumeSetup}>Selesaikan penyiapan <ArrowRight className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Sembunyikan pengingat penyiapan" onClick={dismissSetupCard}><X className="h-4 w-4" /></Button>
              </div>
            </section>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_35px_rgba(22,101,52,0.07)] sm:p-7">
                <div className="grid gap-7 md:grid-cols-[300px_minmax(0,1fr)] md:items-stretch">
                  <div className="flex flex-col justify-between">
                    <div>
                      <h2 className={`text-lg font-bold tracking-tight ${balance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {t(balance >= 0 ? "Arus kas aman" : "Arus kas perlu perhatian")}
                      </h2>
                      <p className={`mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-[2.5rem] ${balance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {balance < 0 ? "-" : "+"}{displayIdr(balance)}
                      </p>
                      <p className="mt-4 text-sm leading-6 text-slate-500">
                        {t(balance >= 0 ? "Pendapatan lebih besar dari pengeluaran. Pertahankan ritme keuangan yang sehat." : "Pengeluaran melewati pemasukan. Cek kembali pos terbesar bulan ini.")}
                      </p>
                    </div>
                    <Link href="/insights" className="mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                      <CircleDollarSign className="h-4 w-4" /> {t("Lihat ringkasan")}
                    </Link>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-4 text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-600" />Pendapatan</span>
                      <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rose-500" />Pengeluaran</span>
                    </div>
                    {transactions.length === 0 ? (
                      <div className="flex h-40 flex-col items-center justify-center rounded-xl bg-emerald-50/55 px-6 text-center">
                        <CircleDollarSign className="mb-2 h-7 w-7 text-emerald-600" />
                        <p className="font-semibold text-slate-800">Belum ada arus kas bulan ini</p>
                        <p className="mt-1 text-xs text-slate-500">Catat transaksi pertama agar polanya mulai terlihat.</p>
                      </div>
                    ) : (
                    <div className="h-40 w-full" aria-label="Grafik arus kas bulanan">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cashFlowData} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} dy={10} />
                          <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}jt`} />
                          <Tooltip
                            cursor={{ stroke: "#d1fae5", strokeWidth: 1 }}
                            contentStyle={{ borderRadius: 12, border: "1px solid #d1fae5", boxShadow: "0 8px 24px rgba(15,23,42,.08)", fontSize: 12 }}
                            formatter={(value) => formatIdr(Number(value || 0))}
                          />
                          <Line type="monotone" dataKey="income" name="Pemasukan" stroke="#15803d" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: "#15803d", stroke: "#fff", strokeWidth: 2 }} />
                          <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke="#fb7185" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#fb7185", stroke: "#fff", strokeWidth: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                    <div className="mt-5 grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 pt-4">
                      <CompactMetric icon={ArrowUpRight} label="Pendapatan" value={displayIdr(totalIncome)} detail={`${transactions.filter((item) => item.type === "income").length} transaksi masuk`} tone="emerald" />
                      <CompactMetric icon={ArrowDownRight} label="Pengeluaran" value={displayIdr(totalExpense)} detail={expenseChange === null ? "Belum ada pembanding" : `${expenseChange > 0 ? "+" : ""}${expenseChange}% vs bulan lalu`} tone="rose" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_8px_28px_rgba(22,101,52,0.05)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">{t("Transaksi terbaru")}</h2>
                  </div>
                  <Link href="/transactions" className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                    {t("Lihat semua")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {recentTransactions.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <ReceiptText className="mx-auto h-8 w-8 text-emerald-600" />
                    <p className="mt-3 font-semibold text-slate-800">Belum ada transaksi</p>
                    <p className="mt-1 text-sm text-slate-500">Transaksi terbaru akan muncul di sini.</p>
                  </div>
                ) : (
                  <div>
                    <div className="hidden grid-cols-[110px_minmax(0,1.3fr)_minmax(120px,.8fr)_130px] gap-4 border-b border-slate-100 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:grid">
                      <span>Tanggal</span><span>Transaksi</span><span>Kategori</span><span className="text-right">Nominal</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {recentTransactions.map((transaction) => (
                        <div key={transaction.id} className="grid gap-3 px-5 py-3 transition-colors hover:bg-emerald-50/40 sm:grid-cols-[110px_minmax(0,1.3fr)_minmax(120px,.8fr)_130px] sm:items-center sm:gap-4 sm:px-6">
                          <span className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarDays className="h-3.5 w-3.5 sm:hidden" />{format(parseISO(transaction.date), "dd MMM yyyy", { locale: id })}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{transaction.merchant || transaction.category}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">{transaction.note || "Tanpa catatan"}</p>
                          </div>
                          <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{transaction.category}</span>
                          <span className={`text-sm font-bold sm:text-right ${transaction.type === "income" ? "text-emerald-700" : "text-slate-800"}`}>
                            {transaction.type === "income" ? "+" : "-"}{displayIdr(Number(transaction.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_35px_rgba(22,101,52,0.07)] lg:sticky lg:top-24 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">Perlu perhatian</h2>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600"><AlertCircle className="h-5 w-5" /></span>
              </div>

              <div className="divide-y divide-slate-100 border-y border-slate-100">
                <AttentionRow
                  icon={pendingTx.length > 0 ? ReceiptText : CheckCircle2}
                  title={pendingTx.length > 0 ? `${pendingTx.length} transaksi perlu ditinjau` : "Semua transaksi sudah ditinjau"}
                  detail={pendingTx.length > 0 ? "Pastikan kategori dan nominalnya benar." : "Tidak ada approval yang tertunda."}
                  href="/transactions"
                  tone={pendingTx.length > 0 ? "amber" : "emerald"}
                />
                <AttentionRow
                  icon={WalletCards}
                  title={attentionAccount ? `Cek saldo ${attentionAccount.name}` : "Tambahkan akun utama"}
                  detail={attentionAccount ? `Terakhir diperbarui ${format(parseISO(attentionAccount.updated_at), "dd MMM", { locale: id })}.` : "Satukan saldo bank dan e-wallet di FinTrack."}
                  href="/accounts"
                  tone="blue"
                />
                <AttentionRow
                  icon={Goal}
                  title={primaryGoal ? primaryGoal.name : "Buat target keuangan"}
                  detail={primaryGoal ? `${goalProgress?.percentage || 0}% dari target ${formatIdr(Number(primaryGoal.target_amount))}.` : "Mulai dari dana darurat atau tabungan tujuan."}
                  href="/accounts"
                  tone="emerald"
                >
                  {goalProgress && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${goalProgress.percentage}%` }} />
                    </div>
                  )}
                </AttentionRow>
              </div>

              <Link href="/transactions" className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(21,128,61,0.18)] transition hover:bg-emerald-800 active:translate-y-px">
                <CircleDollarSign className="h-5 w-5" /> Catat transaksi
              </Link>
              <p className="mt-3 text-center text-xs leading-5 text-slate-400">Rata-rata selesai dalam kurang dari satu menit.</p>
            </aside>
          </div>
          </>
        )}
      </main>
    </div>
  );
}

function MobileMetric({ icon: Icon, label, value, right = false }: {
  icon: typeof ArrowDownRight;
  label: string;
  value: string;
  right?: boolean;
}) {
  return (
    <div className={right ? "pl-4" : "pr-4"}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-100/60"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 text-[13px] font-extrabold tracking-[-0.02em] text-emerald-50">{value}</p>
    </div>
  );
}

function MobileActivity({ transaction, amount }: { transaction: Transaction; amount: string }) {
  const income = transaction.type === "income";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${income ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
        {income ? <ArrowDownRight className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-700">{transaction.merchant || transaction.category}</p>
        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{transaction.category} · {format(parseISO(transaction.date), "dd MMM", { locale: id })}</p>
      </div>
      <p className={`text-xs font-extrabold ${income ? "text-emerald-700" : "text-slate-700"}`}>{income ? "+" : "-"}{amount}</p>
    </div>
  );
}

function MobileDashboardSkeleton() {
  return (
    <div className="mt-4 animate-pulse" aria-label="Memuat dashboard mobile">
      <div className="h-[229px] rounded-[24px] bg-emerald-950/15" />
      <div className="mt-3 h-[66px] rounded-2xl bg-emerald-100/70" />
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="h-12 rounded-2xl bg-emerald-200/70" />
        <div className="h-12 rounded-2xl bg-white/80" />
      </div>
      <span className="sr-only"><Loader2 className="h-4 w-4" /> Memuat data keuangan</span>
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
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-label="Memuat dashboard">
      <div className="space-y-6">
        <div className="h-[470px] rounded-2xl border border-emerald-100 bg-white/80" />
        <div className="h-80 rounded-2xl border border-emerald-100 bg-white/80" />
      </div>
      <div className="h-[470px] rounded-2xl border border-emerald-100 bg-white/80" />
      <span className="sr-only"><Loader2 className="h-4 w-4" /> Memuat data keuangan</span>
    </div>
  );
}
