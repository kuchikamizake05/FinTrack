"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { BrainCircuit, CheckCircle2, History, Loader2, Plus, Search, Target, TrendingDown, TrendingUp, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { useLanguage } from "@/components/LanguageProvider";
import TradingAnalytics from "@/components/TradingAnalytics";
import TradingInsights from "@/components/TradingInsights";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import { calculateForexRMultiple, calculateTradingJournalMetrics, filterForexTrades, filterForexTradesByCurrency, validateForexTradeForm } from "@/lib/trading";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { formatLocalDateTime } from "@/lib/planning";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { cn } from "@/lib/utils";

type Account = { id: string; name: string; currency: string; is_active: boolean };
type Trade = {
  id: string; account_id: string; symbol: string; direction: "long" | "short"; status: "open" | "closed" | "cancelled";
  opened_at: string; closed_at: string | null; lot_size: number; entry_price: number; exit_price: number | null; stop_loss: number | null;
  take_profit: number | null; risk_amount: number | null; gross_pnl: number; commission: number; swap: number; net_pnl: number; currency: string;
  setup_tag: string | null; thesis: string | null; emotion: string | null; lesson: string | null;
};
type Snapshot = { id: string; account_id: string; recorded_at: string; equity: number; currency: string; note: string | null };
type TradeStatusFilter = "all" | Trade["status"];

function nowLocal() { return formatLocalDateTime(new Date()); }
function createTradeForm(accountId = "") { return { accountId, symbol: "", direction: "long" as "long" | "short", status: "open" as "open" | "closed", lotSize: "", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "", riskAmount: "", grossPnl: "0", commission: "0", swap: "0", openedAt: nowLocal(), closedAt: nowLocal(), setupTag: "", thesis: "", emotion: "", lesson: "" }; }
function createSnapshotForm(accountId = "") { return { accountId, equity: "", recordedAt: nowLocal(), note: "" }; }
const asNullableNumber = (value: string) => value.trim() === "" ? null : Number(value);

