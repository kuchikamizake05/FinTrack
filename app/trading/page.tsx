"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { BrainCircuit, Camera, CheckCircle2, Loader2, Plus, Search, Target, TrendingDown, TrendingUp, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import TradingAnalytics from "@/components/TradingAnalytics";
import TradingInsights from "@/components/TradingInsights";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import { calculateForexRMultiple, calculateTradingJournalMetrics, filterForexTrades, validateForexTradeForm } from "@/lib/trading";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Account = { id: string; name: string; currency: string };
type Trade = {
  id: string; account_id: string; symbol: string; direction: "long" | "short"; status: "open" | "closed" | "cancelled";
  opened_at: string; closed_at: string | null; lot_size: number; entry_price: number; exit_price: number | null; stop_loss: number | null;
  take_profit: number | null; risk_amount: number | null; gross_pnl: number; commission: number; swap: number; net_pnl: number; currency: string;
  setup_tag: string | null; thesis: string | null; emotion: string | null; lesson: string | null;
};
type Snapshot = { id: string; account_id: string; recorded_at: string; equity: number; currency: string; note: string | null };
type TradeStatusFilter = "all" | Trade["status"];

function nowLocal() { return new Date().toISOString().slice(0, 16); }
function createTradeForm(accountId = "") { return { accountId, symbol: "", direction: "long" as "long" | "short", status: "open" as "open" | "closed", lotSize: "", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "", riskAmount: "", grossPnl: "0", commission: "0", swap: "0", openedAt: nowLocal(), closedAt: nowLocal(), setupTag: "", thesis: "", emotion: "", lesson: "" }; }
function createSnapshotForm(accountId = "") { return { accountId, equity: "", recordedAt: nowLocal(), note: "" }; }
const asNullableNumber = (value: string) => value.trim() === "" ? null : Number(value);

