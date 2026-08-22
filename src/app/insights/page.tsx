"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addMonths, endOfMonth, format, getDaysInMonth, parse, startOfMonth } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
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
import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import { getIdrRates, type FxRateResult } from "@/lib/fx";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { buildCumulativeCashFlowSeries } from "@/lib/home";
import {
  buildDeterministicInsight,
  buildInsightSnapshot,
  buildPrivateInsightPayload,
  convertInsightTransactionsToIdr,
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
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type InsightView = Omit<DeterministicInsight, "actions"> & {
  actions: InsightAction[];
  generatedAt?: string;
  model?: string;
};

type InsightAnalytics = {
  cashFlow: ReturnType<typeof buildCumulativeCashFlowSeries>;
};

type Translator = ReturnType<typeof useLanguage>["t"];

function translateInsightText(t: Translator, text: string) {
  const categoryTitle = /^Tinjau kategori (.+)$/.exec(text);
  if (categoryTitle) return t("Tinjau kategori {category}", { category: t(categoryTitle[1]) });
  const pending = /^(\d+) transaksi (belum masuk ke perhitungan terverifikasi|masih menunggu peninjauan)\.$/.exec(text);
  if (pending) return t(pending[2] === "masih menunggu peninjauan" ? "{count} transaksi masih menunggu peninjauan." : "{count} transaksi belum masuk ke perhitungan terverifikasi.", { count: pending[1] });
  const account = /^(\d+) akun belum memiliki nilai pelaporan IDR\.$/.exec(text);
  if (account) return t("{count} akun belum memiliki nilai pelaporan IDR.", { count: account[1] });
  const categoryShare = /^(.+) mencakup (.+)% dari pengeluaran\.$/.exec(text);
  if (categoryShare) return t("{category} mencakup {share}% dari pengeluaran.", { category: t(categoryShare[1]), share: categoryShare[2] });
  const expenseChange = /^Pengeluaran (naik|turun) (.+)% dibanding (.+)\.$/.exec(text);
  if (expenseChange) return t("Pengeluaran {direction} {change}% dibanding {period}.", { direction: t(expenseChange[1]), change: expenseChange[2], period: expenseChange[3] });
  return t(text);
}

const CATEGORY_COLORS = ["#047857", "#0284c7", "#7c3aed", "#ea580c", "#db2777", "#ca8a04"];

function formatMoney(value: number, language = "id") {
  return new Intl.NumberFormat(language === "en" ? "en-ID" : "id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number, currency: string, language = "id") {
  const locale = language === "en" ? "en-ID" : "id-ID";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(locale)}`;
  }
}

function monthBounds(monthValue: string, dateLocale: typeof enUS | typeof idLocale) {
  const selected = parse(monthValue, "yyyy-MM", new Date(2000, 0, 1));
  const previous = addMonths(selected, -1);
  return {
    selected,
    currentStart: format(startOfMonth(selected), "yyyy-MM-dd"),
    currentEnd: format(endOfMonth(selected), "yyyy-MM-dd"),
    previousStart: format(startOfMonth(previous), "yyyy-MM-dd"),
    previousEnd: format(endOfMonth(previous), "yyyy-MM-dd"),
    periodLabel: format(selected, "MMMM yyyy", { locale: dateLocale }),
    previousPeriodLabel: format(previous, "MMMM yyyy", { locale: dateLocale }),
  };
}

export default function InsightsPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : idLocale;
  const [month, setMonth] = useState("");
  const [snapshot, setSnapshot] = useState<InsightSnapshot | null>(null);
  const [insight, setInsight] = useState<InsightView | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<InsightAnalytics | null>(null);
  const [fxRates, setFxRates] = useState<ReadonlyMap<string, FxRateResult>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const forceFxRefreshRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMonth(format(new Date(), "yyyy-MM")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadInsights = useCallback(async () => {
    if (!month) return;
    void refreshKey;
    const forceFxRefresh = forceFxRefreshRef.current;
    forceFxRefreshRef.current = false;
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
      const bounds = monthBounds(month, dateLocale);
      const [currentResult, previousResult, accountsResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, date, type, category, amount, status, account_id")
          .eq("user_id", session.user.id)
          .gte("date", bounds.currentStart)
          .lte("date", bounds.currentEnd),
        supabase
          .from("transactions")
          .select("id, date, type, category, amount, status, account_id")
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
      const accountCurrencies = new Map(accounts.map((account) => [account.id, account.currency]));
      const allTransactions = [...currentResult.data ?? [], ...previousResult.data ?? []] as InsightTransaction[];
      const transactionCurrencies = allTransactions.flatMap((transaction) => {
        const currency = transaction.account_id ? accountCurrencies.get(transaction.account_id) : null;
        return currency ? [currency] : [];
      });
      const rates = await getIdrRates(transactionCurrencies, { allowStale: true, forceRefresh: forceFxRefresh });
      if (controller.signal.aborted) return;
      const rateValues = new Map([...rates].flatMap(([currency, rate]) => rate.rate === null ? [] : [[currency, rate.rate] as const]));
      const currentTransactions = (currentResult.data ?? []) as InsightTransaction[];
      const nextSnapshot = buildInsightSnapshot({
        current: currentTransactions,
        previous: (previousResult.data ?? []) as InsightTransaction[],
        periodLabel: bounds.periodLabel,
        previousPeriodLabel: bounds.previousPeriodLabel,
        activeAccountCount: accounts.length,
        uncoveredForeignAccountCount: accounts.filter((account) => account.currency !== "IDR" && account.reporting_balance_idr === null).length,
        accountCurrencies,
        rates: rateValues,
      });
      calculatedSnapshot = nextSnapshot;
      const fallback = buildDeterministicInsight(nextSnapshot);
      const convertedCurrent = nextSnapshot.fxState === "converted"
        ? convertInsightTransactionsToIdr(currentTransactions, accountCurrencies, rateValues)
        : [];
      const daysInMonth = getDaysInMonth(bounds.selected);
      const sampleDays = [...new Set([1, 7, 13, 19, 25, daysInMonth])].filter((day) => day <= daysInMonth);
      setSnapshot(nextSnapshot);
      setFxRates(rates);
      setAnalytics(nextSnapshot.fxState === "converted" ? {
        cashFlow: buildCumulativeCashFlowSeries(
          convertedCurrent
            .filter((transaction) => transaction.status === "confirmed")
            .map(({ date, type, amount }) => ({ date, type, amount: Number(amount) })),
          sampleDays,
          format(bounds.selected, "MMM", { locale: dateLocale }),
        ),
      } : null);
      setInsight(fallback);
      setLoadingData(false);

      if (nextSnapshot.current.confirmedCount === 0) return;
      if (nextSnapshot.fxState !== "converted") {
        setAiError(t("Kurs IDR belum tersedia untuk semua transaksi. Insight tetap dipisahkan per mata uang dan tidak dikirim ke AI."));
        return;
      }
      if (!canWriteOnline()) {
        setAiError(offlineWriteMessage);
        return;
      }
      const payload = buildPrivateInsightPayload(nextSnapshot);
      if (!payload) return;
      setLoadingAi(true);
      const response = await fetch("/api/insights/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
      const responseBody = await response.json().catch(() => ({})) as { insight?: unknown; error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setAiError(responseBody.error || t("AI belum bisa menyusun insight. Analisis lokal tetap tersedia."));
        return;
      }
      const parsedInsight = generatedInsightEnvelopeSchema.safeParse(responseBody.insight);
      if (!parsedInsight.success) throw new Error("Respons AI tidak valid.");
      const generated = parsedInsight.data;
      setInsight(mapGeneratedInsight(generated, fallback.actions));
    } catch (loadError) {
      if (controller.signal.aborted) return;
      reportHandledError("Smart insights unavailable", loadError, "Insight belum berhasil dimuat.");
      if (calculatedSnapshot) setAiError(t("AI belum bisa menyusun insight. Analisis lokal tetap tersedia."));
      else setDataError(t("Data untuk Smart Insights belum berhasil dimuat. Coba lagi."));
    } finally {
      if (!controller.signal.aborted) {
        setLoadingData(false);
        setLoadingAi(false);
      }
    }
  }, [month, refreshKey, dateLocale, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInsights(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadInsights]);

  const displayInsight = useMemo(() => insight ?? (snapshot ? buildDeterministicInsight(snapshot) : null), [insight, snapshot]);
  const refreshInsights = (forceFxRefresh = false) => {
    forceFxRefreshRef.current = forceFxRefresh;
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content outline-none">
        <PageHeader
          eyebrow={<span className="inline-flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> {t("Review keuangan")}</span>}
          title="Smart Insights"
          description={t("Angka dihitung oleh FinTrack. AI hanya membantu menjelaskan pola dan memprioritaskan langkah berikutnya.")}
          actions={<>
            <label htmlFor="insight-month" className="sr-only">{t("Periode insight")}</label>
            <input id="insight-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-11 rounded-xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100" />
            <Button variant="secondary" disabled={!month || loadingData || loadingAi} onClick={() => refreshInsights(true)}><RefreshCw className={cn("h-4 w-4", (loadingData || loadingAi) && "animate-spin")} /> {t("Perbarui")}</Button>
          </>}
        />

        {dataError && <div role="alert" className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{dataError}</span><Button variant="secondary" size="compact" onClick={() => refreshInsights(true)}>{t("Coba lagi")}</Button></div>}

        {loadingData || !month ? <InsightsSkeleton /> : snapshot && snapshot.current.confirmedCount === 0 ? (
          <Surface className="mt-7"><EmptyState icon={BrainCircuit} title={t("Belum ada data terverifikasi di {period}", { period: snapshot.periodLabel })} description={t("Catat atau konfirmasi setidaknya satu pemasukan atau pengeluaran agar FinTrack bisa menyusun review yang berguna.")} action={<Link href="/transactions" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">{t("Buka transaksi")} <ArrowRight className="h-4 w-4" /></Link>} /></Surface>
        ) : snapshot && displayInsight ? (
          <div className="mt-7 space-y-4">
            <Pulse snapshot={snapshot} fxRates={fxRates} language={language} />
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                {snapshot.fxState === "converted" && analytics ? <Analytics snapshot={snapshot} analytics={analytics} language={language} /> : <CurrencyPulse snapshot={snapshot} fxRates={fxRates} />}
                <AiNarrative insight={displayInsight} loading={loadingAi} error={aiError} onRetry={() => refreshInsights()} />
                {snapshot.fxState === "converted" && <Patterns snapshot={snapshot} observations={displayInsight.observations} />}
              </div>
              <aside className="space-y-4 lg:sticky lg:top-24">
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

function Pulse({ snapshot, fxRates, language }: { snapshot: InsightSnapshot; fxRates: ReadonlyMap<string, FxRateResult>; language: "id" | "en" }) {
  const { t } = useLanguage();
  const metrics = [
    { label: t("Pemasukan"), value: formatMoney(snapshot.current.income, language), detail: snapshot.incomeChange === null ? t("Belum ada pembanding") : t("{change}% vs {period}", { change: `${snapshot.incomeChange > 0 ? "+" : ""}${snapshot.incomeChange}`, period: snapshot.previousPeriodLabel }), icon: ArrowUpRight, tone: "text-emerald-700 bg-emerald-50" },
    { label: t("Pengeluaran"), value: formatMoney(snapshot.current.expense, language), detail: snapshot.expenseChange === null ? t("Belum ada pembanding") : t("{change}% vs {period}", { change: `${snapshot.expenseChange > 0 ? "+" : ""}${snapshot.expenseChange}`, period: snapshot.previousPeriodLabel }), icon: ArrowDownRight, tone: "text-rose-600 bg-rose-50" },
    { label: t("Arus kas bersih"), value: formatMoney(snapshot.current.netCashFlow, language), detail: t("{count} transaksi terverifikasi", { count: snapshot.current.confirmedCount }), icon: CircleDollarSign, tone: snapshot.current.netCashFlow >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-600 bg-rose-50" },
    { label: t("Tingkat tabungan"), value: snapshot.savingsRate === null ? t("Belum tersedia") : `${snapshot.savingsRate}%`, detail: snapshot.savingsRate === null ? t("Perlu data pemasukan") : t("Dari pemasukan periode ini"), icon: WalletCards, tone: "text-sky-700 bg-sky-50" },
  ];
  const missingCurrencies = snapshot.currencyGroups.filter((group) => fxRates.get(group.currency)?.state === "missing").map((group) => group.currency);
  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className={cn("text-xs font-bold uppercase tracking-[0.1em]", snapshot.fxState === "converted" ? "text-emerald-700" : "text-amber-700")}>{t("Ringkasan arus kas")}</p>
        <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">{snapshot.periodLabel}</h2>
        {snapshot.fxState === "separate" && <p className="mt-1 text-xs leading-5 text-amber-800">{t("Nilai hanya dijumlahkan dalam mata uang yang sama.")} {missingCurrencies.length ? t("Kurs IDR belum tersedia untuk {currencies}.", { currencies: missingCurrencies.join(", ") }) : t("Kurs IDR belum tersedia. Nilai tidak digabung.")}</p>}
      </div>
      {snapshot.fxState === "converted" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
            <div key={label} className="border-b border-slate-100 px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span>
              <p className="mt-2 text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-0.5 font-mono text-lg font-bold tracking-tight text-slate-900">{value}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
      ) : <CurrencyMetrics snapshot={snapshot} fxRates={fxRates} language={language} />}
    </Surface>
  );
}

function CurrencyMetrics({ snapshot, fxRates, language }: { snapshot: InsightSnapshot; fxRates: ReadonlyMap<string, FxRateResult>; language: "id" | "en" }) {
  const { t } = useLanguage();
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3">{snapshot.currencyGroups.map((group) => {
    const rate = fxRates.get(group.currency);
    return <div key={group.currency} className="border-b border-slate-100 px-4 py-3 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{group.currency}</p>{rate?.state && <span className={cn("text-[10px] font-bold uppercase", rate.state === "missing" || rate.state === "stale" ? "text-amber-700" : "text-emerald-700")}>{t(rate.state === "missing" ? "Kurs tidak tersedia" : rate.state === "stale" ? "Kurs tersimpan" : "Kurs tersedia")}</span>}</div>
      <p className={cn("mt-1 text-lg font-bold tracking-[-0.03em]", group.current.netCashFlow >= 0 ? "text-emerald-700" : "text-rose-600")}>{formatCurrency(group.current.netCashFlow, group.currency, language)}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{t("Masuk")} {formatCurrency(group.current.income, group.currency, language)} · {t("Keluar")} {formatCurrency(group.current.expense, group.currency, language)}</p>
    </div>;
  })}</div>;
}

function CurrencyPulse({ snapshot, fxRates }: { snapshot: InsightSnapshot; fxRates: ReadonlyMap<string, FxRateResult> }) {
  const { t } = useLanguage();
  const missingCurrencies = snapshot.currencyGroups.filter((group) => fxRates.get(group.currency)?.state === "missing").map((group) => group.currency);
  return (
    <Surface className="p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-sky-700">{t("Analitik IDR ditunda")}</p>
      <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-900">{t("Menunggu kurs sebelum nilai lintas mata uang dibandingkan.")}</h2>
      <p className="mt-2 text-xs leading-5 text-slate-600">{missingCurrencies.length ? t("Perbarui kurs untuk {currencies}; grafik IDR dan AI tetap dinonaktifkan agar nilai tidak tercampur.", { currencies: missingCurrencies.join(", ") }) : t("Grafik IDR dan AI tetap dinonaktifkan agar nilai lintas mata uang tidak tercampur.")}</p>
    </Surface>
  );
}

function Analytics({ snapshot, analytics, language }: { snapshot: InsightSnapshot; analytics: InsightAnalytics; language: "id" | "en" }) {
  const { t } = useLanguage();
  const categories = snapshot.topCategories.slice(0, 6);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Surface className="min-w-0 p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{t("Tren arus kas")}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{t("Akumulasi pemasukan dan pengeluaran")}</h2>
        <ul aria-label={t("Legenda arus kas")} className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
          <li className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-emerald-700" />{t("Pemasukan")}</li>
          <li className="flex items-center gap-2"><span aria-hidden="true" className="w-4 border-t-2 border-dashed border-rose-500" />{t("Pengeluaran")}</li>
        </ul>
        <figure aria-labelledby="insight-cash-flow-caption" className="mt-4">
          <figcaption id="insight-cash-flow-caption" className="sr-only">{t("Grafik akumulasi pemasukan dan pengeluaran terverifikasi dalam IDR.")}</figcaption>
          <div className="h-44 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.cashFlow} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} dy={10} />
                <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => new Intl.NumberFormat(language === "en" ? "en-ID" : "id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} />
                <Tooltip cursor={{ stroke: "#d1fae5", strokeWidth: 1 }} contentStyle={{ borderRadius: 12, border: "1px solid #d1fae5", boxShadow: "0 8px 24px rgba(15,23,42,.08)", fontSize: 12 }} formatter={(value) => formatMoney(Number(value || 0), language)} />
                <Line type="monotone" dataKey="income" name={t("Pemasukan")} stroke="#047857" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: "#047857", stroke: "#fff", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="expense" name={t("Pengeluaran")} stroke="#f43f5e" strokeWidth={2.5} strokeDasharray="7 4" dot={false} activeDot={{ r: 4, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <details className="group mt-4 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-emerald-700 marker:text-emerald-700">{t("Lihat data tabel arus kas")}</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-xs">
              <caption className="sr-only">{t("Data akumulasi pemasukan dan pengeluaran terverifikasi dalam IDR.")}</caption>
              <thead className="border-b border-slate-200 text-[11px] uppercase tracking-[0.06em] text-slate-500"><tr><th scope="col" className="pb-2 pr-4">{t("Tanggal")}</th><th scope="col" className="pb-2 pr-4 text-right">{t("Pemasukan")}</th><th scope="col" className="pb-2 text-right">{t("Pengeluaran")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">{analytics.cashFlow.map((point) => <tr key={point.day}><th scope="row" className="py-2 pr-4 font-semibold">{point.label}</th><td className="py-2 pr-4 text-right font-medium">{formatMoney(point.income, language)}</td><td className="py-2 text-right font-medium">{formatMoney(point.expense, language)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </Surface>

      <Surface className="min-w-0 p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-sky-700">{t("Komposisi pengeluaran")}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{t("Kategori terbesar bulan ini")}</h2>
        {categories.length ? <>
          <figure aria-labelledby="insight-category-chart-caption" className="mt-4">
            <figcaption id="insight-category-chart-caption" className="sr-only">{t("Diagram kategori pengeluaran terverifikasi dalam IDR.")}</figcaption>
            <div className="h-44 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categories} dataKey="amount" nameKey="name" innerRadius="56%" outerRadius="82%" paddingAngle={3} stroke="none">
                    {categories.map((category, index) => <Cell key={category.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #dbeafe", boxShadow: "0 8px 24px rgba(15,23,42,.08)", fontSize: 12 }} formatter={(value) => formatMoney(Number(value || 0), language)} />
                  <Legend formatter={(value) => t(String(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </figure>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            {categories.map((category, index) => <li key={category.name} className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} /><span className="truncate font-semibold">{t(category.name)}</span></span><span className="shrink-0 font-mono">{formatMoney(category.amount, language)} · {category.share}%</span></li>)}
          </ul>
          <details className="group mt-4 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-sky-700 marker:text-sky-700">{t("Lihat data tabel kategori")}</summary>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[300px] text-left text-xs"><caption className="sr-only">{t("Data kategori pengeluaran terverifikasi dalam IDR.")}</caption><thead className="border-b border-slate-200 text-[11px] uppercase tracking-[0.06em] text-slate-500"><tr><th scope="col" className="pb-2 pr-4">{t("Kategori")}</th><th scope="col" className="pb-2 pr-4 text-right">{t("Nominal")}</th><th scope="col" className="pb-2 text-right">{t("Porsi")}</th></tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{categories.map((category) => <tr key={category.name}><th scope="row" className="py-2 pr-4 font-semibold">{t(category.name)}</th><td className="py-2 pr-4 text-right font-medium">{formatMoney(category.amount, language)}</td><td className="py-2 text-right font-medium">{category.share}%</td></tr>)}</tbody></table></div>
          </details>
        </> : <p className="mt-5 text-sm text-slate-500">{t("Belum ada pengeluaran terverifikasi.")}</p>}
      </Surface>
    </div>
  );
}

function AiNarrative({ insight, loading, error, onRetry }: { insight: InsightView; loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <Surface className="p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{insight.generatedAt ? t("Dibantu AI") : t("Analisis FinTrack")}</p>
            <p className="mt-1 text-xs text-slate-400">{insight.generatedAt ? t("Diperbarui {time}", { time: format(new Date(insight.generatedAt), "HH:mm") }) : t("Fallback terverifikasi")}</p>
          </div>
        </div>
        {loading && <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> {t("Menyusun")}</span>}
      </div>
      <h2 className={cn("mt-4 text-xl font-bold tracking-[-0.03em]", insight.tone === "attention" ? "text-rose-700" : "text-slate-900")}>{translateInsightText(t, insight.headline)}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{translateInsightText(t, insight.summary)}</p>
      {error && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button onClick={onRetry} className="shrink-0 font-bold text-amber-900">{t("Coba AI lagi")}</button>
        </div>
      )}
    </Surface>
  );
}

function PriorityActions({ actions }: { actions: InsightAction[] }) {
  const { t } = useLanguage();
  return (
    <Surface className="p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{t("Prioritas berikutnya")}</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{t("Langkah yang bisa ditindaklanjuti")}</h2>
      {actions.length ? (
        <div className="mt-4 divide-y divide-slate-100">
          {actions.map((action) => (
            <Link key={action.id} href={action.href} className="group grid grid-cols-[minmax(0,1fr)_20px] gap-3 py-4">
              <span>
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", action.impact === "high" ? "bg-rose-500" : action.impact === "medium" ? "bg-amber-500" : "bg-emerald-500")} />
                  <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-800">{translateInsightText(t, action.title)}</span>
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{translateInsightText(t, action.reason)}</span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 text-slate-300 group-hover:text-emerald-600" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-500">{t("Belum ada tindakan mendesak untuk periode ini.")}</p>
      )}
    </Surface>
  );
}

function Patterns({ snapshot, observations }: { snapshot: InsightSnapshot; observations: string[] }) {
  const { t } = useLanguage();
  return (
    <Surface className="p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Layers3 className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-sky-700">{t("Pola terverifikasi")}</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{t("Apa yang membentuk periode ini")}</h2>
        </div>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-500">{t("Kategori pengeluaran")}</p>
          {snapshot.topCategories.length ? (
            <div className="mt-3 space-y-3">
              {snapshot.topCategories.slice(0, 4).map((category) => (
                <div key={category.name}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-700">{t(category.name)}</span>
                    <span className="font-mono text-slate-500">{category.share}%</span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={t("Porsi pengeluaran {name}", { name: t(category.name) })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(category.share, 100)}
                    aria-valuetext={t("{share}% dari pengeluaran terverifikasi", { share: category.share })}
                  >
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(category.share, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t("Belum ada pengeluaran terverifikasi.")}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">{t("Observasi")}</p>
          <ul className="mt-3 space-y-2">
            {observations.length ? (
              observations.map((observation, index) => (
                <li key={`${observation}-${index}`} className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {translateInsightText(t, observation)}
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500">{t("Belum ada pola yang cukup kuat.")}</li>
            )}
          </ul>
        </div>
      </div>
    </Surface>
  );
}

function PrivacyDisclosure() {
  const { t } = useLanguage();
  return (
    <Surface className="p-5 sm:p-6">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
            <span>
              <span className="block text-sm font-bold text-slate-800">{t("Privasi insight")}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{t("Lihat data yang dipakai AI")}</span>
            </span>
          </span>
          <Info className="h-4 w-4 text-slate-400" />
        </summary>
        <div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          <p>{t("Groq hanya menerima agregat seperti total, rasio, jumlah transaksi, dan lima kategori terbesar.")}</p>
          <p className="mt-2">{t("Nama merchant, catatan, email, ID akun/transaksi, struk, serta tanggal transaksi tidak dikirim. AI tidak bisa mengubah data.")}</p>
        </div>
      </details>
    </Surface>
  );
}

function InsightsSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="mt-7 animate-pulse space-y-6" aria-label={t("Memuat Smart Insights")}>
      <div className="h-64 rounded-2xl border border-emerald-100 bg-white/80" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-80 rounded-2xl border border-emerald-100 bg-white/80" />
        <div className="h-72 rounded-2xl border border-emerald-100 bg-white/80" />
      </div>
      <span className="sr-only"><Eye className="h-4 w-4" /> {t("Memuat review keuangan")}</span>
    </div>
  );
}
