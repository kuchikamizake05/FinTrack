"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Sparkles,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const months = ["Juni 2026", "Juli 2026", "Agustus 2026"];

const navigation = [
  { label: "Home", icon: LayoutDashboard },
  { label: "Transaksi", icon: ReceiptText },
  { label: "Investasi", icon: BarChart3 },
  { label: "Trading", icon: TrendingUp },
];

const money = {
  cashFlow: "+Rp4.850.000",
  income: "Rp12.400.000",
  expense: "Rp7.550.000",
};

export default function MobileDashboardDesignPage() {
  const [monthIndex, setMonthIndex] = useState(1);
  const [showBalances, setShowBalances] = useState(true);
  const [showSetup, setShowSetup] = useState(true);
  const [activeNav, setActiveNav] = useState("Home");
  const [toast, setToast] = useState<string | null>(null);

  const display = (value: string) => showBalances ? value : "Rp••••••••";

  const changeMonth = (direction: -1 | 1) => {
    setMonthIndex((current) => Math.min(months.length - 1, Math.max(0, current + direction)));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="min-h-dvh bg-[#e8eee9] text-[#17233b] sm:px-6 sm:py-8">
      <div className="relative mx-auto min-h-dvh w-full overflow-hidden bg-[#f7faf7] sm:min-h-[844px] sm:max-w-[430px] sm:rounded-[34px] sm:border sm:border-white/80 sm:shadow-[0_30px_90px_rgba(23,35,59,0.18)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_12%_0%,rgba(74,222,128,0.20),transparent_55%),linear-gradient(180deg,#effaf3_0%,rgba(247,250,247,0)_100%)]" />

        <header className="relative z-20 flex min-h-16 items-end justify-between border-b border-emerald-900/[0.06] bg-white/90 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={32} priority />
            <span className="text-[15px] font-extrabold tracking-[-0.03em]">FinTrack</span>
          </div>
          <button aria-label="Buka profil" className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-900/10 bg-white text-emerald-700 shadow-[0_3px_12px_rgba(23,35,59,0.06)] transition active:scale-95">
            <UserRound className="h-[17px] w-[17px]" />
          </button>
        </header>

        <main className="relative z-10 px-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-5">
          <section aria-labelledby="mobile-dashboard-title">
            <p className="text-[13px] font-semibold text-emerald-700">Selamat sore, Faaid</p>
            <div className="mt-1 flex items-end justify-between gap-4">
              <div>
                <h1 id="mobile-dashboard-title" className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.045em]">Keuanganmu</h1>
                <p className="mt-1 text-xs font-medium text-slate-500">Senin, 20 Juli 2026</p>
              </div>
              <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                <Sparkles className="h-3 w-3" /> Terkendali
              </span>
            </div>
          </section>

          <section aria-label="Pilih periode" className="mt-4 flex items-center gap-2">
            <div className="flex h-10 flex-1 items-center justify-between rounded-xl border border-emerald-900/[0.08] bg-white/90 px-1 shadow-[0_3px_14px_rgba(23,35,59,0.04)]">
              <button onClick={() => changeMonth(-1)} disabled={monthIndex === 0} aria-label="Bulan sebelumnya" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-700">{months[monthIndex]}</span>
              <button onClick={() => changeMonth(1)} disabled={monthIndex === months.length - 1} aria-label="Bulan berikutnya" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => setShowBalances((current) => !current)} aria-label={showBalances ? "Sembunyikan nominal" : "Tampilkan nominal"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-900/[0.08] bg-white text-slate-500 shadow-[0_3px_14px_rgba(23,35,59,0.04)] transition active:scale-95">
              {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </section>

          <section aria-labelledby="cash-flow-title" className="relative mt-4 overflow-hidden rounded-[24px] bg-[#173c32] px-5 py-5 text-white shadow-[0_18px_36px_rgba(23,60,50,0.20)]">
            <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full border-[28px] border-emerald-300/10" />
            <div className="pointer-events-none absolute -bottom-20 right-6 h-36 w-36 rounded-full bg-emerald-400/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p id="cash-flow-title" className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-100/70">Arus kas bulan ini</p>
                  <p className="mt-2 text-[29px] font-extrabold tracking-[-0.05em]">{display(money.cashFlow)}</p>
                </div>
                <span className="rounded-full border border-emerald-200/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-emerald-100">+18% vs Jun</span>
              </div>
              <p className="mt-1.5 max-w-[280px] text-xs leading-5 text-emerald-50/65">Pendapatan masih lebih besar dari pengeluaran. Ritmemu sehat.</p>

              <div className="mt-5 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-4">
                <Metric icon={ArrowDownLeft} label="Masuk" value={display(money.income)} />
                <Metric icon={ArrowUpRight} label="Keluar" value={display(money.expense)} right />
              </div>
            </div>
          </section>

          {showSetup && (
            <section className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-[#effaf4] px-3.5 py-3" aria-label="Progres penyiapan">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <WalletCards className="h-[17px] w-[17px]" />
              </span>
              <button onClick={() => showToast("Membuka langkah penyiapan")} className="min-w-0 flex-1 text-left">
                <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">1 dari 2 selesai</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-700">Hubungkan transaksi pertamamu</span>
              </button>
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700" />
              <button onClick={() => setShowSetup(false)} aria-label="Tutup pengingat penyiapan" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </section>
          )}

          <section aria-labelledby="quick-actions-title" className="mt-5">
            <div className="flex items-center justify-between">
              <h2 id="quick-actions-title" className="text-sm font-extrabold tracking-[-0.02em]">Aksi cepat</h2>
              <button onClick={() => showToast("Membuka Smart Insights")} className="text-[11px] font-bold text-emerald-700">Lihat insights</button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button onClick={() => showToast("Form transaksi siap dibuka")} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(5,150,105,0.18)] transition active:translate-y-px">
                <Plus className="h-4 w-4" /> Catat transaksi
              </button>
              <button onClick={() => showToast("Membuka daftar akun")} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-900/[0.08] bg-white px-4 text-xs font-extrabold text-slate-700 shadow-[0_3px_14px_rgba(23,35,59,0.04)] transition active:translate-y-px">
                <WalletCards className="h-4 w-4 text-emerald-700" /> Lihat akun
              </button>
            </div>
          </section>

          <section aria-labelledby="activity-title" className="mt-5 overflow-hidden rounded-[20px] border border-emerald-900/[0.07] bg-white shadow-[0_8px_24px_rgba(23,35,59,0.045)]">
            <div className="flex items-center justify-between px-4 pb-3 pt-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Hari ini</p>
                <h2 id="activity-title" className="mt-0.5 text-sm font-extrabold">Aktivitas terbaru</h2>
              </div>
              <button className="text-[11px] font-bold text-emerald-700">Semua</button>
            </div>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              <Activity label="Kopi & sarapan" category="Makanan" amount="−Rp48.000" />
              <Activity label="Freelance design" category="Pendapatan" amount="+Rp1.250.000" positive />
            </div>
          </section>
        </main>

        <nav aria-label="Navigasi prototype" className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-emerald-900/[0.08] bg-white/94 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
          <div className="grid grid-cols-4">
            {navigation.map(({ label, icon: Icon }) => {
              const active = activeNav === label;
              return (
                <button key={label} onClick={() => setActiveNav(label)} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${active ? "text-emerald-700" : "text-slate-400"}`}>
                  {active && <span className="absolute top-0 h-0.5 w-5 rounded-full bg-emerald-600" />}
                  <Icon className={`h-[19px] w-[19px] ${active ? "stroke-[2.5]" : "stroke-2"}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {toast && (
          <div role="status" className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#17233b] px-4 py-2.5 text-xs font-semibold text-white shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, right = false }: { icon: typeof ArrowDownLeft; label: string; value: string; right?: boolean }) {
  return (
    <div className={right ? "pl-4" : "pr-4"}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-100/60"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 text-[13px] font-extrabold tracking-[-0.02em] text-emerald-50">{value}</p>
    </div>
  );
}

function Activity({ label, category, amount, positive = false }: { label: string; category: string; amount: string; positive?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
        {positive ? <ArrowDownLeft className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-700">{label}</p>
        <p className="mt-0.5 text-[10px] font-medium text-slate-400">{category}</p>
      </div>
      <p className={`text-xs font-extrabold ${positive ? "text-emerald-700" : "text-slate-700"}`}>{amount}</p>
    </div>
  );
}
