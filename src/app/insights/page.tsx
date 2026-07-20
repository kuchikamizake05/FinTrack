"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addMonths, endOfMonth, format, parse, startOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Info,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import {
  buildDeterministicInsight,
  buildInsightSnapshot,
  buildPrivateInsightPayload,
  type DeterministicInsight,
  type InsightAction,
  type InsightSnapshot,
  type InsightTransaction,
} from "@/lib/insights";
import {
  generatedInsightEnvelopeSchema,
  type GeneratedInsightEnvelope,
} from "@/lib/insights-api";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { cn } from "@/lib/utils";

type InsightView = Omit<DeterministicInsight, "actions"> & {
  actions: InsightAction[];
  generatedAt?: string;
  model?: string;
};

const moneyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function monthBounds(monthValue: string) {
  const selected = parse(monthValue, "yyyy-MM", new Date(2000, 0, 1));
  const previous = addMonths(selected, -1);
  return {
    selected,
    currentStart: format(startOfMonth(selected), "yyyy-MM-dd"),
    currentEnd: format(endOfMonth(selected), "yyyy-MM-dd"),
    previousStart: format(startOfMonth(previous), "yyyy-MM-dd"),
    previousEnd: format(endOfMonth(previous), "yyyy-MM-dd"),
    periodLabel: format(selected, "MMMM yyyy", { locale: id }),
    previousPeriodLabel: format(previous, "MMMM yyyy", { locale: id }),
  };
}

