"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { BarChart3, History, LineChart as LineChartIcon, Plus, Search, TrendingDown, TrendingUp, WalletCards, X } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Navbar from "@/components/Navbar";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { buildPortfolioWeeklyEquitySeries } from "@/lib/analytics";
import { reportHandledError } from "@/lib/errors";
import { buildInvestmentPositions, filterStockExecutions, validateExecutionForm, validateSnapshotForm, type InvestmentExecution } from "@/lib/investments";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { formatLocalDateTime } from "@/lib/planning";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { cn } from "@/lib/utils";

type Account = { id: string; name: string; currency: string; is_active: boolean };
type Execution = InvestmentExecution & { currency: string; note: string | null };
type Snapshot = { id: string; account_id: string; recorded_at: string; equity: number; currency: string; note: string | null };
type SideFilter = "all" | "buy" | "sell";

function nowLocal() { return formatLocalDateTime(new Date()); }
function createExecutionForm(accountId = "") { return { accountId, ticker: "", side: "buy" as "buy" | "sell", quantity: "", price: "", fee: "0", executedAt: nowLocal(), note: "" }; }
function createSnapshotForm(accountId = "") { return { accountId, equity: "", recordedAt: nowLocal(), note: "" }; }

export default function InvestmentsPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : idLocale;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [editingExecution, setEditingExecution] = useState<Execution | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<Snapshot | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<{ kind: "execution" | "snapshot"; id: string } | null>(null);
  const [executionForm, setExecutionForm] = useState(createExecutionForm);
  const [snapshotForm, setSnapshotForm] = useState(createSnapshotForm);
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const tickerRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountsResult, executionsResult, snapshotsResult] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency, is_active").eq("user_id", user.id).eq("kind", "investment").order("is_active", { ascending: false }).order("name"),
        supabase.from("stock_executions").select("id, account_id, ticker, side, quantity, price, fee, executed_at, currency, note").eq("user_id", user.id).order("executed_at", { ascending: false }),
        supabase.from("account_equity_snapshots").select("id, account_id, recorded_at, equity, currency, note, financial_accounts!inner(kind)").eq("user_id", user.id).eq("financial_accounts.kind", "investment").order("recorded_at", { ascending: true }),
      ]);
      if (accountsResult.error) throw accountsResult.error;
      if (executionsResult.error) throw executionsResult.error;
      if (snapshotsResult.error) throw snapshotsResult.error;
      setAccounts((accountsResult.data ?? []) as Account[]);
      setExecutions((executionsResult.data ?? []) as Execution[]);
      setSnapshots((snapshotsResult.data ?? []) as Snapshot[]);
    } catch (error) {
      reportHandledError("Investments unavailable", error, "Portfolio belum berhasil dimuat.");
      setPageError(t("Portfolio belum berhasil dimuat. Coba lagi beberapa saat lagi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const currencies = useMemo(() => [...new Set([
    ...accounts.map((account) => account.currency),
    ...executions.map((execution) => execution.currency),
    ...snapshots.map((snapshot) => snapshot.currency),
  ])].sort(), [accounts, executions, snapshots]);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? "IDR";
  const positions = useMemo(() => buildInvestmentPositions(executions, currency), [currency, executions]);
  const filteredExecutions = useMemo(() => filterStockExecutions(executions, { side: sideFilter, search }, accountNames), [accountNames, executions, search, sideFilter]);
  const equitySeries = useMemo(() => buildPortfolioWeeklyEquitySeries(
    snapshots.map((item) => ({ accountId: item.account_id, recordedAt: item.recorded_at, equity: Number(item.equity), currency: item.currency })),
    currency,
  ), [currency, snapshots]);
  const openPositions = positions.filter((position) => position.summary.quantity > 0);
  const totalCostBasis = openPositions.reduce((total, position) => total + position.summary.costBasis, 0);
  const totalRealizedPnl = positions.reduce((total, position) => total + position.summary.realizedPnl, 0);
  const latestEquity = equitySeries.at(-1)?.equity ?? null;

  function openExecution() { const accountId = activeAccounts[0]?.id ?? ""; setEditingExecution(null); setExecutionForm(createExecutionForm(accountId)); setFormError(null); setExecutionOpen(true); }
  function openSnapshot() { const accountId = activeAccounts[0]?.id ?? ""; setEditingSnapshot(null); setSnapshotForm(createSnapshotForm(accountId)); setFormError(null); setSnapshotOpen(true); }
  function editExecution(execution: Execution) {
    setEditingExecution(execution);
    setExecutionForm({ accountId: execution.account_id, ticker: execution.ticker, side: execution.side, quantity: String(execution.quantity), price: String(execution.price), fee: String(execution.fee), executedAt: formatLocalDateTime(new Date(execution.executed_at)), note: execution.note ?? "" });
    setFormError(null); setExecutionOpen(true);
  }
  function editSnapshot(snapshot: Snapshot) {
    setEditingSnapshot(snapshot);
    setSnapshotForm({ accountId: snapshot.account_id, equity: String(snapshot.equity), recordedAt: formatLocalDateTime(new Date(snapshot.recorded_at)), note: snapshot.note ?? "" });
    setFormError(null); setSnapshotOpen(true);
  }

  async function saveExecution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const validation = validateExecutionForm(executionForm);
    if (validation) { setFormError(t(validation)); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === executionForm.accountId);
      const record = { account_id: executionForm.accountId, ticker: executionForm.ticker.trim().toUpperCase(), side: executionForm.side, quantity: Number(executionForm.quantity), price: Number(executionForm.price), fee: Number(executionForm.fee), currency: account?.currency ?? "IDR", executed_at: new Date(executionForm.executedAt).toISOString(), note: executionForm.note.trim() || null };
      const { error } = editingExecution
        ? await supabase.from("stock_executions").update(record).eq("id", editingExecution.id).eq("user_id", user.id)
        : await supabase.from("stock_executions").insert({ user_id: user.id, ...record });
      if (error) throw error;
      setExecutionOpen(false); setEditingExecution(null); await loadData();
    } catch (error) { reportHandledError("Execution save failed", error, "Eksekusi belum berhasil disimpan."); setFormError(t("Eksekusi belum berhasil disimpan. Coba lagi.")); }
    finally { setSaving(false); }
  }

  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const validation = validateSnapshotForm(snapshotForm);
    if (validation) { setFormError(t(validation)); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === snapshotForm.accountId);
      const record = { account_id: snapshotForm.accountId, equity: Number(snapshotForm.equity), currency: account?.currency ?? "IDR", recorded_at: new Date(snapshotForm.recordedAt).toISOString(), note: snapshotForm.note.trim() || null };
      const { error } = editingSnapshot
        ? await supabase.from("account_equity_snapshots").update(record).eq("id", editingSnapshot.id).eq("user_id", user.id)
        : await supabase.from("account_equity_snapshots").insert({ user_id: user.id, ...record });
      if (error) throw error;
      setSnapshotOpen(false); setEditingSnapshot(null); await loadData();
    } catch (error) { reportHandledError("Investment snapshot save failed", error, "Snapshot belum berhasil disimpan."); setFormError(t("Snapshot belum berhasil disimpan. Coba lagi.")); }
    finally { setSaving(false); }
  }

  async function deleteRecord() {
    if (!recordToDelete) return;
    if (!canWriteOnline()) { setFormError(t(offlineWriteMessage)); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const table = recordToDelete.kind === "execution" ? "stock_executions" : "account_equity_snapshots";
      const { error } = await supabase.from(table).delete().eq("id", recordToDelete.id).eq("user_id", user.id);
      if (error) throw error;
      setRecordToDelete(null); await loadData();
    } catch (error) {
      reportHandledError("Investment journal delete failed", error, "Catatan belum berhasil dihapus.");
      setFormError(t("Catatan belum berhasil dihapus. Coba lagi."));
    } finally { setSaving(false); }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content space-y-5 outline-none sm:space-y-6">
        <div className="space-y-4">
          <PageHeader
            eyebrow={t("Portfolio journal")}
            title={t("Investasi")}
            description={t("Pantau posisi, cost basis, equity, dan setiap eksekusi saham dalam satu ledger yang tenang.")}
          />

          <PortfolioTabs />

          <div role="group" aria-label={t("Aksi investasi")} className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">
            <Button variant="secondary" onClick={openSnapshot} disabled={!activeAccounts.length} className="w-full sm:w-auto">
              <History className="h-4 w-4" /> {t("Update equity")}
            </Button>
            <Button onClick={openExecution} disabled={!activeAccounts.length} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> {t("Catat eksekusi")}
            </Button>
          </div>
        </div>

        {pageError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{pageError}</span><Button variant="secondary" size="compact" onClick={() => void loadData()}>{t("Coba lagi")}</Button></div>}
        {!loading && activeAccounts.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{t("Tambahkan akun berjenis Investasi terlebih dahulu melalui ")}<Link href="/accounts" className="font-bold underline underline-offset-2">{t("Akun & saldo")}</Link>.</div>}

        {currencies.length > 1 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Pilih mata uang portfolio")}>
            <span className="text-xs font-bold text-slate-500">{t("Mata uang")}</span>
            {currencies.map((item) => (
              <Button key={item} variant={currency === item ? "secondary" : "ghost"} size="compact" onClick={() => setSelectedCurrency(item)} aria-pressed={currency === item}>
                {item}
              </Button>
            ))}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("Ringkasan portfolio")}>
          <Metric label={t("Posisi terbuka")} value={String(openPositions.length)} hint={t("Ticker yang masih dimiliki")} icon={BarChart3} />
          <Metric label={t("Modal tersisa")} value={formatMoney(totalCostBasis, currency)} hint={t("Cost basis rata-rata tertimbang")} icon={WalletCards} />
          <Metric label={t("Equity terakhir")} value={latestEquity === null ? t("Belum ada") : formatMoney(latestEquity, currency)} hint={latestEquity === null ? t("Catat snapshot pertama") : t("Snapshot portfolio terbaru")} icon={LineChartIcon} />
          <Metric label={t("P/L terealisasi")} value={formatSignedMoney(totalRealizedPnl, currency)} hint={t("Setelah biaya jual")} icon={totalRealizedPnl >= 0 ? TrendingUp : TrendingDown} tone={totalRealizedPnl >= 0 ? "text-emerald-700" : "text-rose-700"} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Surface className="p-4 sm:p-5">
            <div><h2 className="flex items-center gap-2 text-base font-bold"><LineChartIcon className="h-4 w-4 text-emerald-700" aria-hidden="true" /> {t("Equity mingguan")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("Nilai terakhir tiap akun pada setiap minggu.")}</p></div>
            {equitySeries.length > 1 ? <><figure aria-labelledby="portfolio-equity-caption" className="mt-4"><figcaption id="portfolio-equity-caption" className="sr-only">{t("Perubahan total equity portofolio per minggu.")}</figcaption><div className="h-64" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><LineChart data={equitySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tickFormatter={(value) => new Intl.NumberFormat(language === "en" ? "en-US" : "id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={60} /><Tooltip formatter={(value) => formatMoney(Number(value), currency)} contentStyle={{ borderRadius: 12, borderColor: "#d1fae5" }} /><Line type="monotone" dataKey="equity" name={t("Equity portofolio")} stroke="#15803d" strokeWidth={3} dot={{ r: 3, fill: "#15803d" }} activeDot={{ r: 5, fill: "#15803d", stroke: "#fff", strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div></figure><details className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5"><summary className="cursor-pointer text-xs font-semibold text-emerald-700">{t("Lihat data tabel equity")}</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[240px] text-left text-xs"><caption className="sr-only">{t("Total equity portofolio per minggu.")}</caption><thead className="border-b border-slate-200 text-[11px] uppercase tracking-[0.06em] text-slate-500"><tr><th scope="col" className="pb-2 pr-4">{t("Minggu")}</th><th scope="col" className="pb-2 text-right">{t("Equity")}</th></tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{equitySeries.map((point) => <tr key={point.week}><th scope="row" className="py-2 pr-4 font-semibold">{point.week}</th><td className="py-2 text-right font-medium">{formatMoney(point.equity, currency)}</td></tr>)}</tbody></table></div></details></> : <div className="mt-4 rounded-xl bg-emerald-50/70 px-5 py-8 text-center"><LineChartIcon className="mx-auto h-6 w-6 text-emerald-700" aria-hidden="true" /><p className="mt-3 text-sm font-bold">{t("Butuh dua snapshot untuk grafik")}</p><p className="mt-1 text-xs leading-5 text-slate-500">{t("Catat nilai portfolio secara rutin agar arahnya terbaca.")}</p></div>}
          </Surface>

          <Surface className="overflow-hidden">
            <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><h2 className="text-base font-bold">{t("Posisi saat ini")}</h2><p className="mt-1 text-xs text-slate-500">{t("Cost basis dari seluruh eksekusi tercatat.")}</p></div>
            {loading ? <InvestmentSkeleton /> : openPositions.length === 0 ? <EmptyState icon={BarChart3} title={t("Belum ada posisi")} description={t("Catat pembelian pertama untuk mulai menghitung jumlah, rata-rata, dan cost basis.")} action={activeAccounts.length ? <Button onClick={openExecution}><Plus className="h-4 w-4" /> {t("Catat pembelian")}</Button> : undefined} /> : <div className="divide-y divide-slate-100">{openPositions.map((position) => <PositionRow key={`${position.accountId}:${position.ticker}`} ticker={position.ticker} accountName={accountNames.get(position.accountId)} currency={position.currency} summary={position.summary} />)}</div>}
          </Surface>
        </div>

        <Surface className="overflow-hidden">
          <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-bold">{t("Execution journal")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("Jejak beli dan jual yang menjadi dasar perhitungan posisi.")}</p></div><div className="flex flex-col gap-2 sm:flex-row"><div role="group" aria-label={t("Filter arah eksekusi")} className="flex rounded-xl bg-slate-100 p-1">{(["all", "buy", "sell"] as const).map((side) => <button key={side} type="button" aria-pressed={sideFilter === side} onClick={() => setSideFilter(side)} className={cn("min-h-10 rounded-lg px-3 text-xs font-bold transition", sideFilter === side ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{side === "all" ? t("Semua") : side === "buy" ? t("Beli") : t("Jual")}</button>)}</div><label className="relative" htmlFor="execution-search"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">{t("Cari ticker atau broker")}</span><input id="execution-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Cari ticker atau broker")} className={cn(fieldControlStyles, "pl-10 sm:w-64")} /></label></div></div></div>
          {loading ? <InvestmentSkeleton /> : filteredExecutions.length === 0 ? <EmptyState icon={Search} title={executions.length ? t("Eksekusi tidak ditemukan") : t("Journal masih kosong")} description={executions.length ? t("Coba kata kunci atau tipe eksekusi lain.") : t("Setiap pembelian dan penjualan akan tampil kronologis di sini.")} action={!executions.length && activeAccounts.length ? <Button onClick={openExecution}><Plus className="h-4 w-4" /> {t("Catat eksekusi")}</Button> : undefined} /> : <ExecutionJournal executions={filteredExecutions} accountNames={accountNames} dateLocale={dateLocale} onEdit={editExecution} onDelete={(id) => { setFormError(null); setRecordToDelete({ kind: "execution", id }); }} />}
        </Surface>

        <Surface className="overflow-hidden">
          <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><h2 className="text-base font-bold">{t("Riwayat equity")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("Koreksi snapshot bila nilai atau waktu tercatat keliru.")}</p></div>
          {loading ? <InvestmentSkeleton /> : snapshots.length === 0 ? <EmptyState icon={History} title={t("Belum ada snapshot")} description={t("Catat equity pertama untuk menyimpan riwayat nilai portfolio.")} action={activeAccounts.length ? <Button variant="secondary" onClick={openSnapshot}><History className="h-4 w-4" /> {t("Update equity")}</Button> : undefined} /> : <div className="divide-y divide-slate-100">{[...snapshots].reverse().map((snapshot) => <article key={snapshot.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-bold">{formatMoney(snapshot.equity, snapshot.currency)}</p><p className="mt-1 text-xs text-slate-500">{format(parseISO(snapshot.recorded_at), "dd MMM yyyy, HH:mm", { locale: dateLocale })} · {accountNames.get(snapshot.account_id) ?? t("Akun investasi")}</p>{snapshot.note && <p className="mt-1 text-xs leading-5 text-slate-600">{snapshot.note}</p>}</div><div className="flex gap-2"><Button variant="secondary" size="compact" onClick={() => editSnapshot(snapshot)}>{t("Edit")}</Button><Button variant="destructive" size="compact" onClick={() => { setFormError(null); setRecordToDelete({ kind: "snapshot", id: snapshot.id }); }}>{t("Hapus")}</Button></div></article>)}</div>}
        </Surface>
      </main>

      {executionOpen && <ExecutionDialog accounts={editingExecution ? accounts : activeAccounts} form={executionForm} setForm={setExecutionForm} saving={saving} error={formError} tickerRef={tickerRef} editing={Boolean(editingExecution)} onClose={() => !saving && setExecutionOpen(false)} onSubmit={saveExecution} />}
      {snapshotOpen && <SnapshotDialog accounts={editingSnapshot ? accounts : activeAccounts} form={snapshotForm} setForm={setSnapshotForm} saving={saving} error={formError} editing={Boolean(editingSnapshot)} onClose={() => !saving && setSnapshotOpen(false)} onSubmit={saveSnapshot} />}
      {recordToDelete && <ConfirmDialog titleId="investment-delete-title" descriptionId="investment-delete-description" title={t(recordToDelete.kind === "execution" ? "Hapus eksekusi?" : "Hapus snapshot?")} description={t(recordToDelete.kind === "execution" ? "Eksekusi ini akan dihapus permanen dan posisi serta P/L akan dihitung ulang." : "Snapshot ini akan dihapus permanen dari riwayat equity.")} confirmLabel={t(recordToDelete.kind === "execution" ? "Hapus eksekusi" : "Hapus snapshot")} cancelLabel={t("Batal")} onClose={() => !saving && setRecordToDelete(null)} onConfirm={() => void deleteRecord()} loading={saving} error={formError} />}
    </div>
  );
}

function Metric({ label, value, hint, icon: Icon, tone = "text-slate-900" }: { label: string; value: string; hint: string; icon: typeof BarChart3; tone?: string }) { return <Surface className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className={cn("mt-2 text-xl font-bold tracking-tight", tone)}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span></div></Surface>; }

function PositionRow({ ticker, accountName, currency, summary }: { ticker: string; accountName?: string; currency: string; summary: ReturnType<typeof buildInvestmentPositions>[number]["summary"] }) {
  const { t } = useLanguage();
  return (
    <article className="p-4 sm:px-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-lg font-bold">{ticker}</p>
          <p className="mt-0.5 text-xs text-slate-500">{accountName ?? t("Akun investasi")} · {t("{count} lembar", { count: summary.quantity.toLocaleString("id-ID") })}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", summary.realizedPnl >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
          {formatSignedMoney(summary.realizedPnl, currency)} {t("realized")}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
        <div>
          <p className="text-slate-400">{t("Rata-rata")}</p>
          <p className="mt-1 font-bold">{formatMoney(summary.averageCost, currency)}</p>
        </div>
        <div>
          <p className="text-slate-400">{t("Cost basis")}</p>
          <p className="mt-1 font-bold">{formatMoney(summary.costBasis, currency)}</p>
        </div>
      </div>
      {summary.oversoldQuantity > 0 && (
        <p className="mt-3 text-xs leading-5 text-amber-700">
          {t("Penjualan melebihi pembelian tercatat sebanyak {count} lembar.", { count: summary.oversoldQuantity.toLocaleString("id-ID") })}
        </p>
      )}
    </article>
  );
}

function ExecutionJournal({ executions, accountNames, dateLocale, onEdit, onDelete }: { executions: Execution[]; accountNames: ReadonlyMap<string, string>; dateLocale: typeof idLocale; onEdit: (execution: Execution) => void; onDelete: (id: string) => void }) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="hidden md:block">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
            <tr>
              <th className="px-5 py-3">{t("Waktu")}</th>
              <th className="px-4 py-3">{t("Ticker")}</th>
              <th className="px-4 py-3">{t("Arah")}</th>
              <th className="px-4 py-3">{t("Jumlah")}</th>
              <th className="px-4 py-3">{t("Harga")}</th>
              <th className="px-5 py-3 text-right">{t("Nilai + biaya")}</th>
              <th className="px-5 py-3 text-right"><span className="sr-only">{t("Aksi")}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {executions.map((item) => (
              <tr key={item.id} className="hover:bg-emerald-50/30">
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold">{format(parseISO(item.executed_at), "dd MMM yyyy", { locale: dateLocale })}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.account_id ? accountNames.get(item.account_id) ?? t("Akun investasi") : t("Akun investasi")}</p>
                </td>
                <td className="px-4 py-4 font-mono text-sm font-bold">{item.ticker}</td>
                <td className="px-4 py-4"><SideBadge side={item.side} /></td>
                <td className="px-4 py-4 text-sm font-semibold">{Number(item.quantity).toLocaleString("id-ID")}</td>
                <td className="px-4 py-4 text-sm">{formatMoney(item.price, item.currency)}</td>
                <td className="px-5 py-4 text-right">
                  <p className="text-sm font-bold">{formatMoney(Number(item.quantity) * Number(item.price), item.currency)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{t("Biaya")} {formatMoney(item.fee, item.currency)}</p>
                </td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="secondary" size="compact" onClick={() => onEdit(item)}>{t("Edit")}</Button><Button variant="destructive" size="compact" onClick={() => onDelete(item.id)}>{t("Hapus")}</Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {executions.map((item) => (
          <article key={item.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-base font-bold">{item.ticker}</p>
                <p className="mt-0.5 text-xs text-slate-400">{format(parseISO(item.executed_at), "dd MMM yyyy, HH:mm", { locale: dateLocale })}</p>
              </div>
              <SideBadge side={item.side} />
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
              <div>
                <p className="text-slate-400">{t("Jumlah × harga")}</p>
                <p className="mt-1 font-bold">{Number(item.quantity).toLocaleString("id-ID")} × {formatMoney(item.price, item.currency)}</p>
              </div>
              <div>
                <p className="text-slate-400">{t("Nilai eksekusi")}</p>
                <p className="mt-1 font-bold">{formatMoney(Number(item.quantity) * Number(item.price), item.currency)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">{item.account_id ? accountNames.get(item.account_id) ?? t("Akun investasi") : t("Akun investasi")} · {t("Biaya")} {formatMoney(item.fee, item.currency)}</p>
            <div className="flex gap-2"><Button variant="secondary" size="compact" onClick={() => onEdit(item)}>{t("Edit")}</Button><Button variant="destructive" size="compact" onClick={() => onDelete(item.id)}>{t("Hapus")}</Button></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SideBadge({ side }: { side: "buy" | "sell" }) {
  const { t } = useLanguage();
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", side === "buy" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{side === "buy" ? t("Beli") : t("Jual")}</span>;
}

function ExecutionDialog({ accounts, form, setForm, saving, error, tickerRef, editing, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createExecutionForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createExecutionForm>>>; saving: boolean; error: string | null; tickerRef: React.RefObject<HTMLInputElement | null>; editing: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const { t } = useLanguage();
  return (
    <Dialog title={t(editing ? "Edit eksekusi" : "Catat eksekusi")} eyebrow={t("Execution journal")} description={t("Simpan detail sesuai trade confirmation broker.")} saving={saving} initialFocusRef={tickerRef} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <Field label={t("Akun investasi")} htmlFor="execution-account">
            <select id="execution-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>
              {accounts.filter((account) => account.is_active || account.id === form.accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(["buy", "sell"] as const).map((side) => (
              <button key={side} type="button" aria-pressed={form.side === side} onClick={() => setForm((current) => ({ ...current, side }))} className={cn("min-h-11 rounded-lg text-sm font-bold", form.side === side ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>
                {side === "buy" ? t("Beli") : t("Jual")}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Ticker")} htmlFor="execution-ticker">
              <input ref={tickerRef} id="execution-ticker" required maxLength={16} value={form.ticker} onChange={(event) => setForm((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))} placeholder="BBCA" className={fieldControlStyles} />
            </Field>
            <Field label={t("Waktu eksekusi")} htmlFor="execution-time">
              <input id="execution-time" type="datetime-local" required value={form.executedAt} onChange={(event) => setForm((current) => ({ ...current, executedAt: event.target.value }))} className={fieldControlStyles} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("Jumlah")} htmlFor="execution-quantity">
              <input id="execution-quantity" type="number" min="0.00000001" step="any" required value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} className={fieldControlStyles} />
            </Field>
            <Field label={t("Harga")} htmlFor="execution-price">
              <input id="execution-price" type="number" min="0" step="any" required value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className={fieldControlStyles} />
            </Field>
            <Field label={t("Biaya")} htmlFor="execution-fee">
              <input id="execution-fee" type="number" min="0" step="any" required value={form.fee} onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))} className={fieldControlStyles} />
            </Field>
          </div>
          <Field label={t("Catatan")} htmlFor="execution-note" hint={t("Opsional—misalnya alasan entry atau nomor order.")}>
            <textarea id="execution-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className={cn(fieldControlStyles, "resize-none")} />
          </Field>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>
        <DialogActions saving={saving} onClose={onClose} label={t(editing ? "Simpan perubahan" : "Simpan eksekusi")} />
      </form>
    </Dialog>
  );
}

function SnapshotDialog({ accounts, form, setForm, saving, error, editing, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createSnapshotForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createSnapshotForm>>>; saving: boolean; error: string | null; editing: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const { t } = useLanguage();
  return (
    <Dialog title={t(editing ? "Edit snapshot" : "Update equity")} eyebrow={t("Portfolio snapshot")} description={t("Catat total nilai akun, termasuk kas broker dan nilai saham.")} saving={saving} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <Field label={t("Akun investasi")} htmlFor="snapshot-account">
            <select id="snapshot-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>
              {accounts.filter((account) => account.is_active || account.id === form.accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
          </Field>
          <Field label={t("Total equity")} htmlFor="snapshot-equity" hint={t("Gunakan mata uang akun yang dipilih.")}>
            <input id="snapshot-equity" type="number" min="0" step="any" required value={form.equity} onChange={(event) => setForm((current) => ({ ...current, equity: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "text-lg font-bold")} />
          </Field>
          <Field label={t("Waktu pencatatan")} htmlFor="snapshot-time">
            <input id="snapshot-time" type="datetime-local" required value={form.recordedAt} onChange={(event) => setForm((current) => ({ ...current, recordedAt: event.target.value }))} className={fieldControlStyles} />
          </Field>
          <Field label={t("Catatan")} htmlFor="snapshot-note" hint={t("Opsional—misalnya setelah market close.")}>
            <textarea id="snapshot-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className={cn(fieldControlStyles, "resize-none")} />
          </Field>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>
        <DialogActions saving={saving} onClose={onClose} label={t(editing ? "Simpan perubahan" : "Simpan snapshot")} />
      </form>
    </Dialog>
  );
}

function Dialog({ title, eyebrow, description, saving, onClose, initialFocusRef, children }: { title: string; eyebrow: string; description: string; saving: boolean; onClose: () => void; initialFocusRef?: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <DialogFrame titleId="investment-dialog-title" descriptionId="investment-dialog-description" initialFocusRef={initialFocusRef} onClose={onClose} closeDisabled={saving}>
      <section>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p>
            <h2 id="investment-dialog-title" className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
            <p id="investment-dialog-description" className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup form investasi")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </section>
    </DialogFrame>
  );
}
function DialogActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  const { t } = useLanguage();
  return (
    <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
      <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">{t("Batal")}</Button>
      <Button type="submit" loading={saving} className="flex-[1.4] sm:flex-none">{label}</Button>
    </div>
  );
}
function InvestmentSkeleton() { return <div className="animate-pulse divide-y divide-slate-100">{[0, 1, 2].map((item) => <div key={item} className="h-20 bg-slate-50/60" />)}</div>; }
function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 4,
  }).format(Math.abs(Number(value)));
}
function formatSignedMoney(value: number, currency: string) { return `${value >= 0 ? "+" : "−"}${formatMoney(value, currency)}`; }
