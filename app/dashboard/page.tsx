"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { calculateIdrNetWorth, type FinancialAccountKind } from "@/lib/ledger";
import {
  calculateAccountMonthlyMovement,
  calculateGoalProgress,
  getInstitutionPresentation,
  getTimeGreeting,
  maskAmount,
} from "@/lib/home";
import { calculatePercentageChange } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Check, 
  X, 
  Edit3, 
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  Loader2,
  Download,
  Sparkles,
  ChartNoAxesCombined,
  Landmark,
  Plus,
  Target,
  Clock3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip
} from "recharts";

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
};

type FinancialGoal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string | null;
  due_date: string | null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTx, setPendingTx] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [previousMonthExpense, setPreviousMonthExpense] = useState(0);
  const [firstName, setFirstName] = useState("Kamu");
  const [showBalances, setShowBalances] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("fintrack-show-balances") !== "false";
  });
  
  // PWA Install Prompt States
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // States for Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    merchant: "",
    category: "",
    amount: 0,
    note: "",
    type: "expense" as "income" | "expense",
  });
  
  const categoriesList = [
    "Makanan & Minuman",
    "Transportasi",
    "Belanja Harian",
    "Tagihan",
    "Hiburan",
    "Kesehatan",
    "Pendidikan",
    "Rumah",
    "Pekerjaan",
    "Gaji",
    "Freelance",
    "Lainnya"
  ];

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Kamu";
      setFirstName(String(displayName).split(" ")[0]);

      const start = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .neq("status", "pending_approval")
        .neq("status", "needs_review")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (txError) throw txError;
      setTransactions(txData || []);

      const previousMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
      const { data: previousTxData, error: previousTxError } = await supabase
        .from("transactions")
        .select("type, amount")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .neq("status", "deleted")
        .neq("status", "pending_approval")
        .neq("status", "needs_review")
        .gte("date", format(startOfMonth(previousMonth), "yyyy-MM-dd"))
        .lte("date", format(endOfMonth(previousMonth), "yyyy-MM-dd"));
      if (previousTxError) throw previousTxError;
      setPreviousMonthExpense((previousTxData || []).reduce((sum, transaction) => sum + Number(transaction.amount), 0));

      const { data: pendData, error: pendError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending_approval", "needs_review"])
        .order("created_at", { ascending: false });

      if (pendError) throw pendError;
      setPendingTx(pendData || []);

      const { data: accountData, error: accountError } = await supabase
        .from("financial_accounts")
        .select("id, name, institution, kind, currency, current_balance, reporting_balance_idr, is_active")
        .eq("user_id", user.id)
        .order("name");

      if (accountError) throw accountError;
      setAccounts((accountData || []) as FinancialAccount[]);

      const { data: goalData, error: goalError } = await supabase
        .from("financial_goals")
        .select("id, name, target_amount, current_amount, color, due_date")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (goalError) {
        // The migration can be applied independently on existing Supabase projects.
        if (goalError.code !== "42P01" && goalError.code !== "PGRST205") console.warn("Goals are unavailable:", goalError.message);
      } else {
        setGoals((goalData || []) as FinancialGoal[]);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
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

  const toggleBalances = () => {
    setShowBalances((current) => {
      const next = !current;
      window.localStorage.setItem("fintrack-show-balances", String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "confirmed" })
        .eq("id", id);
      
      if (error) throw error;
      
      setPendingTx(prev => prev.filter(t => t.id !== id));
      fetchDashboardData();
    } catch {
      alert("Gagal menyetujui transaksi");
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus/menolak transaksi ini?")) return;
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "deleted" })
        .eq("id", id);

      if (error) throw error;

      setPendingTx(prev => prev.filter(t => t.id !== id));
      fetchDashboardData();
    } catch {
      alert("Gagal menolak transaksi");
    }
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditForm({
      merchant: tx.merchant || "",
      category: tx.category,
      amount: tx.amount,
      note: tx.note || "",
      type: tx.type,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          merchant: editForm.merchant || null,
          category: editForm.category,
          amount: Number(editForm.amount),
          note: editForm.note || null,
          type: editForm.type,
          status: "confirmed"
        })
        .eq("id", editingTx.id);

      if (error) throw error;

      setEditModalOpen(false);
      setEditingTx(null);
      fetchDashboardData();
    } catch {
      alert("Gagal memperbarui transaksi");
    }
  };

  // Computations
  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;
  const expenseChange = calculatePercentageChange(totalExpense, previousMonthExpense);
  const accountMonthlyMovement = calculateAccountMonthlyMovement(
    transactions.map((transaction) => ({
      accountId: transaction.account_id,
      type: transaction.type,
      amount: Number(transaction.amount),
    })),
  );
  const formatIdr = (amount: number) => `Rp${Math.abs(amount).toLocaleString("id-ID")}`;
  const displayIdr = (amount: number) => maskAmount(formatIdr(amount), showBalances);
  const netWorth = calculateIdrNetWorth(
    accounts.map((account) => ({
      id: account.id,
      kind: account.kind,
      balance: Number(account.current_balance),
      isActive: account.is_active,
      currency: account.currency,
      reportingBalanceIdr: account.reporting_balance_idr === null ? null : Number(account.reporting_balance_idr),
    })),
  );
  const foreignAccountsWithoutValuation = accounts.filter((account) => account.currency !== "IDR" && account.is_active && account.reporting_balance_idr === null);

  const categoryDataObj: Record<string, number> = {};
  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      categoryDataObj[t.category] = (categoryDataObj[t.category] || 0) + Number(t.amount);
    });

  const COLORS = [
    "#5e6ad2", "#3b82f6", "#27a644", "#f59e0b", "#8b5cf6", 
    "#ec4899", "#06b6d4", "#64748b", "#f97316", "#14b8a6", 
    "#78716c", "#a8a29e"
  ];

  const categoryChartData = Object.keys(categoryDataObj).map((cat, idx) => ({
    name: cat,
    value: categoryDataObj[cat],
    color: COLORS[idx % COLORS.length]
  })).sort((a, b) => b.value - a.value);

  const dailyDataObj: Record<string, { dateStr: string; income: number; expense: number }> = {};
  transactions.forEach(t => {
    const dayStr = format(parseISO(t.date), "dd MMM", { locale: id });
    if (!dailyDataObj[dayStr]) {
      dailyDataObj[dayStr] = { dateStr: dayStr, income: 0, expense: 0 };
    }
    if (t.type === "income") {
      dailyDataObj[dayStr].income += Number(t.amount);
    } else {
      dailyDataObj[dayStr].expense += Number(t.amount);
    }
  });

  const dailyChartData = Object.keys(dailyDataObj).map(day => dailyDataObj[day]).reverse();

  const adjustMonth = (amount: number) => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + amount);
    setSelectedMonth(newMonth);
  };

  const getConfidenceBadgeColor = (conf: number | null) => {
    if (!conf) return "bg-neutral-900 text-neutral-500 border-neutral-800";
    if (conf >= 0.85) return "bg-emerald-950/20 border-emerald-800/40 text-emerald-400";
    if (conf >= 0.7) return "bg-amber-950/20 border-amber-800/40 text-amber-400";
    return "bg-rose-950/20 border-rose-800/40 text-rose-400";
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#f7f8f8] flex flex-col pb-24 md:pb-6 font-sans antialiased">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* PWA Custom Banner */}
        {showInstallBanner && (
          <div className="linear-panel p-4 rounded-lg border-violet-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-violet-600/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight text-white">Pasang FinTrack di Beranda</h4>
                <p className="text-xs text-[#8a8f98] mt-0.5">
                  Akses pencatatan lebih cepat dan stabil langsung dari layar utama ponsel Anda.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-1.5 hover:bg-neutral-800 text-xs font-semibold text-[#8a8f98] hover:text-white rounded transition-colors cursor-pointer click-active"
              >
                Nanti saja
              </button>
              <button 
                onClick={handleInstallPWA}
                className="px-3.5 py-2 bg-[#5e6ad2] hover:bg-[#828fff] text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors click-active shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Pasang Aplikasi
              </button>
            </div>
          </div>
        )}

        {/* Personal dashboard header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-violet-600">{getTimeGreeting(new Date().getHours())}, {firstName} 👋</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17233b]">Keuanganmu hari ini</h1>
            <p className="mt-1 text-xs text-slate-500">
              {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })} · semua yang penting, dalam satu tempat.
            </p>
          </div>

        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#5e6ad2]" />
          </div>
        )}

        {!loading && (
          <>
            <div className="hidden">
              <p className="text-xs font-semibold text-slate-500">Ringkasan {format(selectedMonth, "MMMM", { locale: id })}</p>
              <button onClick={toggleBalances} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 click-active" aria-pressed={showBalances}>
                {showBalances ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showBalances ? "Sembunyikan saldo" : "Tampilkan saldo"}
              </button>
            </div>

            <section className="linear-panel overflow-hidden rounded-2xl">
              <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 px-5 py-4 text-white sm:px-6 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="flex items-center gap-1 rounded-lg bg-white/10 p-0.5 text-violet-50"><button onClick={() => adjustMonth(-1)} aria-label="Bulan sebelumnya" className="rounded-md p-1 transition hover:bg-white/15 click-active">&larr;</button><span className="flex items-center gap-1 px-1.5 text-[10px] font-bold"><Calendar className="h-3 w-3" />{format(selectedMonth, "MMMM yyyy", { locale: id })}</span><button onClick={() => adjustMonth(1)} aria-label="Bulan berikutnya" className="rounded-md p-1 transition hover:bg-white/15 click-active">&rarr;</button></div><p className="mt-2 text-xs text-violet-100">Total kekayaan bersih</p></div>
                  <button onClick={toggleBalances} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/25 click-active" aria-pressed={showBalances}>{showBalances ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{showBalances ? "Sembunyikan" : "Tampilkan"}</button>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4"><h2 className="min-w-0 truncate font-mono text-3xl font-bold tracking-tight sm:text-4xl">{displayIdr(netWorth)}</h2><Wallet className="mb-1 h-6 w-6 shrink-0 text-violet-100" /></div>
                <p className="mt-1 text-[11px] text-violet-100">Aset aktif dikurangi kewajiban</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white">
                <div className="min-w-0 px-3 py-3 sm:px-5"><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500"><ArrowRightLeft className="h-3 w-3 text-violet-500" /> Arus kas</div><p className={`mt-1 truncate font-mono text-sm font-bold sm:text-base ${balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{showBalances ? `${balance >= 0 ? "+" : "-"}${formatIdr(balance)}` : "Rp••••••"}</p></div>
                <div className="min-w-0 px-3 py-3 sm:px-5"><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500"><TrendingUp className="h-3 w-3 text-emerald-500" /> Masuk</div><p className="mt-1 truncate font-mono text-sm font-bold text-emerald-600 sm:text-base">{displayIdr(totalIncome)}</p></div>
                <div className="min-w-0 px-3 py-3 sm:px-5"><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500"><TrendingDown className="h-3 w-3 text-rose-500" /> Keluar</div><p className="mt-1 truncate font-mono text-sm font-bold text-rose-600 sm:text-base">{displayIdr(totalExpense)}</p><p className={`hidden sm:block text-[10px] ${expenseChange === null ? "text-slate-500" : expenseChange > 0 ? "text-rose-500" : "text-emerald-600"}`}>{expenseChange === null ? "Bulan ini" : `${expenseChange > 0 ? "Naik" : "Turun"} ${Math.abs(expenseChange).toLocaleString("id-ID")}%`}</p></div>
              </div>
            </section>

            {/* Legacy compact cards are kept hidden while the unified summary is active. */}
            <div className="hidden">
              {/* Card 1: Net Worth */}
              <div className="linear-panel p-2.5 sm:p-5 rounded-xl flex flex-col justify-between h-24 sm:h-28">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] sm:text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Net Worth</span>
                  <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-[#8a8f98]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm sm:text-2xl font-bold tracking-tight text-white font-mono truncate">
                    {displayIdr(netWorth)}
                  </h3>
                  <p className="hidden sm:block text-[10px] text-[#8a8f98]">Aset aktif dikurangi kewajiban (IDR)</p>
                </div>
              </div>

              {/* Card 2: Cash Flow */}
              <div className="linear-panel p-2.5 sm:p-5 rounded-xl flex flex-col justify-between h-24 sm:h-28">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] sm:text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Arus Kas</span>
                  <ArrowRightLeft className="w-3 h-3 sm:w-4 sm:h-4 text-[#5e6ad2]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className={`text-sm sm:text-2xl font-bold tracking-tight font-mono truncate ${balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {showBalances ? `${balance >= 0 ? "+" : "-"}${formatIdr(balance)}` : "Rp••••••"}
                  </h3>
                  <p className="hidden sm:block text-[10px] text-[#8a8f98]">Pemasukan dikurangi pengeluaran bulan ini</p>
                </div>
              </div>

              {/* Card 3: Income */}
              <div className="linear-panel p-2.5 sm:p-5 rounded-xl flex flex-col justify-between h-24 sm:h-28">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] sm:text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Masuk</span>
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-[#27a644]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm sm:text-2xl font-bold tracking-tight text-[#27a644] font-mono truncate">
                    {displayIdr(totalIncome)}
                  </h3>
                  <p className="hidden sm:block text-[10px] text-[#8a8f98]">Gaji, freelance, & transfer masuk</p>
                </div>
              </div>

              {/* Card 4: Expense */}
              <div className="linear-panel p-2.5 sm:p-5 rounded-xl flex flex-col justify-between h-24 sm:h-28">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] sm:text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Keluar</span>
                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-[#ef4444]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm sm:text-2xl font-bold tracking-tight text-[#ef4444] font-mono truncate">
                    {displayIdr(totalExpense)}
                  </h3>
                  <p className={`hidden sm:block text-[10px] ${expenseChange === null ? "text-[#8a8f98]" : expenseChange > 0 ? "text-rose-500" : "text-emerald-600"}`}>{expenseChange === null ? "Pengeluaran harian & bulanan" : `${expenseChange > 0 ? "Naik" : "Turun"} ${Math.abs(expenseChange).toLocaleString("id-ID")}% vs bulan lalu`}</p>
                </div>
              </div>
            </div>

            <section className="linear-panel rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-bold text-[#17233b]">Akses cepat</h2><p className="mt-0.5 text-xs text-slate-500">Hal yang paling sering kamu lakukan.</p></div><Link href="/accounts" className="text-xs font-bold text-violet-600 hover:text-violet-800">Lihat akun</Link></div>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <Link href="/transactions" className="group flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50"><span className="rounded-xl bg-violet-100 p-2 text-violet-700"><Plus className="h-4 w-4" /></span><span className="text-[10px] font-bold text-slate-700">Catat</span></Link>
                <Link href="/accounts" className="group flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50"><span className="rounded-xl bg-sky-100 p-2 text-sky-700"><ArrowRightLeft className="h-4 w-4" /></span><span className="text-[10px] font-bold text-slate-700">Transfer</span></Link>
                <Link href="/accounts" className="group flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Landmark className="h-4 w-4" /></span><span className="text-[10px] font-bold text-slate-700">Saldo</span></Link>
                <Link href="/investments" className="group flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50"><span className="rounded-xl bg-amber-100 p-2 text-amber-700"><ChartNoAxesCombined className="h-4 w-4" /></span><span className="text-[10px] font-bold text-slate-700">Portfolio</span></Link>
              </div>
            </section>

            <div className="linear-panel p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo per Akun</h2>
                  <p className="mt-1 text-xs text-slate-500">Saldo berubah otomatis dari transaksi dan transfer yang sudah dikonfirmasi.</p>
                </div>
                <Link href="/accounts" className="shrink-0 text-xs text-[#5e6ad2] hover:text-[#828fff] font-bold flex items-center gap-0.5 transition-colors">
                  Kelola Akun
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {accounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {accounts.filter((account) => account.is_active).map((account) => (
                    <div key={account.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:-translate-y-0.5 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {(() => {
                            const presentation = getInstitutionPresentation(account.institution, account.kind);
                            return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black ${presentation.tone}`}>{presentation.initials}</span>;
                          })()}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#17233b]">{account.name}</p>
                            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-slate-500">{account.institution || account.kind}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase text-slate-500 shadow-sm">{account.kind}</span>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-2">
                        <p className={`font-mono text-lg font-bold ${account.kind === "liability" ? "text-rose-600" : "text-[#17233b]"}`}>
                          {showBalances ? `${account.kind === "liability" ? "-" : ""}${account.currency === "IDR" ? "Rp" : `${account.currency} `}${Math.abs(Number(account.current_balance)).toLocaleString("id-ID")}` : `${account.currency === "IDR" ? "Rp" : `${account.currency} `}••••••`}
                        </p>
                        <Link href="/accounts" className="rounded-lg bg-white p-1.5 text-slate-400 shadow-sm transition hover:text-violet-600" aria-label={`Perbarui saldo ${account.name}`}><Edit3 className="h-3.5 w-3.5" /></Link>
                      </div>
                      {(() => {
                        const monthlyChange = accountMonthlyMovement.get(account.id) || 0;
                        const positive = monthlyChange >= 0;
                        return <p className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {monthlyChange === 0 ? "Belum ada aktivitas bulan ini" : `${positive ? "+" : "-"}${showBalances ? formatIdr(monthlyChange) : "Rp••••••"} bulan ini`}
                        </p>;
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-neutral-800 px-4 py-6 text-center text-xs text-neutral-500">
                  Tambahkan rekening, e-wallet, broker, atau kewajiban pertama Anda dari menu Akun.
                </div>
              )}
              {foreignAccountsWithoutValuation.length > 0 && (
                <p className="text-[10px] text-amber-400/90">Ada akun mata uang asing tanpa nilai setara IDR; akun tersebut belum masuk net worth.</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="linear-panel rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-[#17233b]"><Target className="h-4 w-4 text-violet-600" /> Target keuangan</h2>
                    <p className="mt-1 text-xs text-slate-500">Pantau kemajuan yang ingin kamu capai.</p>
                  </div>
                  <Link href="/accounts" className="text-xs font-bold text-violet-600 hover:text-violet-800">Kelola dana</Link>
                </div>
                {goals.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {goals.map((goal) => {
                      const progress = calculateGoalProgress(Number(goal.current_amount), Number(goal.target_amount));
                      const circumference = 2 * Math.PI * 16;
                      return <div key={goal.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="relative flex h-11 w-11 items-center justify-center">
                          <svg className="h-11 w-11 -rotate-90" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="4" /><circle cx="20" cy="20" r="16" fill="none" stroke={goal.color || "#7c3aed"} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress.percentage / 100)} /></svg>
                          <span className="absolute text-[9px] font-bold text-slate-700">{progress.percentage}%</span>
                        </div>
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#17233b]">{goal.name}</p><p className="mt-0.5 text-[10px] text-slate-500">Sisa {displayIdr(progress.remaining)} dari {displayIdr(Number(goal.target_amount))}</p></div>
                      </div>;
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-4 text-center"><Target className="mx-auto h-5 w-5 text-violet-500" /><p className="mt-2 text-xs font-bold text-[#17233b]">Belum ada target aktif</p><p className="mt-1 text-[11px] text-slate-500">Buat target dana darurat atau pembelian besar setelah menjalankan migration target keuangan.</p></div>
                )}
              </section>

              <section className="linear-panel rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-bold text-[#17233b]"><Clock3 className="h-4 w-4 text-sky-600" /> Aktivitas terakhir</h2><p className="mt-1 text-xs text-slate-500">Transaksi terbaru di bulan yang dipilih.</p></div><Link href="/transactions" className="text-xs font-bold text-violet-600 hover:text-violet-800">Lihat semua</Link></div>
                {transactions.length > 0 ? <div className="mt-4 space-y-3">{transactions.slice(0, 4).map((transaction) => <div key={transaction.id} className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${transaction.type === "income" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>{transaction.type === "income" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#17233b]">{transaction.merchant || transaction.note || transaction.category}</p><p className="mt-0.5 text-[10px] text-slate-500">{format(parseISO(transaction.date), "dd MMM", { locale: id })} · {transaction.category}</p></div><p className={`text-xs font-bold ${transaction.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>{transaction.type === "income" ? "+" : "-"}{displayIdr(Number(transaction.amount))}</p></div>)}</div> : <div className="mt-4 rounded-xl bg-slate-50 p-4 text-center"><p className="text-xs font-bold text-[#17233b]">Mulai dari satu transaksi kecil</p><p className="mt-1 text-[11px] text-slate-500">Catat pengeluaran atau pemasukan pertama agar pola keuanganmu mulai terbentuk.</p><Link href="/transactions" className="mt-3 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">Catat transaksi</Link></div>}
              </section>
            </div>

            {/* Pending Approvals Widget */}
            {pendingTx.length > 0 && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-amber-500" />
                    <h2 className="text-sm font-bold tracking-tight uppercase text-amber-500">Perlu Konfirmasi ({pendingTx.length})</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {pendingTx.map((tx) => (
                    <div key={tx.id} className="linear-panel p-4.5 rounded-lg border-amber-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            tx.type === "expense" ? "bg-rose-950/20 text-rose-400 border border-rose-900/30" : "bg-emerald-950/20 text-emerald-400 border border-emerald-900/30"
                          }`}>
                            {tx.type === "expense" ? "Pengeluaran" : "Pemasukan"}
                          </span>
                          <span className="text-xs text-[#8a8f98] font-medium">
                            {format(parseISO(tx.date), "dd MMM yyyy", { locale: id })}
                          </span>
                          {tx.ai_confidence !== null && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getConfidenceBadgeColor(tx.ai_confidence)}`}>
                              AI Conf: {Math.round(tx.ai_confidence * 100)}%
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-white text-sm">
                            {tx.merchant || tx.note || "Transaksi Telegram"}
                          </h4>
                          <p className="text-xs text-[#8a8f98] mt-0.5">
                            Kategori: <span className="text-[#5e6ad2] font-semibold">{tx.category}</span>
                          </p>
                          {tx.note && tx.merchant && (
                            <p className="text-xs text-neutral-500 mt-1 italic">
                               &quot;{tx.note}&quot;
                            </p>
                          )}
                        </div>

                        <div className="text-lg font-bold text-white font-mono">
                          Rp{tx.amount.toLocaleString("id-ID")}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {tx.receipt_url && (
                          <a 
                            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/private/${tx.receipt_url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-[#1a1a1e] hover:bg-neutral-800 border border-[#202024] rounded text-[#8a8f98] hover:text-white transition-colors click-active cursor-pointer"
                            title="Lihat Struk"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => openEditModal(tx)}
                          className="p-2 bg-[#1a1a1e] hover:bg-neutral-800 border border-[#202024] rounded text-[#8a8f98] hover:text-white transition-colors click-active cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReject(tx.id)}
                          className="p-2 bg-[#1a1a1e] hover:bg-rose-950/20 border border-[#202024] rounded text-[#8a8f98] hover:text-rose-400 transition-colors click-active cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleApprove(tx.id)}
                          className="p-2 px-3.5 bg-[#5e6ad2] hover:bg-[#828fff] text-white rounded text-xs font-bold transition-colors flex items-center gap-1 click-active cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Setuju
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts Section */}
            {transactions.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Category Pie Chart & Custom Progress Bars */}
                <div className="linear-panel p-5 rounded-lg space-y-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a8f98] flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#5e6ad2]" />
                      Proporsi Kategori
                    </h3>
                  </div>

                  {categoryChartData.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="h-44 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={65}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {categoryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: unknown) => `Rp${Number(value).toLocaleString("id-ID")}`} 
                              contentStyle={{ background: "#101012", borderColor: "#202024", color: "#fff", borderRadius: "8px" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Premium progress bars */}
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {categoryChartData.map((item, idx) => {
                          const percent = totalExpense > 0 ? (item.value / totalExpense) * 100 : 0;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-400 font-bold truncate max-w-[100px]">{item.name}</span>
                                <span className="font-bold text-neutral-200 font-mono">
                                  Rp{item.value.toLocaleString("id-ID")}
                                </span>
                              </div>
                              <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-500" 
                                  style={{ 
                                    backgroundColor: item.color, 
                                    width: `${percent}%`
                                  }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 flex items-center justify-center text-xs text-neutral-500">
                      Belum ada data pengeluaran bulan ini
                    </div>
                  )}
                </div>

                {/* Daily Spending Trend (Bar Chart) */}
                <div className="linear-panel p-5 rounded-lg space-y-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a8f98] flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-[#5e6ad2]" />
                      Aktivitas Transaksi
                    </h3>
                  </div>

                  {dailyChartData.length > 0 ? (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyChartData}>
                          <XAxis dataKey="dateStr" stroke="#62666d" fontSize={9} tickLine={false} axisLine={false} />
                          <YAxis stroke="#62666d" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                          <Tooltip 
                            formatter={(value: unknown) => `Rp${Number(value).toLocaleString("id-ID")}`} 
                            contentStyle={{ background: "#101012", borderColor: "#202024", color: "#fff", borderRadius: "8px" }}
                          />
                          <Bar dataKey="expense" fill="#ef4444" radius={[2, 2, 0, 0]} name="Pengeluaran" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-44 flex items-center justify-center text-xs text-neutral-500">
                      Belum ada tren pengeluaran harian
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="linear-panel p-10 rounded-lg text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-neutral-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">Belum Ada Transaksi</h3>
                <p className="text-xs text-[#8a8f98] max-w-xs mx-auto">
                  Catatan transaksi akan tampil di sini setelah dikonfirmasi atau dicatat manual.
                </p>
              </div>
            )}

            {/* Recent Transactions List */}
            {transactions.length > 0 && (
              <div className="linear-panel p-5 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a8f98] flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-[#5e6ad2]" />
                    Catatan Terakhir
                  </h3>
                  <Link href="/transactions" className="text-xs text-[#5e6ad2] hover:text-[#828fff] font-bold flex items-center gap-0.5 transition-colors">
                    Lihat Semua
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-neutral-900 text-[#8a8f98] font-bold uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Tanggal</th>
                        <th className="pb-3 font-semibold">Merchant</th>
                        <th className="pb-3 font-semibold">Kategori</th>
                        <th className="pb-3 font-semibold">Nominal</th>
                        <th className="pb-3 font-semibold">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/50 font-medium">
                      {transactions.slice(0, 5).map((tx) => (
                        <tr key={tx.id} className="text-neutral-200 hover:bg-neutral-900/25 transition-colors">
                          <td className="py-3 text-xs text-neutral-400">
                            {format(parseISO(tx.date), "dd MMM yyyy", { locale: id })}
                          </td>
                          <td className="py-3 font-bold text-white">{tx.merchant || "-"}</td>
                          <td className="py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#1a1a1e] border border-neutral-800 rounded text-neutral-300">
                              {tx.category}
                            </span>
                          </td>
                          <td className={`py-3 font-bold font-mono text-sm ${tx.type === "expense" ? "text-rose-400" : "text-emerald-400"}`}>
                            {tx.type === "expense" ? "-" : "+"}Rp{tx.amount.toLocaleString("id-ID")}
                          </td>
                          <td className="py-3 text-xs text-neutral-400 truncate max-w-[160px]">{tx.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Edit Transaction Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#101012] border border-neutral-800 p-5 rounded-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Edit Transaksi</h3>
              <button 
                onClick={() => setEditModalOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 bg-[#050507] p-1 rounded border border-neutral-800">
                <button
                  onClick={() => setEditForm(prev => ({ ...prev, type: "expense" }))}
                  className={`py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${
                    editForm.type === "expense" ? "bg-rose-950/35 text-rose-400 border border-rose-800/40" : "text-neutral-500"
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  onClick={() => setEditForm(prev => ({ ...prev, type: "income" }))}
                  className={`py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${
                    editForm.type === "income" ? "bg-emerald-950/35 text-emerald-400 border border-emerald-800/40" : "text-neutral-500"
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Merchant</label>
                <input
                  type="text"
                  value={editForm.merchant}
                  onChange={(e) => setEditForm(prev => ({ ...prev, merchant: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                  placeholder="Contoh: Indomaret, Starbucks"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Nominal (Rupiah)</label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Kategori</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Catatan</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2] h-16 resize-none"
                  placeholder="Detail transaksi..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-900">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold rounded border border-neutral-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3.5 py-2 bg-[#5e6ad2] hover:bg-[#828fff] text-xs font-semibold rounded text-white cursor-pointer click-active"
              >
                Simpan & Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