export default function InsightsPage() {
  const [month, setMonth] = useState("");
  const [snapshot, setSnapshot] = useState<InsightSnapshot | null>(null);
  const [insight, setInsight] = useState<InsightView | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setMonth(format(new Date(), "yyyy-MM")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadInsights = useCallback(async () => {
    if (!month) return;
    void refreshKey;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadingData(true);
    setLoadingAi(false);
    setDataError(null);
    setAiError(null);

    let calculatedSnapshot: InsightSnapshot | null = null;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw sessionError ?? new Error("Sesi login tidak ditemukan.");
      const bounds = monthBounds(month);
      const [currentResult, previousResult, accountsResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, date, type, category, amount, status")
          .eq("user_id", session.user.id)
          .gte("date", bounds.currentStart)
          .lte("date", bounds.currentEnd),
        supabase
          .from("transactions")
          .select("id, date, type, category, amount, status")
          .eq("user_id", session.user.id)
          .gte("date", bounds.previousStart)
          .lte("date", bounds.previousEnd),
        supabase
          .from("financial_accounts")
          .select("id, currency, reporting_balance_idr, is_active")
          .eq("user_id", session.user.id)
          .eq("is_active", true),
      ]);
      if (currentResult.error) throw currentResult.error;
      if (previousResult.error) throw previousResult.error;
      if (accountsResult.error) throw accountsResult.error;
      if (controller.signal.aborted) return;

      const accounts = accountsResult.data ?? [];
      const nextSnapshot = buildInsightSnapshot({
        current: (currentResult.data ?? []) as InsightTransaction[],
        previous: (previousResult.data ?? []) as InsightTransaction[],
        periodLabel: bounds.periodLabel,
        previousPeriodLabel: bounds.previousPeriodLabel,
        activeAccountCount: accounts.length,
        uncoveredForeignAccountCount: accounts.filter((account) => account.currency !== "IDR" && account.reporting_balance_idr === null).length,
      });
      calculatedSnapshot = nextSnapshot;
      const fallback = buildDeterministicInsight(nextSnapshot);
      setSnapshot(nextSnapshot);
      setInsight(fallback);
      setLoadingData(false);

      if (nextSnapshot.current.confirmedCount === 0) return;
      setLoadingAi(true);
      const response = await fetch("/api/insights/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(buildPrivateInsightPayload(nextSnapshot)),
        cache: "no-store",
        signal: controller.signal,
      });
      const responseBody = await response.json().catch(() => ({})) as { insight?: unknown; error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setAiError(responseBody.error || "AI belum bisa menyusun insight. Analisis lokal tetap tersedia.");
        return;
      }
      const parsedInsight = generatedInsightEnvelopeSchema.safeParse(responseBody.insight);
      if (!parsedInsight.success) throw new Error("Respons AI tidak valid.");
      const generated = parsedInsight.data;
      setInsight(mapGeneratedInsight(generated, fallback.actions));
    } catch (loadError) {
      if (controller.signal.aborted) return;
      reportHandledError("Smart insights unavailable", loadError, "Insight belum berhasil dimuat.");
      if (calculatedSnapshot) setAiError("AI belum bisa menyusun insight. Analisis lokal tetap tersedia.");
      else setDataError("Data untuk Smart Insights belum berhasil dimuat. Coba lagi.");
    } finally {
      if (!controller.signal.aborted) {
        setLoadingData(false);
        setLoadingAi(false);
      }
    }
  }, [month, refreshKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInsights(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadInsights]);

  const displayInsight = useMemo(() => insight ?? (snapshot ? buildDeterministicInsight(snapshot) : null), [insight, snapshot]);

  return (
    <div className="app-page">
      <Navbar />
      <main className="app-page-content">
        <PageHeader
          eyebrow={<span className="inline-flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> Review keuangan</span>}
          title="Smart Insights"
          description="Angka dihitung oleh FinTrack. AI hanya membantu menjelaskan pola dan memprioritaskan langkah berikutnya."
          actions={<>
            <label htmlFor="insight-month" className="sr-only">Periode insight</label>
            <input id="insight-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-11 rounded-xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100" />
            <Button variant="secondary" disabled={!month || loadingData || loadingAi} onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw className={cn("h-4 w-4", (loadingData || loadingAi) && "animate-spin")} /> Perbarui</Button>
          </>}
        />

        {dataError && <div role="alert" className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{dataError}</span><Button variant="secondary" size="compact" onClick={() => setRefreshKey((value) => value + 1)}>Coba lagi</Button></div>}

        {loadingData || !month ? <InsightsSkeleton /> : snapshot && snapshot.current.confirmedCount === 0 ? (
          <Surface className="mt-7"><EmptyState icon={BrainCircuit} title={`Belum ada data terverifikasi di ${snapshot.periodLabel}`} description="Catat atau konfirmasi setidaknya satu pemasukan atau pengeluaran agar FinTrack bisa menyusun review yang berguna." action={<Link href="/transactions" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">Buka transaksi <ArrowRight className="h-4 w-4" /></Link>} /></Surface>
        ) : snapshot && displayInsight ? (
          <div className="mt-7 space-y-6">
            <Pulse snapshot={snapshot} />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-6">
                <AiNarrative insight={displayInsight} loading={loadingAi} error={aiError} onRetry={() => setRefreshKey((value) => value + 1)} />
                <Patterns snapshot={snapshot} observations={displayInsight.observations} />
              </div>
              <aside className="space-y-6 lg:sticky lg:top-24">
                <PriorityActions actions={displayInsight.actions} />
                <PrivacyDisclosure />
              </aside>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function mapGeneratedInsight(generated: GeneratedInsightEnvelope, candidates: InsightAction[]): InsightView {
  const candidateById = new Map(candidates.map((action) => [action.id, action]));
  return {
    headline: generated.headline,
    summary: generated.summary,
    tone: generated.tone,
    actions: generated.actions.flatMap((action) => {
      const candidate = candidateById.get(action.candidateId);
      return candidate ? [{ ...candidate, title: action.title, reason: action.reason, impact: action.impact }] : [];
    }),
    observations: generated.observations,
    generatedAt: generated.generatedAt,
    model: generated.model,
  };
}

function Pulse({ snapshot }: { snapshot: InsightSnapshot }) {
  const metrics = [
    { label: "Pemasukan", value: formatMoney(snapshot.current.income), detail: snapshot.incomeChange === null ? "Belum ada pembanding" : `${snapshot.incomeChange > 0 ? "+" : ""}${snapshot.incomeChange}% vs ${snapshot.previousPeriodLabel}`, icon: ArrowUpRight, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Pengeluaran", value: formatMoney(snapshot.current.expense), detail: snapshot.expenseChange === null ? "Belum ada pembanding" : `${snapshot.expenseChange > 0 ? "+" : ""}${snapshot.expenseChange}% vs ${snapshot.previousPeriodLabel}`, icon: ArrowDownRight, tone: "text-rose-600 bg-rose-50" },
    { label: "Arus kas bersih", value: formatMoney(snapshot.current.netCashFlow), detail: `${snapshot.current.confirmedCount} transaksi terverifikasi`, icon: CircleDollarSign, tone: snapshot.current.netCashFlow >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-600 bg-rose-50" },
    { label: "Savings rate", value: snapshot.savingsRate === null ? "Belum tersedia" : `${snapshot.savingsRate}%`, detail: snapshot.savingsRate === null ? "Perlu data pemasukan" : "Dari pemasukan periode ini", icon: WalletCards, tone: "text-sky-700 bg-sky-50" },
  ];
  return <Surface className="overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">Financial pulse</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{snapshot.periodLabel}</h2></div><div className="grid sm:grid-cols-2 lg:grid-cols-4">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <div key={label} className="border-b border-slate-100 p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span><p className="mt-4 text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-mono text-xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-[11px] leading-5 text-slate-400">{detail}</p></div>)}</div></Surface>;
}

function AiNarrative({ insight, loading, error, onRetry }: { insight: InsightView; loading: boolean; error: string | null; onRetry: () => void }) {
  return <Surface className="p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{insight.generatedAt ? "Dibantu AI" : "Analisis FinTrack"}</p><p className="mt-1 text-xs text-slate-400">{insight.generatedAt ? `Diperbarui ${format(new Date(insight.generatedAt), "HH:mm")}` : "Fallback terverifikasi"}</p></div></div>{loading && <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Menyusun</span>}</div><h2 className={cn("mt-6 text-2xl font-bold tracking-[-0.035em]", insight.tone === "attention" ? "text-rose-700" : "text-slate-900")}>{insight.headline}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{insight.summary}</p>{error && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button onClick={onRetry} className="shrink-0 font-bold text-amber-900">Coba AI lagi</button></div>}</Surface>;
}

function PriorityActions({ actions }: { actions: InsightAction[] }) {
  return <Surface className="p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">Prioritas berikutnya</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Langkah yang bisa ditindaklanjuti</h2>{actions.length ? <div className="mt-4 divide-y divide-slate-100">{actions.map((action) => <Link key={action.id} href={action.href} className="group grid grid-cols-[minmax(0,1fr)_20px] gap-3 py-4"><span><span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", action.impact === "high" ? "bg-rose-500" : action.impact === "medium" ? "bg-amber-500" : "bg-emerald-500")} /><span className="text-sm font-bold text-slate-800 group-hover:text-emerald-800">{action.title}</span></span><span className="mt-1 block text-xs leading-5 text-slate-500">{action.reason}</span></span><ChevronRight className="mt-1 h-4 w-4 text-slate-300 group-hover:text-emerald-600" /></Link>)}</div> : <p className="mt-4 text-sm leading-6 text-slate-500">Belum ada tindakan mendesak untuk periode ini.</p>}</Surface>;
}

function Patterns({ snapshot, observations }: { snapshot: InsightSnapshot; observations: string[] }) {
  return <Surface className="p-5 sm:p-7"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Layers3 className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-sky-700">Pola terverifikasi</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Apa yang membentuk periode ini</h2></div></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><div><p className="text-xs font-semibold text-slate-500">Kategori pengeluaran</p>{snapshot.topCategories.length ? <div className="mt-3 space-y-3">{snapshot.topCategories.slice(0, 4).map((category) => <div key={category.name}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-700">{category.name}</span><span className="font-mono text-slate-500">{category.share}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(category.share, 100)}%` }} /></div></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Belum ada pengeluaran terverifikasi.</p>}</div><div><p className="text-xs font-semibold text-slate-500">Observasi</p><ul className="mt-3 space-y-2">{observations.length ? observations.map((observation, index) => <li key={`${observation}-${index}`} className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{observation}</li>) : <li className="text-sm text-slate-500">Belum ada pola yang cukup kuat.</li>}</ul></div></div></Surface>;
}

function PrivacyDisclosure() {
  return <Surface className="p-5 sm:p-6"><details className="group"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-slate-800">Privasi insight</span><span className="mt-0.5 block text-xs text-slate-500">Lihat data yang dipakai AI</span></span></span><Info className="h-4 w-4 text-slate-400" /></summary><div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500"><p>Groq hanya menerima agregat seperti total, rasio, jumlah transaksi, dan lima kategori terbesar.</p><p className="mt-2">Nama merchant, catatan, email, ID akun/transaksi, struk, serta tanggal transaksi tidak dikirim. AI tidak bisa mengubah data.</p></div></details></Surface>;
}

function InsightsSkeleton() {
  return <div className="mt-7 animate-pulse space-y-6" aria-label="Memuat Smart Insights"><div className="h-64 rounded-2xl border border-emerald-100 bg-white/80" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="h-80 rounded-2xl border border-emerald-100 bg-white/80" /><div className="h-72 rounded-2xl border border-emerald-100 bg-white/80" /></div><span className="sr-only"><Eye className="h-4 w-4" /> Memuat review keuangan</span></div>;
}
