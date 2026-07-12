"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { BarChart3, Camera, LineChart as LineChartIcon, Loader2, Plus, Search, TrendingDown, TrendingUp, WalletCards, X } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { buildPortfolioWeeklyEquitySeries } from "@/lib/analytics";
import { reportHandledError } from "@/lib/errors";
import { buildInvestmentPositions, filterStockExecutions, validateExecutionForm, validateSnapshotForm, type InvestmentExecution } from "@/lib/investments";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Account = { id: string; name: string; currency: string };
type Execution = InvestmentExecution & { currency: string; note: string | null };
type Snapshot = { id: string; account_id: string; recorded_at: string; equity: number; currency: string; note: string | null };
type SideFilter = "all" | "buy" | "sell";

function nowLocal() { return new Date().toISOString().slice(0, 16); }
function createExecutionForm(accountId = "") { return { accountId, ticker: "", side: "buy" as "buy" | "sell", quantity: "", price: "", fee: "0", executedAt: nowLocal(), note: "" }; }
function createSnapshotForm(accountId = "") { return { accountId, equity: "", recordedAt: nowLocal(), note: "" }; }

export default function InvestmentsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [executionForm, setExecutionForm] = useState(createExecutionForm);
  const [snapshotForm, setSnapshotForm] = useState(createSnapshotForm);
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [search, setSearch] = useState("");
  const tickerRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountsResult, executionsResult, snapshotsResult] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency").eq("user_id", user.id).eq("kind", "investment").eq("is_active", true).order("name"),
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
      setPageError("Portfolio belum berhasil dimuat. Coba lagi beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  useEffect(() => {
    if (!executionOpen && !snapshotOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = executionOpen ? window.setTimeout(() => tickerRef.current?.focus(), 80) : undefined;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) { setExecutionOpen(false); setSnapshotOpen(false); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; if (timer) window.clearTimeout(timer); window.removeEventListener("keydown", closeOnEscape); };
  }, [executionOpen, saving, snapshotOpen]);

  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const positions = useMemo(() => buildInvestmentPositions(executions), [executions]);
  const filteredExecutions = useMemo(() => filterStockExecutions(executions, { side: sideFilter, search }, accountNames), [accountNames, executions, search, sideFilter]);
  const equitySeries = useMemo(() => buildPortfolioWeeklyEquitySeries(snapshots.map((item) => ({ accountId: item.account_id, recordedAt: item.recorded_at, equity: Number(item.equity) }))), [snapshots]);
  const openPositions = positions.filter((position) => position.summary.quantity > 0);
  const totalCostBasis = openPositions.reduce((total, position) => total + position.summary.costBasis, 0);
  const totalRealizedPnl = positions.reduce((total, position) => total + position.summary.realizedPnl, 0);
  const latestEquity = equitySeries.at(-1)?.equity ?? null;

  function openExecution() { const accountId = accounts[0]?.id ?? ""; setExecutionForm(createExecutionForm(accountId)); setFormError(null); setExecutionOpen(true); }
  function openSnapshot() { const accountId = accounts[0]?.id ?? ""; setSnapshotForm(createSnapshotForm(accountId)); setFormError(null); setSnapshotOpen(true); }

  async function saveExecution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateExecutionForm(executionForm);
    if (validation) { setFormError(validation); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === executionForm.accountId);
      const { error } = await supabase.from("stock_executions").insert({ user_id: user.id, account_id: executionForm.accountId, ticker: executionForm.ticker.trim().toUpperCase(), side: executionForm.side, quantity: Number(executionForm.quantity), price: Number(executionForm.price), fee: Number(executionForm.fee), currency: account?.currency ?? "IDR", executed_at: new Date(executionForm.executedAt).toISOString(), note: executionForm.note.trim() || null });
      if (error) throw error;
      setExecutionOpen(false); await loadData();
    } catch (error) { reportHandledError("Execution save failed", error, "Eksekusi belum berhasil disimpan."); setFormError("Eksekusi belum berhasil disimpan. Coba lagi."); }
    finally { setSaving(false); }
  }

  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSnapshotForm(snapshotForm);
    if (validation) { setFormError(validation); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === snapshotForm.accountId);
      const { error } = await supabase.from("account_equity_snapshots").insert({ user_id: user.id, account_id: snapshotForm.accountId, equity: Number(snapshotForm.equity), currency: account?.currency ?? "IDR", recorded_at: new Date(snapshotForm.recordedAt).toISOString(), note: snapshotForm.note.trim() || null });
      if (error) throw error;
      setSnapshotOpen(false); await loadData();
    } catch (error) { reportHandledError("Investment snapshot save failed", error, "Snapshot belum berhasil disimpan."); setFormError("Snapshot belum berhasil disimpan. Coba lagi."); }
    finally { setSaving(false); }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main className="app-page-content space-y-5 sm:space-y-6">
        <PageHeader eyebrow="Portfolio journal" title="Investasi" description="Pantau posisi, cost basis, equity, dan setiap eksekusi saham dalam satu ledger yang tenang." actions={<><Button variant="secondary" onClick={openSnapshot} disabled={!accounts.length}><Camera className="h-4 w-4" /> Update equity</Button><Button onClick={openExecution} disabled={!accounts.length}><Plus className="h-4 w-4" /> Catat eksekusi</Button></>} />

        {pageError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{pageError}</span><Button variant="secondary" size="compact" onClick={() => void loadData()}>Coba lagi</Button></div>}
        {!loading && accounts.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Tambahkan akun berjenis Investasi terlebih dahulu melalui <Link href="/accounts" className="font-bold underline underline-offset-2">Akun & saldo</Link>.</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan portfolio">
          <Metric label="Posisi terbuka" value={String(openPositions.length)} hint="Ticker yang masih dimiliki" icon={BarChart3} />
          <Metric label="Modal tersisa" value={formatIdr(totalCostBasis)} hint="Cost basis rata-rata tertimbang" icon={WalletCards} />
          <Metric label="Equity terakhir" value={latestEquity === null ? "Belum ada" : formatIdr(latestEquity)} hint={latestEquity === null ? "Catat snapshot pertama" : "Snapshot portfolio terbaru"} icon={LineChartIcon} />
          <Metric label="P/L terealisasi" value={formatSignedIdr(totalRealizedPnl)} hint="Setelah biaya jual" icon={totalRealizedPnl >= 0 ? TrendingUp : TrendingDown} tone={totalRealizedPnl >= 0 ? "text-emerald-700" : "text-rose-700"} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Surface className="p-4 sm:p-5">
            <div><h2 className="flex items-center gap-2 text-base font-bold"><LineChartIcon className="h-4 w-4 text-emerald-700" /> Equity mingguan</h2><p className="mt-1 text-xs leading-5 text-slate-500">Nilai terakhir tiap akun pada setiap minggu.</p></div>
            {equitySeries.length > 1 ? <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={equitySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tickFormatter={(value) => `Rp${Number(value / 1_000_000).toFixed(1)}jt`} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={60} /><Tooltip formatter={(value) => formatIdr(Number(value))} contentStyle={{ borderRadius: 12, borderColor: "#d1fae5" }} /><Line type="monotone" dataKey="equity" stroke="#15803d" strokeWidth={3} dot={{ r: 3, fill: "#15803d" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <div className="mt-4 rounded-xl bg-emerald-50/70 px-5 py-8 text-center"><LineChartIcon className="mx-auto h-6 w-6 text-emerald-700" /><p className="mt-3 text-sm font-bold">Butuh dua snapshot untuk grafik</p><p className="mt-1 text-xs leading-5 text-slate-500">Catat nilai portfolio secara rutin agar arahnya terbaca.</p></div>}
          </Surface>

          <Surface className="overflow-hidden">
            <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><h2 className="text-base font-bold">Posisi saat ini</h2><p className="mt-1 text-xs text-slate-500">Cost basis dari seluruh eksekusi tercatat.</p></div>
            {loading ? <InvestmentSkeleton /> : openPositions.length === 0 ? <EmptyState icon={BarChart3} title="Belum ada posisi" description="Catat pembelian pertama untuk mulai menghitung jumlah, rata-rata, dan cost basis." action={accounts.length ? <Button onClick={openExecution}><Plus className="h-4 w-4" /> Catat pembelian</Button> : undefined} /> : <div className="divide-y divide-slate-100">{openPositions.map((position) => <PositionRow key={position.ticker} ticker={position.ticker} summary={position.summary} />)}</div>}
          </Surface>
        </div>

        <Surface className="overflow-hidden">
          <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-bold">Execution journal</h2><p className="mt-1 text-xs leading-5 text-slate-500">Jejak beli dan jual yang menjadi dasar perhitungan posisi.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="flex rounded-xl bg-slate-100 p-1">{(["all", "buy", "sell"] as const).map((side) => <button key={side} type="button" aria-pressed={sideFilter === side} onClick={() => setSideFilter(side)} className={cn("min-h-10 rounded-lg px-3 text-xs font-bold transition", sideFilter === side ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{side === "all" ? "Semua" : side === "buy" ? "Beli" : "Jual"}</button>)}</div><label className="relative" htmlFor="execution-search"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">Cari ticker atau broker</span><input id="execution-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari ticker atau broker" className={cn(fieldControlStyles, "pl-10 sm:w-64")} /></label></div></div></div>
          {loading ? <InvestmentSkeleton /> : filteredExecutions.length === 0 ? <EmptyState icon={Search} title={executions.length ? "Eksekusi tidak ditemukan" : "Journal masih kosong"} description={executions.length ? "Coba kata kunci atau tipe eksekusi lain." : "Setiap pembelian dan penjualan akan tampil kronologis di sini."} action={!executions.length && accounts.length ? <Button onClick={openExecution}><Plus className="h-4 w-4" /> Catat eksekusi</Button> : undefined} /> : <ExecutionJournal executions={filteredExecutions} accountNames={accountNames} />}
        </Surface>
      </main>

      {executionOpen && <ExecutionDialog accounts={accounts} form={executionForm} setForm={setExecutionForm} saving={saving} error={formError} tickerRef={tickerRef} onClose={() => !saving && setExecutionOpen(false)} onSubmit={saveExecution} />}
      {snapshotOpen && <SnapshotDialog accounts={accounts} form={snapshotForm} setForm={setSnapshotForm} saving={saving} error={formError} onClose={() => !saving && setSnapshotOpen(false)} onSubmit={saveSnapshot} />}
    </div>
  );
}

function Metric({ label, value, hint, icon: Icon, tone = "text-slate-900" }: { label: string; value: string; hint: string; icon: typeof BarChart3; tone?: string }) { return <Surface className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className={cn("mt-2 text-xl font-bold tracking-tight", tone)}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span></div></Surface>; }

function PositionRow({ ticker, summary }: { ticker: string; summary: ReturnType<typeof buildInvestmentPositions>[number]["summary"] }) { return <article className="p-4 sm:px-5"><div className="flex items-start justify-between"><div><p className="font-mono text-lg font-bold">{ticker}</p><p className="mt-0.5 text-xs text-slate-500">{summary.quantity.toLocaleString("id-ID")} lembar</p></div><span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", summary.realizedPnl >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{formatSignedIdr(summary.realizedPnl)} realized</span></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-400">Rata-rata</p><p className="mt-1 font-bold">{formatIdr(summary.averageCost)}</p></div><div><p className="text-slate-400">Cost basis</p><p className="mt-1 font-bold">{formatIdr(summary.costBasis)}</p></div></div>{summary.oversoldQuantity > 0 && <p className="mt-3 text-xs leading-5 text-amber-700">Penjualan melebihi pembelian tercatat sebanyak {summary.oversoldQuantity.toLocaleString("id-ID")} lembar.</p>}</article>; }

function ExecutionJournal({ executions, accountNames }: { executions: Execution[]; accountNames: ReadonlyMap<string, string> }) { return <div><div className="hidden md:block"><table className="w-full text-left"><thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-[0.08em] text-slate-400"><tr><th className="px-5 py-3">Waktu</th><th className="px-4 py-3">Ticker</th><th className="px-4 py-3">Arah</th><th className="px-4 py-3">Jumlah</th><th className="px-4 py-3">Harga</th><th className="px-5 py-3 text-right">Nilai + biaya</th></tr></thead><tbody className="divide-y divide-slate-100">{executions.map((item) => <tr key={item.id} className="hover:bg-emerald-50/30"><td className="px-5 py-4"><p className="text-sm font-semibold">{format(parseISO(item.executed_at), "dd MMM yyyy", { locale: idLocale })}</p><p className="mt-0.5 text-xs text-slate-400">{accountNames.get(item.account_id) ?? "Akun investasi"}</p></td><td className="px-4 py-4 font-mono text-sm font-bold">{item.ticker}</td><td className="px-4 py-4"><SideBadge side={item.side} /></td><td className="px-4 py-4 text-sm font-semibold">{Number(item.quantity).toLocaleString("id-ID")}</td><td className="px-4 py-4 text-sm">{formatMoney(item.price, item.currency)}</td><td className="px-5 py-4 text-right"><p className="text-sm font-bold">{formatMoney(Number(item.quantity) * Number(item.price), item.currency)}</p><p className="mt-0.5 text-xs text-slate-400">Biaya {formatMoney(item.fee, item.currency)}</p></td></tr>)}</tbody></table></div><div className="divide-y divide-slate-100 md:hidden">{executions.map((item) => <article key={item.id} className="space-y-3 p-4"><div className="flex items-start justify-between"><div><p className="font-mono text-base font-bold">{item.ticker}</p><p className="mt-0.5 text-xs text-slate-400">{format(parseISO(item.executed_at), "dd MMM yyyy, HH:mm", { locale: idLocale })}</p></div><SideBadge side={item.side} /></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-400">Jumlah × harga</p><p className="mt-1 font-bold">{Number(item.quantity).toLocaleString("id-ID")} × {formatMoney(item.price, item.currency)}</p></div><div><p className="text-slate-400">Nilai eksekusi</p><p className="mt-1 font-bold">{formatMoney(Number(item.quantity) * Number(item.price), item.currency)}</p></div></div><p className="text-xs text-slate-500">{accountNames.get(item.account_id) ?? "Akun investasi"} · Biaya {formatMoney(item.fee, item.currency)}</p></article>)}</div></div>; }