export default function TradingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [form, setForm] = useState(createTradeForm);
  const [snapshotForm, setSnapshotForm] = useState(createSnapshotForm);
  const [requestingReviewId, setRequestingReviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"journal" | "reviews">("journal");
  const [statusFilter, setStatusFilter] = useState<TradeStatusFilter>("all");
  const [search, setSearch] = useState("");
  const symbolRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountResult, tradeResult, snapshotResult] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency").eq("user_id", user.id).eq("kind", "trading").eq("is_active", true).order("name"),
        supabase.from("forex_trades").select("id, account_id, symbol, direction, status, opened_at, closed_at, lot_size, entry_price, exit_price, stop_loss, take_profit, risk_amount, gross_pnl, commission, swap, net_pnl, currency, setup_tag, thesis, emotion, lesson").eq("user_id", user.id).order("opened_at", { ascending: false }),
        supabase.from("account_equity_snapshots").select("id, account_id, recorded_at, equity, currency, note, financial_accounts!inner(kind)").eq("user_id", user.id).eq("financial_accounts.kind", "trading").order("recorded_at", { ascending: true }),
      ]);
      if (accountResult.error) throw accountResult.error;
      if (tradeResult.error) throw tradeResult.error;
      if (snapshotResult.error) throw snapshotResult.error;
      setAccounts((accountResult.data ?? []) as Account[]);
      setTrades((tradeResult.data ?? []) as Trade[]);
      setSnapshots((snapshotResult.data ?? []) as Snapshot[]);
    } catch (error) {
      reportHandledError("Trading journal unavailable", error, "Jurnal trading belum berhasil dimuat.");
      setPageError("Jurnal trading belum berhasil dimuat. Coba lagi beberapa saat lagi.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  useEffect(() => {
    if (!tradeOpen && !snapshotOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = tradeOpen ? window.setTimeout(() => symbolRef.current?.focus(), 80) : undefined;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) { setTradeOpen(false); setSnapshotOpen(false); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; if (timer) window.clearTimeout(timer); window.removeEventListener("keydown", closeOnEscape); };
  }, [saving, snapshotOpen, tradeOpen]);

  const metrics = useMemo(() => calculateTradingJournalMetrics(trades), [trades]);
  const filteredTrades = useMemo(() => filterForexTrades(trades, { status: statusFilter, search }), [search, statusFilter, trades]);
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);

  function openTradeForm() { setForm(createTradeForm(accounts[0]?.id ?? "")); setFormError(null); setTradeOpen(true); }
  function openSnapshotForm() { setSnapshotForm(createSnapshotForm(accounts[0]?.id ?? "")); setFormError(null); setSnapshotOpen(true); }

  async function saveTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateForexTradeForm(form);
    if (validation) { setFormError(validation); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === form.accountId);
      const { error } = await supabase.from("forex_trades").insert({
        user_id: user.id, account_id: form.accountId, symbol: form.symbol.trim().toUpperCase(), direction: form.direction, status: form.status,
        opened_at: new Date(form.openedAt).toISOString(), closed_at: form.status === "closed" ? new Date(form.closedAt).toISOString() : null,
        lot_size: Number(form.lotSize), entry_price: Number(form.entryPrice), exit_price: asNullableNumber(form.exitPrice), stop_loss: asNullableNumber(form.stopLoss), take_profit: asNullableNumber(form.takeProfit), risk_amount: asNullableNumber(form.riskAmount), gross_pnl: Number(form.grossPnl), commission: Number(form.commission), swap: Number(form.swap), currency: account?.currency ?? "USD", setup_tag: form.setupTag.trim() || null, thesis: form.thesis.trim() || null, emotion: form.emotion.trim() || null, lesson: form.lesson.trim() || null,
      });
      if (error) throw error;
      setTradeOpen(false); await loadData();
    } catch (error) { reportHandledError("Trade save failed", error, "Trade belum berhasil disimpan."); setFormError("Trade belum berhasil disimpan. Coba lagi."); }
    finally { setSaving(false); }
  }

  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const equity = Number(snapshotForm.equity);
    if (!snapshotForm.accountId || !snapshotForm.recordedAt || !Number.isFinite(equity) || equity < 0) { setFormError("Pilih akun, waktu, dan masukkan equity yang valid."); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === snapshotForm.accountId);
      const { error } = await supabase.from("account_equity_snapshots").insert({ user_id: user.id, account_id: snapshotForm.accountId, equity, currency: account?.currency ?? "USD", recorded_at: new Date(snapshotForm.recordedAt).toISOString(), note: snapshotForm.note.trim() || null });
      if (error) throw error;
      setSnapshotOpen(false); await loadData();
    } catch (error) { reportHandledError("Trading snapshot save failed", error, "Snapshot belum berhasil disimpan."); setFormError("Snapshot belum berhasil disimpan. Coba lagi."); }
    finally { setSaving(false); }
  }

  async function requestAiReview(tradeId: string) {
    setRequestingReviewId(tradeId); setPageError(null); setReviewMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
      const response = await fetch(`/api/trades/${tradeId}/review`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Review belum dapat diminta.");
      setReviewMessage("Permintaan review diterima. Hasil akan muncul di tab Review setelah workflow selesai.");
    } catch (error) { setPageError(error instanceof Error ? error.message : "Review belum dapat diminta."); }
    finally { setRequestingReviewId(null); }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main className="app-page-content space-y-5 sm:space-y-6">
        <PageHeader eyebrow="Trading journal" title="Trading" description="Rekam rencana, risiko, hasil, dan refleksi. Review AI tetap advisory dan tidak pernah mengubah jurnal." actions={activeTab === "journal" ? <><Button variant="secondary" onClick={openSnapshotForm} disabled={!accounts.length}><Camera className="h-4 w-4" /> Update equity</Button><Button onClick={openTradeForm} disabled={!accounts.length}><Plus className="h-4 w-4" /> Catat trade</Button></> : undefined} />

        <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Bagian trading"><button type="button" role="tab" aria-selected={activeTab === "journal"} onClick={() => setActiveTab("journal")} className={cn("min-h-10 rounded-lg px-4 text-sm font-bold transition", activeTab === "journal" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>Jurnal & statistik</button><button type="button" role="tab" aria-selected={activeTab === "reviews"} onClick={() => setActiveTab("reviews")} className={cn("min-h-10 rounded-lg px-4 text-sm font-bold transition", activeTab === "reviews" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>Review</button></div>

        {pageError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{pageError}</span><Button variant="secondary" size="compact" onClick={() => void loadData()}>Coba lagi</Button></div>}
        {reviewMessage && <div role="status" className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {reviewMessage}</span><Button variant="secondary" size="compact" onClick={() => setActiveTab("reviews")}>Buka Review</Button></div>}

        {activeTab === "reviews" ? <TradingInsights /> : (
          <div className="space-y-6">
            {!loading && accounts.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Tambahkan akun bertipe Trading terlebih dahulu di <Link href="/accounts" className="font-bold underline underline-offset-2">Akun & saldo</Link>.</div>}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan trading"><TradeMetric label="Trade terbuka" value={String(metrics.open)} hint="Posisi yang belum ditutup" icon={Target} /><TradeMetric label="Win rate" value={`${metrics.winRate.toFixed(0)}%`} hint={`Dari ${metrics.closed} trade tertutup`} icon={TrendingUp} /><TradeMetric label="P/L tertutup" value={`${metrics.pnl >= 0 ? "+" : "−"}$${Math.abs(metrics.pnl).toLocaleString("en-US")}`} hint="Sesuai mata uang akun" icon={metrics.pnl >= 0 ? TrendingUp : TrendingDown} tone={metrics.pnl >= 0 ? "text-emerald-700" : "text-rose-700"} /><TradeMetric label="R rata-rata" value={metrics.averageR === null ? "Belum ada" : `${metrics.averageR.toFixed(2)}R`} hint="Hasil dibanding risiko awal" icon={BrainCircuit} /></section>
            {!loading && <TradingAnalytics trades={trades} snapshots={snapshots} currency={accounts[0]?.currency ?? "USD"} />}

            <Surface className="overflow-hidden">
              <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-bold">Trade journal</h2><p className="mt-1 text-xs text-slate-500">Semua posisi, rencana, dan refleksi dalam urutan terbaru.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="flex overflow-x-auto rounded-xl bg-slate-100 p-1">{(["all", "open", "closed", "cancelled"] as const).map((status) => <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={cn("min-h-10 shrink-0 rounded-lg px-3 text-xs font-bold", statusFilter === status ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{status === "all" ? "Semua" : status === "open" ? "Terbuka" : status === "closed" ? "Tertutup" : "Dibatalkan"}</button>)}</div><label className="relative" htmlFor="trade-search"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">Cari pair atau setup</span><input id="trade-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari pair atau setup" className={cn(fieldControlStyles, "pl-10 sm:w-64")} /></label></div></div></div>
              {loading ? <TradeSkeleton /> : filteredTrades.length === 0 ? <EmptyState icon={trades.length ? Search : Target} title={trades.length ? "Trade tidak ditemukan" : "Journal masih kosong"} description={trades.length ? "Coba filter status atau kata kunci lain." : "Catat trade pertama lengkap dengan risiko dan alasan entry."} action={!trades.length && accounts.length ? <Button onClick={openTradeForm}><Plus className="h-4 w-4" /> Catat trade</Button> : undefined} /> : <div className="divide-y divide-slate-100">{filteredTrades.map((trade) => <TradeRow key={trade.id} trade={trade} accountName={accountNames.get(trade.account_id)} requesting={requestingReviewId === trade.id} onReview={() => void requestAiReview(trade.id)} />)}</div>}
            </Surface>
          </div>
        )}
      </main>

      {tradeOpen && <TradeDialog accounts={accounts} form={form} setForm={setForm} saving={saving} error={formError} symbolRef={symbolRef} onClose={() => !saving && setTradeOpen(false)} onSubmit={saveTrade} />}
      {snapshotOpen && <SnapshotDialog accounts={accounts} form={snapshotForm} setForm={setSnapshotForm} saving={saving} error={formError} onClose={() => !saving && setSnapshotOpen(false)} onSubmit={saveSnapshot} />}
    </div>
  );
}