export default function TradingPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : idLocale;
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
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<Snapshot | null>(null);
  const [recordAction, setRecordAction] = useState<{ kind: "trade" | "snapshot"; id: string; action: "delete" | "cancel" } | null>(null);
  const [form, setForm] = useState(createTradeForm);
  const [snapshotForm, setSnapshotForm] = useState(createSnapshotForm);
  const [requestingReviewId, setRequestingReviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"journal" | "reviews">("journal");
  const [statusFilter, setStatusFilter] = useState<TradeStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const symbolRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountResult, tradeResult, snapshotResult] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency, is_active").eq("user_id", user.id).eq("kind", "trading").order("is_active", { ascending: false }).order("name"),
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
      setPageError(t("Jurnal trading belum berhasil dimuat. Coba lagi beberapa saat lagi."));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);
  const currencies = useMemo(() => [...new Set([
    ...accounts.map((account) => account.currency),
    ...trades.map((trade) => trade.currency),
    ...snapshots.map((snapshot) => snapshot.currency),
  ])].sort(), [accounts, snapshots, trades]);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? "USD";
  const currencyTrades = useMemo(() => filterForexTradesByCurrency(trades, currency), [currency, trades]);
  const currencySnapshots = useMemo(() => snapshots.filter((snapshot) => snapshot.currency === currency), [currency, snapshots]);
  const metrics = useMemo(() => calculateTradingJournalMetrics(currencyTrades), [currencyTrades]);
  const filteredTrades = useMemo(() => filterForexTrades(currencyTrades, { status: statusFilter, search }), [currencyTrades, search, statusFilter]);
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);

  function openTradeForm() { setEditingTrade(null); setForm(createTradeForm(activeAccounts[0]?.id ?? "")); setFormError(null); setTradeOpen(true); }
  function openSnapshotForm() { setEditingSnapshot(null); setSnapshotForm(createSnapshotForm(activeAccounts[0]?.id ?? "")); setFormError(null); setSnapshotOpen(true); }
  function editTrade(trade: Trade, status: "open" | "closed" = trade.status === "closed" ? "closed" : "open") {
    setEditingTrade(trade);
    setForm({ accountId: trade.account_id, symbol: trade.symbol, direction: trade.direction, status, lotSize: String(trade.lot_size), entryPrice: String(trade.entry_price), exitPrice: trade.exit_price === null ? "" : String(trade.exit_price), stopLoss: trade.stop_loss === null ? "" : String(trade.stop_loss), takeProfit: trade.take_profit === null ? "" : String(trade.take_profit), riskAmount: trade.risk_amount === null ? "" : String(trade.risk_amount), grossPnl: String(trade.gross_pnl), commission: String(trade.commission), swap: String(trade.swap), openedAt: formatLocalDateTime(new Date(trade.opened_at)), closedAt: trade.closed_at ? formatLocalDateTime(new Date(trade.closed_at)) : nowLocal(), setupTag: trade.setup_tag ?? "", thesis: trade.thesis ?? "", emotion: trade.emotion ?? "", lesson: trade.lesson ?? "" });
    setFormError(null); setTradeOpen(true);
  }
  function editSnapshot(snapshot: Snapshot) {
    setEditingSnapshot(snapshot);
    setSnapshotForm({ accountId: snapshot.account_id, equity: String(snapshot.equity), recordedAt: formatLocalDateTime(new Date(snapshot.recorded_at)), note: snapshot.note ?? "" });
    setFormError(null); setSnapshotOpen(true);
  }

  async function saveTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const validation = validateForexTradeForm(form);
    if (validation) { setFormError(t(validation)); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === form.accountId);
      const record = {
        account_id: form.accountId, symbol: form.symbol.trim().toUpperCase(), direction: form.direction, status: form.status,
        opened_at: new Date(form.openedAt).toISOString(), closed_at: form.status === "closed" ? new Date(form.closedAt).toISOString() : null,
        lot_size: Number(form.lotSize), entry_price: Number(form.entryPrice), exit_price: form.status === "closed" ? asNullableNumber(form.exitPrice) : null, stop_loss: asNullableNumber(form.stopLoss), take_profit: asNullableNumber(form.takeProfit), risk_amount: asNullableNumber(form.riskAmount), gross_pnl: form.status === "closed" ? Number(form.grossPnl) : 0, commission: form.status === "closed" ? Number(form.commission) : 0, swap: form.status === "closed" ? Number(form.swap) : 0, currency: account?.currency ?? "USD", setup_tag: form.setupTag.trim() || null, thesis: form.thesis.trim() || null, emotion: form.emotion.trim() || null, lesson: form.lesson.trim() || null,
      };
      const { error } = editingTrade
        ? await supabase.from("forex_trades").update(record).eq("id", editingTrade.id).eq("user_id", user.id)
        : await supabase.from("forex_trades").insert({ user_id: user.id, ...record });
      if (error) throw error;
      setTradeOpen(false); setEditingTrade(null); await loadData();
    } catch (error) { reportHandledError("Trade save failed", error, "Trade belum berhasil disimpan."); setFormError(t("Trade belum berhasil disimpan. Coba lagi.")); }
    finally { setSaving(false); }
  }

  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const equity = Number(snapshotForm.equity);
    if (!snapshotForm.accountId || !snapshotForm.recordedAt || !Number.isFinite(equity) || equity < 0) { setFormError(t("Pilih akun, waktu, dan masukkan equity yang valid.")); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === snapshotForm.accountId);
      const record = { account_id: snapshotForm.accountId, equity, currency: account?.currency ?? "USD", recorded_at: new Date(snapshotForm.recordedAt).toISOString(), note: snapshotForm.note.trim() || null };
      const { error } = editingSnapshot
        ? await supabase.from("account_equity_snapshots").update(record).eq("id", editingSnapshot.id).eq("user_id", user.id)
        : await supabase.from("account_equity_snapshots").insert({ user_id: user.id, ...record });
      if (error) throw error;
      setSnapshotOpen(false); setEditingSnapshot(null); await loadData();
    } catch (error) { reportHandledError("Trading snapshot save failed", error, "Snapshot belum berhasil disimpan."); setFormError(t("Snapshot belum berhasil disimpan. Coba lagi.")); }
    finally { setSaving(false); }
  }

  async function applyRecordAction() {
    if (!recordAction) return;
    if (!canWriteOnline()) { setFormError(t(offlineWriteMessage)); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const table = recordAction.kind === "trade" ? "forex_trades" : "account_equity_snapshots";
      const query = recordAction.action === "delete"
        ? supabase.from(table).delete().eq("id", recordAction.id).eq("user_id", user.id)
        : supabase.from("forex_trades").update({ status: "cancelled", closed_at: null, exit_price: null, gross_pnl: 0, commission: 0, swap: 0 }).eq("id", recordAction.id).eq("user_id", user.id);
      const { error } = await query;
      if (error) throw error;
      setRecordAction(null); await loadData();
    } catch (error) {
      reportHandledError("Trading journal action failed", error, "Catatan belum berhasil diperbarui.");
      setFormError(t("Catatan belum berhasil diperbarui. Coba lagi."));
    } finally { setSaving(false); }
  }

  async function requestAiReview(tradeId: string) {
    if (!canWriteOnline()) {
      setPageError(t(offlineWriteMessage));
      return;
    }
    setRequestingReviewId(tradeId); setPageError(null); setReviewMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
      const response = await fetch(`/api/trades/${tradeId}/review`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Review belum dapat diminta.");
      setReviewMessage(t("Permintaan review diterima. Hasil akan muncul di tab Review setelah workflow selesai."));
    } catch (error) {
      reportHandledError("Trade review request failed", error, "Review belum dapat diminta.");
      setPageError(t("Review belum dapat diminta. Coba lagi saat koneksi tersedia."));
    }
    finally { setRequestingReviewId(null); }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content space-y-5 outline-none sm:space-y-6">
        <div className="space-y-4">
          <PageHeader
            eyebrow={t("Trading journal")}
            title={t("Trading")}
            description={t("Rekam rencana, risiko, hasil, dan refleksi. Review AI tetap advisory dan tidak pernah mengubah jurnal.")}
          />

          <PortfolioTabs />

          {activeTab === "journal" && (
            <div role="group" aria-label={t("Aksi trading")} className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={openSnapshotForm} disabled={!activeAccounts.length} className="w-full sm:w-auto">
                <History className="h-4 w-4" /> {t("Update equity")}
              </Button>
              <Button onClick={openTradeForm} disabled={!activeAccounts.length} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" /> {t("Catat trade")}
              </Button>
            </div>
          )}
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label={t("Bagian trading")}><button id="trading-tab-journal" type="button" role="tab" aria-controls="trading-panel-journal" aria-selected={activeTab === "journal"} tabIndex={activeTab === "journal" ? 0 : -1} onClick={() => setActiveTab("journal")} className={cn("min-h-10 rounded-lg px-4 text-sm font-bold transition", activeTab === "journal" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{t("Jurnal & statistik")}</button><button id="trading-tab-reviews" type="button" role="tab" aria-controls="trading-panel-reviews" aria-selected={activeTab === "reviews"} tabIndex={activeTab === "reviews" ? 0 : -1} onClick={() => setActiveTab("reviews")} className={cn("min-h-10 rounded-lg px-4 text-sm font-bold transition", activeTab === "reviews" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{t("Review")}</button></div>

        {pageError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{pageError}</span><Button variant="secondary" size="compact" onClick={() => void loadData()}>{t("Coba lagi")}</Button></div>}
        {reviewMessage && <div role="status" className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {reviewMessage}</span><Button variant="secondary" size="compact" onClick={() => setActiveTab("reviews")}>{t("Buka Review")}</Button></div>}

        {activeTab === "reviews" ? <div id="trading-panel-reviews" role="tabpanel" aria-labelledby="trading-tab-reviews"><TradingInsights /></div> : (
          <div id="trading-panel-journal" role="tabpanel" aria-labelledby="trading-tab-journal" className="space-y-6">
            {!loading && activeAccounts.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{t("Tambahkan akun bertipe Trading terlebih dahulu di ")}<Link href="/accounts" className="font-bold underline underline-offset-2">{t("Akun & saldo")}</Link>.</div>}
            {currencies.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Pilih mata uang trading")}>
                <span className="text-xs font-bold text-slate-500">{t("Mata uang")}</span>
                {currencies.map((item) => <Button key={item} variant={currency === item ? "secondary" : "ghost"} size="compact" onClick={() => setSelectedCurrency(item)} aria-pressed={currency === item}>{item}</Button>)}
              </div>
            )}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("Ringkasan trading")}><TradeMetric label={t("Trade terbuka")} value={String(metrics.open)} hint={t("Posisi yang belum ditutup")} icon={Target} /><TradeMetric label={t("Win rate")} value={`${metrics.winRate.toFixed(0)}%`} hint={t("Dari {count} trade tertutup", { count: metrics.closed })} icon={TrendingUp} /><TradeMetric label={t("P/L tertutup")} value={formatSignedMoney(metrics.pnl, currency)} hint={t("Sesuai mata uang akun")} icon={metrics.pnl >= 0 ? TrendingUp : TrendingDown} tone={metrics.pnl >= 0 ? "text-emerald-700" : "text-rose-700"} /><TradeMetric label={t("R rata-rata")} value={metrics.averageR === null ? t("Belum ada") : `${metrics.averageR.toFixed(2)}R`} hint={t("Hasil dibanding risiko awal")} icon={BrainCircuit} /></section>
            {!loading && <TradingAnalytics trades={currencyTrades} snapshots={currencySnapshots} currency={currency} />}

            <Surface className="overflow-hidden">
              <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-bold">{t("Trade journal")}</h2><p className="mt-1 text-xs text-slate-500">{t("Semua posisi, rencana, dan refleksi dalam urutan terbaru.")}</p></div><div className="flex flex-col gap-2 sm:flex-row"><div role="group" aria-label={t("Filter status trade")} className="flex overflow-x-auto rounded-xl bg-slate-100 p-1">{(["all", "open", "closed", "cancelled"] as const).map((status) => <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={cn("min-h-10 shrink-0 rounded-lg px-3 text-xs font-bold", statusFilter === status ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{status === "all" ? t("Semua") : status === "open" ? t("Terbuka") : status === "closed" ? t("Tertutup") : t("Dibatalkan")}</button>)}</div><label className="relative" htmlFor="trade-search"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">{t("Cari pair atau setup")}</span><input id="trade-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Cari pair atau setup")} className={cn(fieldControlStyles, "pl-10 sm:w-64")} /></label></div></div></div>
              {loading ? <TradeSkeleton /> : filteredTrades.length === 0 ? <EmptyState icon={currencyTrades.length ? Search : Target} title={currencyTrades.length ? t("Trade tidak ditemukan") : t("Journal masih kosong")} description={currencyTrades.length ? t("Coba filter status atau kata kunci lain.") : t("Catat trade pertama lengkap dengan risiko dan alasan entry.")} action={!currencyTrades.length && activeAccounts.length ? <Button onClick={openTradeForm}><Plus className="h-4 w-4" /> {t("Catat trade")}</Button> : undefined} /> : <div className="divide-y divide-slate-100">{filteredTrades.map((trade) => <TradeRow key={trade.id} trade={trade} accountName={accountNames.get(trade.account_id)} requesting={requestingReviewId === trade.id} onReview={() => void requestAiReview(trade.id)} onEdit={() => editTrade(trade)} onClose={() => editTrade(trade, "closed")} onCancel={() => { setFormError(null); setRecordAction({ kind: "trade", id: trade.id, action: "cancel" }); }} onDelete={() => { setFormError(null); setRecordAction({ kind: "trade", id: trade.id, action: "delete" }); }} dateLocale={dateLocale} />)}</div>}
            </Surface>

            <Surface className="overflow-hidden">
              <div className="border-b border-emerald-100 px-4 py-4 sm:px-5"><h2 className="text-base font-bold">{t("Riwayat equity")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("Koreksi snapshot bila nilai atau waktu tercatat keliru.")}</p></div>
              {loading ? <TradeSkeleton /> : currencySnapshots.length === 0 ? <EmptyState icon={History} title={t("Belum ada snapshot")} description={t("Catat equity pertama untuk menyimpan riwayat trading.")} action={activeAccounts.length ? <Button variant="secondary" onClick={openSnapshotForm}><History className="h-4 w-4" /> {t("Update equity")}</Button> : undefined} /> : <div className="divide-y divide-slate-100">{[...currencySnapshots].reverse().map((snapshot) => <article key={snapshot.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-bold">{formatSignedMoney(snapshot.equity, snapshot.currency).slice(1)}</p><p className="mt-1 text-xs text-slate-500">{format(parseISO(snapshot.recorded_at), "dd MMM yyyy, HH:mm", { locale: dateLocale })} · {accountNames.get(snapshot.account_id) ?? t("Akun trading")}</p>{snapshot.note && <p className="mt-1 text-xs leading-5 text-slate-600">{snapshot.note}</p>}</div><div className="flex gap-2"><Button variant="secondary" size="compact" onClick={() => editSnapshot(snapshot)}>{t("Edit")}</Button><Button variant="destructive" size="compact" onClick={() => { setFormError(null); setRecordAction({ kind: "snapshot", id: snapshot.id, action: "delete" }); }}>{t("Hapus")}</Button></div></article>)}</div>}
            </Surface>
          </div>
        )}
      </main>

      {tradeOpen && <TradeDialog accounts={editingTrade ? accounts : activeAccounts} form={form} setForm={setForm} saving={saving} error={formError} symbolRef={symbolRef} editing={Boolean(editingTrade)} onClose={() => !saving && setTradeOpen(false)} onSubmit={saveTrade} />}
      {snapshotOpen && <SnapshotDialog accounts={editingSnapshot ? accounts : activeAccounts} form={snapshotForm} setForm={setSnapshotForm} saving={saving} error={formError} editing={Boolean(editingSnapshot)} onClose={() => !saving && setSnapshotOpen(false)} onSubmit={saveSnapshot} />}
      {recordAction && <ConfirmDialog titleId="trading-action-title" descriptionId="trading-action-description" title={t(recordAction.action === "cancel" ? "Batalkan trade?" : recordAction.kind === "trade" ? "Hapus trade?" : "Hapus snapshot?")} description={t(recordAction.action === "cancel" ? "Trade akan ditandai dibatalkan dan hasil penutupan dihapus." : recordAction.kind === "trade" ? "Trade ini akan dihapus permanen dari jurnal." : "Snapshot ini akan dihapus permanen dari riwayat equity.")} confirmLabel={t(recordAction.action === "cancel" ? "Batalkan trade" : recordAction.kind === "trade" ? "Hapus trade" : "Hapus snapshot")} cancelLabel={t("Batal")} onClose={() => !saving && setRecordAction(null)} onConfirm={() => void applyRecordAction()} loading={saving} error={formError} />}
    </div>
  );
}

function TradeMetric({ label, value, hint, icon: Icon, tone = "text-slate-900" }: { label: string; value: string; hint: string; icon: typeof Target; tone?: string }) { return <Surface className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className={cn("mt-2 text-xl font-bold tracking-tight", tone)}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span></div></Surface>; }

function TradeRow({ trade, accountName, requesting, onReview, onEdit, onClose, onCancel, onDelete, dateLocale }: { trade: Trade; accountName?: string; requesting: boolean; onReview: () => void; onEdit: () => void; onClose: () => void; onCancel: () => void; onDelete: () => void; dateLocale: typeof idLocale }) {
  const { t } = useLanguage();
  const rMultiple = calculateForexRMultiple({ netPnl: Number(trade.net_pnl), riskAmount: Number(trade.risk_amount) });
  const positive = Number(trade.net_pnl) >= 0;
  return (
    <article className="p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-lg font-bold">{trade.symbol}</h3>
              <Badge>{trade.direction === "long" ? "Long" : "Short"}</Badge>
              <StatusBadge status={trade.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {format(parseISO(trade.opened_at), "dd MMM yyyy", { locale: dateLocale })} · {Number(trade.lot_size).toLocaleString("id-ID")} lot · {trade.account_id ? accountName ?? t("Akun trading") : t("Akun trading")}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className={cn("font-mono text-lg font-bold", positive ? "text-emerald-700" : "text-rose-700")}>
            {positive ? "+" : "−"}{trade.currency} {Math.abs(Number(trade.net_pnl)).toLocaleString("en-US")}
          </p>
          <p className="mt-1 text-xs text-slate-400">{rMultiple === null ? t("Risiko belum dicatat") : `${rMultiple.toFixed(2)}R`}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
        <TradeFact label={t("Entry")} value={Number(trade.entry_price).toLocaleString("en-US")} />
        <TradeFact label={t("Stop loss")} value={trade.stop_loss ? Number(trade.stop_loss).toLocaleString("en-US") : "—"} />
        <TradeFact label={t("Take profit")} value={trade.take_profit ? Number(trade.take_profit).toLocaleString("en-US") : "—"} />
        <TradeFact label={t("Setup")} value={trade.setup_tag || t("Belum dicatat")} />
      </div>
      {(trade.thesis || trade.emotion || trade.lesson) && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3">
          {trade.thesis && <Reflection label={t("Tesis")} value={trade.thesis} />}
          {trade.emotion && <Reflection label={t("Emosi")} value={trade.emotion} />}
          {trade.lesson && <Reflection label={t("Pelajaran")} value={trade.lesson} />}
        </div>
      )}
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <BrainCircuit className="h-4 w-4 text-emerald-700" /> {t("Review tersimpan terpisah dari jurnal.")}
        </span>
        <div className="flex flex-wrap gap-2">{trade.status !== "cancelled" && <Button variant="secondary" size="compact" onClick={onEdit}>{t("Edit")}</Button>}{trade.status === "open" && <><Button variant="secondary" size="compact" onClick={onClose}>{t("Tutup trade")}</Button><Button variant="secondary" size="compact" onClick={onCancel}>{t("Batalkan")}</Button></>}<Button variant="destructive" size="compact" onClick={onDelete}>{t("Hapus")}</Button><Button variant="secondary" size="compact" onClick={onReview} disabled={requesting}>{requesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Meminta...")}</> : <><BrainCircuit className="h-3.5 w-3.5" /> {t("Minta review")}</>}</Button></div>
      </div>
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{children}</span>; }
function StatusBadge({ status }: { status: Trade["status"] }) {
  const { t } = useLanguage();
  const style = status === "open" ? "bg-amber-50 text-amber-700" : status === "closed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500";
  return <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", style)}>{status === "open" ? t("Terbuka") : status === "closed" ? t("Tertutup") : t("Dibatalkan")}</span>;
}
function TradeFact({ label, value }: { label: string; value: string }) { return <div><p className="text-slate-400">{label}</p><p className="mt-1 truncate font-semibold text-slate-700">{value}</p></div>; }
function Reflection({ label, value }: { label: string; value: string }) { return <div><p className="font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="mt-1 leading-5 text-slate-600">{value}</p></div>; }

function TradeDialog({ accounts, form, setForm, saving, error, symbolRef, editing, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createTradeForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createTradeForm>>>; saving: boolean; error: string | null; symbolRef: React.RefObject<HTMLInputElement | null>; editing: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const { t } = useLanguage();
  return (
    <Dialog title={t(editing ? "Edit trade" : "Catat trade")} eyebrow={t("Trade plan & review")} description={t("Simpan rencana sebelum hasil agar evaluasi tetap jujur.")} saving={saving} onClose={onClose} initialFocusRef={symbolRef} wide>
      <form onSubmit={onSubmit}>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Akun trading")} htmlFor="trade-account">
              <select id="trade-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>
                {accounts.filter((account) => account.is_active || account.id === form.accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
              </select>
            </Field>
            <Field label={t("Pair / simbol")} htmlFor="trade-symbol">
              <input ref={symbolRef} id="trade-symbol" required maxLength={16} value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} placeholder="EURUSD" className={fieldControlStyles} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("Arah")} htmlFor="trade-direction">
              <select id="trade-direction" value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as "long" | "short" }))} className={fieldControlStyles}>
                <option value="long">{t("Long / buy")}</option>
                <option value="short">{t("Short / sell")}</option>
              </select>
            </Field>
            <Field label={t("Status")} htmlFor="trade-status">
              <select id="trade-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "open" | "closed" }))} className={fieldControlStyles}>
                <option value="open">{t("Masih terbuka")}</option>
                <option value="closed">{t("Sudah tertutup")}</option>
              </select>
            </Field>
            <Field label={t("Ukuran lot")} htmlFor="trade-lot">
              <input id="trade-lot" type="number" min="0.000001" step="any" required value={form.lotSize} onChange={(event) => setForm((current) => ({ ...current, lotSize: event.target.value }))} className={fieldControlStyles} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("Harga entry")} htmlFor="trade-entry">
              <input id="trade-entry" type="number" min="0.00000001" step="any" required value={form.entryPrice} onChange={(event) => setForm((current) => ({ ...current, entryPrice: event.target.value }))} className={fieldControlStyles} />
            </Field>
            <Field label={t("Stop loss")} htmlFor="trade-stop">
              <input id="trade-stop" type="number" min="0.00000001" step="any" value={form.stopLoss} onChange={(event) => setForm((current) => ({ ...current, stopLoss: event.target.value }))} className={fieldControlStyles} />
            </Field>
            <Field label={t("Take profit")} htmlFor="trade-target">
              <input id="trade-target" type="number" min="0.00000001" step="any" value={form.takeProfit} onChange={(event) => setForm((current) => ({ ...current, takeProfit: event.target.value }))} className={fieldControlStyles} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Risiko awal")} htmlFor="trade-risk" hint={t("Dalam mata uang akun.")}>
              <input id="trade-risk" type="number" min="0.00000001" step="any" value={form.riskAmount} onChange={(event) => setForm((current) => ({ ...current, riskAmount: event.target.value }))} className={fieldControlStyles} />
            </Field>
            <Field label={t("Waktu buka")} htmlFor="trade-opened">
              <input id="trade-opened" type="datetime-local" required value={form.openedAt} onChange={(event) => setForm((current) => ({ ...current, openedAt: event.target.value }))} className={fieldControlStyles} />
            </Field>
          </div>
          {form.status === "closed" && (
            <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{t("Hasil penutupan")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("Harga exit")} htmlFor="trade-exit">
                  <input id="trade-exit" type="number" min="0.00000001" step="any" required value={form.exitPrice} onChange={(event) => setForm((current) => ({ ...current, exitPrice: event.target.value }))} className={fieldControlStyles} />
                </Field>
                <Field label={t("Waktu tutup")} htmlFor="trade-closed">
                  <input id="trade-closed" type="datetime-local" required value={form.closedAt} onChange={(event) => setForm((current) => ({ ...current, closedAt: event.target.value }))} className={fieldControlStyles} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("Gross P/L")} htmlFor="trade-gross">
                  <input id="trade-gross" type="number" step="any" value={form.grossPnl} onChange={(event) => setForm((current) => ({ ...current, grossPnl: event.target.value }))} className={fieldControlStyles} />
                </Field>
                <Field label={t("Komisi")} htmlFor="trade-commission">
                  <input id="trade-commission" type="number" min="0" step="any" value={form.commission} onChange={(event) => setForm((current) => ({ ...current, commission: event.target.value }))} className={fieldControlStyles} />
                </Field>
                <Field label={t("Swap")} htmlFor="trade-swap">
                  <input id="trade-swap" type="number" step="any" value={form.swap} onChange={(event) => setForm((current) => ({ ...current, swap: event.target.value }))} className={fieldControlStyles} />
                </Field>
              </div>
            </div>
          )}
          <Field label={t("Setup")} htmlFor="trade-setup">
            <input id="trade-setup" value={form.setupTag} onChange={(event) => setForm((current) => ({ ...current, setupTag: event.target.value }))} placeholder={t("Contoh: London breakout")} className={fieldControlStyles} />
          </Field>
          <Field label={t("Tesis entry")} htmlFor="trade-thesis">
            <textarea id="trade-thesis" rows={3} value={form.thesis} onChange={(event) => setForm((current) => ({ ...current, thesis: event.target.value }))} placeholder={t("Apa yang membuat setup ini valid?")} className={cn(fieldControlStyles, "resize-none")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Emosi saat entry")} htmlFor="trade-emotion">
              <input id="trade-emotion" value={form.emotion} onChange={(event) => setForm((current) => ({ ...current, emotion: event.target.value }))} placeholder={t("Tenang, ragu, FOMO...")} className={fieldControlStyles} />
            </Field>
            <Field label={t("Pelajaran")} htmlFor="trade-lesson">
              <input id="trade-lesson" value={form.lesson} onChange={(event) => setForm((current) => ({ ...current, lesson: event.target.value }))} placeholder={t("Opsional")} className={fieldControlStyles} />
            </Field>
          </div>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>
        <DialogActions saving={saving} onClose={onClose} label={t(editing ? "Simpan perubahan" : "Simpan trade")} />
      </form>
    </Dialog>
  );
}

function SnapshotDialog({ accounts, form, setForm, saving, error, editing, onClose, onSubmit }: { accounts: Account[]; form: ReturnType<typeof createSnapshotForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createSnapshotForm>>>; saving: boolean; error: string | null; editing: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const { t } = useLanguage();
  return (
    <Dialog title={t(editing ? "Edit snapshot" : "Update equity")} eyebrow={t("Trading snapshot")} description={t("Masukkan total equity termasuk saldo dan floating P/L.")} saving={saving} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <Field label={t("Akun trading")} htmlFor="trading-snapshot-account">
            <select id="trading-snapshot-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
          </Field>
          <Field label={t("Total equity")} htmlFor="trading-snapshot-equity">
            <input id="trading-snapshot-equity" type="number" min="0" step="any" required value={form.equity} onChange={(event) => setForm((current) => ({ ...current, equity: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "text-lg font-bold")} />
          </Field>
          <Field label={t("Waktu pencatatan")} htmlFor="trading-snapshot-time">
            <input id="trading-snapshot-time" type="datetime-local" required value={form.recordedAt} onChange={(event) => setForm((current) => ({ ...current, recordedAt: event.target.value }))} className={fieldControlStyles} />
          </Field>
          <Field label={t("Catatan")} htmlFor="trading-snapshot-note">
            <textarea id="trading-snapshot-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className={cn(fieldControlStyles, "resize-none")} />
          </Field>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>
        <DialogActions saving={saving} onClose={onClose} label={t(editing ? "Simpan perubahan" : "Simpan snapshot")} />
      </form>
    </Dialog>
  );
}

function Dialog({ title, eyebrow, description, saving, onClose, initialFocusRef, wide = false, children }: { title: string; eyebrow: string; description: string; saving: boolean; onClose: () => void; initialFocusRef?: React.RefObject<HTMLElement | null>; wide?: boolean; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <DialogFrame titleId="trading-dialog-title" descriptionId="trading-dialog-description" initialFocusRef={initialFocusRef} onClose={onClose} closeDisabled={saving} contentClassName={wide ? "sm:max-w-2xl" : undefined}>
      <section>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p>
            <h2 id="trading-dialog-title" className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
            <p id="trading-dialog-description" className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup form trading")}>
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
function TradeSkeleton() { return <div className="animate-pulse divide-y divide-slate-100">{[0, 1, 2].map((item) => <div key={item} className="h-40 bg-slate-50/60" />)}</div>; }
function formatSignedMoney(value: number, currency: string) {
  const amount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(Math.abs(value));
  return `${value >= 0 ? "+" : "−"}${amount}`;
}