function SideBadge({ side }: { side: "buy" | "sell" }) { return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", side === "buy" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{side === "buy" ? "Beli" : "Jual"}</span>; }

function ExecutionDialog({ accounts, form, setForm, saving, error, tickerRef, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createExecutionForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createExecutionForm>>>; saving: boolean; error: string | null; tickerRef: React.RefObject<HTMLInputElement | null>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) { return <Dialog title="Catat eksekusi" eyebrow="Execution journal" description="Simpan detail sesuai trade confirmation broker." saving={saving} onClose={onClose}><form onSubmit={onSubmit}><div className="space-y-4 px-5 py-5 sm:px-6"><Field label="Akun investasi" htmlFor="execution-account"><select id="execution-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">{(["buy", "sell"] as const).map((side) => <button key={side} type="button" aria-pressed={form.side === side} onClick={() => setForm((current) => ({ ...current, side }))} className={cn("min-h-11 rounded-lg text-sm font-bold", form.side === side ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{side === "buy" ? "Beli" : "Jual"}</button>)}</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Ticker" htmlFor="execution-ticker"><input ref={tickerRef} id="execution-ticker" required maxLength={16} value={form.ticker} onChange={(event) => setForm((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))} placeholder="BBCA" className={fieldControlStyles} /></Field><Field label="Waktu eksekusi" htmlFor="execution-time"><input id="execution-time" type="datetime-local" required value={form.executedAt} onChange={(event) => setForm((current) => ({ ...current, executedAt: event.target.value }))} className={fieldControlStyles} /></Field></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Jumlah" htmlFor="execution-quantity"><input id="execution-quantity" type="number" min="0.00000001" step="any" required value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Harga" htmlFor="execution-price"><input id="execution-price" type="number" min="0" step="any" required value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Biaya" htmlFor="execution-fee"><input id="execution-fee" type="number" min="0" step="any" required value={form.fee} onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))} className={fieldControlStyles} /></Field></div><Field label="Catatan" htmlFor="execution-note" hint="Opsional—misalnya alasan entry atau nomor order."><textarea id="execution-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className={cn(fieldControlStyles, "resize-none")} /></Field>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}</div><DialogActions saving={saving} onClose={onClose} label="Simpan eksekusi" /></form></Dialog>; }

function SnapshotDialog({ accounts, form, setForm, saving, error, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createSnapshotForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createSnapshotForm>>>; saving: boolean; error: string | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) { return <Dialog title="Update equity" eyebrow="Portfolio snapshot" description="Catat total nilai akun, termasuk kas broker dan nilai saham." saving={saving} onClose={onClose}><form onSubmit={onSubmit}><div className="space-y-4 px-5 py-5 sm:px-6"><Field label="Akun investasi" htmlFor="snapshot-account"><select id="snapshot-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field><Field label="Total equity" htmlFor="snapshot-equity" hint="Gunakan mata uang akun yang dipilih."><input id="snapshot-equity" type="number" min="0" step="any" required value={form.equity} onChange={(event) => setForm((current) => ({ ...current, equity: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "text-lg font-bold")} /></Field><Field label="Waktu pencatatan" htmlFor="snapshot-time"><input id="snapshot-time" type="datetime-local" required value={form.recordedAt} onChange={(event) => setForm((current) => ({ ...current, recordedAt: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Catatan" htmlFor="snapshot-note" hint="Opsional—misalnya setelah market close."><textarea id="snapshot-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className={cn(fieldControlStyles, "resize-none")} /></Field>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}</div><DialogActions saving={saving} onClose={onClose} label="Simpan snapshot" /></form></Dialog>; }

function Dialog({ title, eyebrow, description, saving, onClose, children }: { title: string; eyebrow: string; description: string; saving: boolean; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="investment-dialog-title" className="max-h-[calc(100svh-0.75rem)] w-full overflow-y-auto rounded-t-[28px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:max-w-xl sm:rounded-2xl"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p><h2 id="investment-dialog-title" className="mt-1 text-xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Tutup form investasi"><X className="h-5 w-5" /></Button></div>{children}</section></div>; }
function DialogActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) { return <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4"><Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">Batal</Button><Button type="submit" disabled={saving} className="flex-[1.4] sm:flex-none">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : label}</Button></div>; }
function InvestmentSkeleton() { return <div className="animate-pulse divide-y divide-slate-100">{[0, 1, 2].map((item) => <div key={item} className="h-20 bg-slate-50/60" />)}</div>; }
function formatIdr(value: number) { return `Rp${Math.abs(Number(value)).toLocaleString("id-ID")}`; }
function formatSignedIdr(value: number) { return `${value >= 0 ? "+" : "−"}${formatIdr(value)}`; }
function formatMoney(value: number, currency: string) { return currency === "IDR" ? formatIdr(Number(value)) : `${currency} ${Number(value).toLocaleString("id-ID", { maximumFractionDigits: 4 })}`; }