function TradeMetric({ label, value, hint, icon: Icon, tone = "text-slate-900" }: { label: string; value: string; hint: string; icon: typeof Target; tone?: string }) { return <Surface className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className={cn("mt-2 text-xl font-bold tracking-tight", tone)}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span></div></Surface>; }

function TradeRow({ trade, accountName, requesting, onReview }: { trade: Trade; accountName?: string; requesting: boolean; onReview: () => void }) {
  const rMultiple = calculateForexRMultiple({ netPnl: Number(trade.net_pnl), riskAmount: Number(trade.risk_amount) });
  const positive = Number(trade.net_pnl) >= 0;
  return <article className="p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex min-w-0 gap-3"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-mono text-lg font-bold">{trade.symbol}</h3><Badge>{trade.direction === "long" ? "Long" : "Short"}</Badge><StatusBadge status={trade.status} /></div><p className="mt-1 text-xs text-slate-500">{format(parseISO(trade.opened_at), "dd MMM yyyy", { locale: idLocale })} · {Number(trade.lot_size).toLocaleString("id-ID")} lot · {accountName ?? "Akun trading"}</p></div></div><div className="sm:text-right"><p className={cn("font-mono text-lg font-bold", positive ? "text-emerald-700" : "text-rose-700")}>{positive ? "+" : "−"}{trade.currency} {Math.abs(Number(trade.net_pnl)).toLocaleString("en-US")}</p><p className="mt-1 text-xs text-slate-400">{rMultiple === null ? "Risiko belum dicatat" : `${rMultiple.toFixed(2)}R`}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4"><TradeFact label="Entry" value={Number(trade.entry_price).toLocaleString("en-US")} /><TradeFact label="Stop loss" value={trade.stop_loss ? Number(trade.stop_loss).toLocaleString("en-US") : "—"} /><TradeFact label="Take profit" value={trade.take_profit ? Number(trade.take_profit).toLocaleString("en-US") : "—"} /><TradeFact label="Setup" value={trade.setup_tag || "Belum dicatat"} /></div>{(trade.thesis || trade.emotion || trade.lesson) && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3">{trade.thesis && <Reflection label="Tesis" value={trade.thesis} />}{trade.emotion && <Reflection label="Emosi" value={trade.emotion} />}{trade.lesson && <Reflection label="Pelajaran" value={trade.lesson} />}</div>}<div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-xs text-slate-500"><BrainCircuit className="h-4 w-4 text-emerald-700" /> Review tersimpan terpisah dari jurnal.</span><Button variant="secondary" size="compact" onClick={onReview} disabled={requesting}>{requesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Meminta...</> : <><BrainCircuit className="h-3.5 w-3.5" /> Minta review</>}</Button></div></article>;
}

function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{children}</span>; }
function StatusBadge({ status }: { status: Trade["status"] }) { const style = status === "open" ? "bg-amber-50 text-amber-700" : status === "closed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"; return <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", style)}>{status === "open" ? "Terbuka" : status === "closed" ? "Tertutup" : "Dibatalkan"}</span>; }
function TradeFact({ label, value }: { label: string; value: string }) { return <div><p className="text-slate-400">{label}</p><p className="mt-1 truncate font-semibold text-slate-700">{value}</p></div>; }
function Reflection({ label, value }: { label: string; value: string }) { return <div><p className="font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="mt-1 leading-5 text-slate-600">{value}</p></div>; }

function TradeDialog({ accounts, form, setForm, saving, error, symbolRef, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createTradeForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createTradeForm>>>; saving: boolean; error: string | null; symbolRef: React.RefObject<HTMLInputElement | null>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  return <Dialog title="Catat trade" eyebrow="Trade plan & review" description="Simpan rencana sebelum hasil agar evaluasi tetap jujur." saving={saving} onClose={onClose} wide><form onSubmit={onSubmit}><div className="space-y-5 px-5 py-5 sm:px-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Akun trading" htmlFor="trade-account"><select id="trade-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field><Field label="Pair / simbol" htmlFor="trade-symbol"><input ref={symbolRef} id="trade-symbol" required maxLength={16} value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} placeholder="EURUSD" className={fieldControlStyles} /></Field></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Arah" htmlFor="trade-direction"><select id="trade-direction" value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as "long" | "short" }))} className={fieldControlStyles}><option value="long">Long / buy</option><option value="short">Short / sell</option></select></Field><Field label="Status" htmlFor="trade-status"><select id="trade-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "open" | "closed" }))} className={fieldControlStyles}><option value="open">Masih terbuka</option><option value="closed">Sudah tertutup</option></select></Field><Field label="Ukuran lot" htmlFor="trade-lot"><input id="trade-lot" type="number" min="0.000001" step="any" required value={form.lotSize} onChange={(event) => setForm((current) => ({ ...current, lotSize: event.target.value }))} className={fieldControlStyles} /></Field></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Harga entry" htmlFor="trade-entry"><input id="trade-entry" type="number" min="0.00000001" step="any" required value={form.entryPrice} onChange={(event) => setForm((current) => ({ ...current, entryPrice: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Stop loss" htmlFor="trade-stop"><input id="trade-stop" type="number" min="0.00000001" step="any" value={form.stopLoss} onChange={(event) => setForm((current) => ({ ...current, stopLoss: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Take profit" htmlFor="trade-target"><input id="trade-target" type="number" min="0.00000001" step="any" value={form.takeProfit} onChange={(event) => setForm((current) => ({ ...current, takeProfit: event.target.value }))} className={fieldControlStyles} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Risiko awal" htmlFor="trade-risk" hint="Dalam mata uang akun."><input id="trade-risk" type="number" min="0.00000001" step="any" value={form.riskAmount} onChange={(event) => setForm((current) => ({ ...current, riskAmount: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Waktu buka" htmlFor="trade-opened"><input id="trade-opened" type="datetime-local" required value={form.openedAt} onChange={(event) => setForm((current) => ({ ...current, openedAt: event.target.value }))} className={fieldControlStyles} /></Field></div>{form.status === "closed" && <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">Hasil penutupan</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Harga exit" htmlFor="trade-exit"><input id="trade-exit" type="number" min="0.00000001" step="any" required value={form.exitPrice} onChange={(event) => setForm((current) => ({ ...current, exitPrice: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Waktu tutup" htmlFor="trade-closed"><input id="trade-closed" type="datetime-local" required value={form.closedAt} onChange={(event) => setForm((current) => ({ ...current, closedAt: event.target.value }))} className={fieldControlStyles} /></Field></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Gross P/L" htmlFor="trade-gross"><input id="trade-gross" type="number" step="any" value={form.grossPnl} onChange={(event) => setForm((current) => ({ ...current, grossPnl: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Komisi" htmlFor="trade-commission"><input id="trade-commission" type="number" min="0" step="any" value={form.commission} onChange={(event) => setForm((current) => ({ ...current, commission: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Swap" htmlFor="trade-swap"><input id="trade-swap" type="number" step="any" value={form.swap} onChange={(event) => setForm((current) => ({ ...current, swap: event.target.value }))} className={fieldControlStyles} /></Field></div></div>}<Field label="Setup" htmlFor="trade-setup"><input id="trade-setup" value={form.setupTag} onChange={(event) => setForm((current) => ({ ...current, setupTag: event.target.value }))} placeholder="Contoh: London breakout" className={fieldControlStyles} /></Field><Field label="Tesis entry" htmlFor="trade-thesis"><textarea id="trade-thesis" rows={3} value={form.thesis} onChange={(event) => setForm((current) => ({ ...current, thesis: event.target.value }))} placeholder="Apa yang membuat setup ini valid?" className={cn(fieldControlStyles, "resize-none")} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Emosi saat entry" htmlFor="trade-emotion"><input id="trade-emotion" value={form.emotion} onChange={(event) => setForm((current) => ({ ...current, emotion: event.target.value }))} placeholder="Tenang, ragu, FOMO..." className={fieldControlStyles} /></Field><Field label="Pelajaran" htmlFor="trade-lesson"><input id="trade-lesson" value={form.lesson} onChange={(event) => setForm((current) => ({ ...current, lesson: event.target.value }))} placeholder="Opsional" className={fieldControlStyles} /></Field></div>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}</div><DialogActions saving={saving} onClose={onClose} label="Simpan trade" /></form></Dialog>;
}

function SnapshotDialog({ accounts, form, setForm, saving, error, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createSnapshotForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createSnapshotForm>>>; saving: boolean; error: string | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) { return <Dialog title="Update equity" eyebrow="Trading snapshot" description="Masukkan total equity termasuk saldo dan floating P/L." saving={saving} onClose={onClose}><form onSubmit={onSubmit}><div className="space-y-4 px-5 py-5 sm:px-6"><Field label="Akun trading" htmlFor="trading-snapshot-account"><select id="trading-snapshot-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field><Field label="Total equity" htmlFor="trading-snapshot-equity"><input id="trading-snapshot-equity" type="number" min="0" step="any" required value={form.equity} onChange={(event) => setForm((current) => ({ ...current, equity: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "text-lg font-bold")} /></Field><Field label="Waktu pencatatan" htmlFor="trading-snapshot-time"><input id="trading-snapshot-time" type="datetime-local" required value={form.recordedAt} onChange={(event) => setForm((current) => ({ ...current, recordedAt: event.target.value }))} className={fieldControlStyles} /></Field><Field label="Catatan" htmlFor="trading-snapshot-note"><textarea id="trading-snapshot-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className={cn(fieldControlStyles, "resize-none")} /></Field>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}</div><DialogActions saving={saving} onClose={onClose} label="Simpan snapshot" /></form></Dialog>; }

function Dialog({ title, eyebrow, description, saving, onClose, wide = false, children }: { title: string; eyebrow: string; description: string; saving: boolean; onClose: () => void; wide?: boolean; children: React.ReactNode }) { return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="trading-dialog-title" className={cn("max-h-[calc(100svh-0.75rem)] w-full overflow-y-auto rounded-t-[28px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:rounded-2xl", wide ? "sm:max-w-2xl" : "sm:max-w-xl")}><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p><h2 id="trading-dialog-title" className="mt-1 text-xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Tutup form trading"><X className="h-5 w-5" /></Button></div>{children}</section></div>; }
function DialogActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) { return <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4"><Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">Batal</Button><Button type="submit" disabled={saving} className="flex-[1.4] sm:flex-none">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : label}</Button></div>; }
function TradeSkeleton() { return <div className="animate-pulse divide-y divide-slate-100">{[0, 1, 2].map((item) => <div key={item} className="h-40 bg-slate-50/60" />)}</div>; }
