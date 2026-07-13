"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { calculateIdrNetWorth, type FinancialAccountKind } from "@/lib/ledger";
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTx, setPendingTx] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
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

        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f7f8f8]">
              Home
            </h1>
            <p className="text-xs text-[#8a8f98] mt-0.5">
              Semua rekening, pengeluaran, investasi, dan trading kamu dalam satu ringkasan.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#101012] border border-[#202024] rounded p-0.5">
            <button 
              onClick={() => adjustMonth(-1)}
              className="p-1.5 hover:bg-[#1a1a1e] rounded text-[#8a8f98] hover:text-white transition-colors cursor-pointer click-active"
            >
              &larr;
            </button>
            <div className="flex items-center gap-2 px-3 font-semibold text-xs tracking-wide">
              <Calendar className="w-3.5 h-3.5 text-[#5e6ad2]" />
              <span>{format(selectedMonth, "MMMM yyyy", { locale: id })}</span>
            </div>
            <button 
              onClick={() => adjustMonth(1)}
              className="p-1.5 hover:bg-[#1a1a1e] rounded text-[#8a8f98] hover:text-white transition-colors cursor-pointer click-active"
            >
              &rarr;
            </button>
          </div>
        </div>

        <section className="linear-panel rounded-xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Akses cepat</h2><p className="mt-0.5 text-xs text-[#8a8f98]">Hal yang paling sering kamu lakukan.</p></div><Link href="/accounts" className="text-xs font-bold text-violet-300 hover:text-violet-200">Lihat akun</Link></div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 sm:gap-3">
            <Link href="/transactions" className="group flex flex-col items-center gap-2 rounded-lg border border-neutral-800 bg-[#0a0a0d] px-2 py-3 text-center hover:border-violet-500/30"><span className="rounded-lg bg-violet-600/15 p-2 text-violet-300"><Plus className="h-4 w-4" /></span><span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Catat</span></Link>
            <Link href="/accounts" className="group flex flex-col items-center gap-2 rounded-lg border border-neutral-800 bg-[#0a0a0d] px-2 py-3 text-center hover:border-violet-500/30"><span className="rounded-lg bg-sky-500/10 p-2 text-sky-300"><ArrowRightLeft className="h-4 w-4" /></span><span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Transfer</span></Link>
            <Link href="/accounts" className="group flex flex-col items-center gap-2 rounded-lg border border-neutral-800 bg-[#0a0a0d] px-2 py-3 text-center hover:border-violet-500/30"><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300"><Landmark className="h-4 w-4" /></span><span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Saldo</span></Link>
            <Link href="/investments" className="group flex flex-col items-center gap-2 rounded-lg border border-neutral-800 bg-[#0a0a0d] px-2 py-3 text-center hover:border-violet-500/30"><span className="rounded-lg bg-amber-500/10 p-2 text-amber-300"><ChartNoAxesCombined className="h-4 w-4" /></span><span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Portfolio</span></Link>
          </div>
        </section>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#5e6ad2]" />
          </div>
        )}

        {!loading && (
          <>
            {/* Bento Grid Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Card 1: Net Worth */}
              <div className="linear-panel p-5 rounded-lg flex flex-col justify-between h-28">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Net Worth</span>
                  <Wallet className="w-4 h-4 text-[#8a8f98]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
                    Rp{netWorth.toLocaleString("id-ID")}
                  </h3>
                  <p className="text-[10px] text-[#8a8f98]">Aset aktif dikurangi kewajiban (IDR)</p>
                </div>
              </div>

              {/* Card 2: Cash Flow */}
              <div className="linear-panel p-5 rounded-lg flex flex-col justify-between h-28">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Arus Kas</span>
                  <ArrowRightLeft className="w-4 h-4 text-[#5e6ad2]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className={`text-2xl font-bold tracking-tight font-mono ${balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {balance >= 0 ? "+" : "-"}Rp{Math.abs(balance).toLocaleString("id-ID")}
                  </h3>
                  <p className="text-[10px] text-[#8a8f98]">Pemasukan dikurangi pengeluaran bulan ini</p>
                </div>
              </div>

              {/* Card 3: Income */}
              <div className="linear-panel p-5 rounded-lg flex flex-col justify-between h-28">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Pemasukan</span>
                  <TrendingUp className="w-4 h-4 text-[#27a644]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-2xl font-bold tracking-tight text-[#27a644] font-mono">
                    Rp{totalIncome.toLocaleString("id-ID")}
                  </h3>
                  <p className="text-[10px] text-[#8a8f98]">Gaji, freelance, & transfer masuk</p>
                </div>
              </div>

              {/* Card 4: Expense */}
              <div className="linear-panel p-5 rounded-lg flex flex-col justify-between h-28">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-[#8a8f98] uppercase">Pengeluaran</span>
                  <TrendingDown className="w-4 h-4 text-[#ef4444]" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-2xl font-bold tracking-tight text-[#ef4444] font-mono">
                    Rp{totalExpense.toLocaleString("id-ID")}
                  </h3>
                  <p className="text-[10px] text-[#8a8f98]">Pengeluaran harian & bulanan</p>
                </div>
              </div>
            </div>

            <div className="linear-panel p-5 rounded-lg space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">Saldo per Akun</h2>
                  <p className="mt-1 text-xs text-neutral-500">Saldo berubah otomatis dari transaksi dan transfer yang sudah dikonfirmasi.</p>
                </div>
                <Link href="/accounts" className="shrink-0 text-xs text-[#5e6ad2] hover:text-[#828fff] font-bold flex items-center gap-0.5 transition-colors">
                  Kelola Akun
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {accounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {accounts.filter((account) => account.is_active).map((account) => (
                    <div key={account.id} className="rounded-md border border-neutral-800 bg-[#0a0a0d] p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{account.name}</p>
                          <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-neutral-500">{account.institution || account.kind}</p>
                        </div>
                        <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[9px] font-bold uppercase text-neutral-400">{account.kind}</span>
                      </div>
                      <p className={`mt-4 font-mono text-lg font-bold ${account.kind === "liability" ? "text-rose-400" : "text-white"}`}>
                        {account.kind === "liability" ? "-" : ""}{account.currency === "IDR" ? "Rp" : `${account.currency} `}{Math.abs(Number(account.current_balance)).toLocaleString("id-ID")}
                      </p>
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
