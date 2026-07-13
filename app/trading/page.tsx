"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrainCircuit, Loader2, Plus, Target, TrendingDown, TrendingUp, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { calculateForexRMultiple } from "@/lib/trading";
import { supabase } from "@/lib/supabase";

type Account = { id: string; name: string; currency: string };
type Trade = {
  id: string; account_id: string; symbol: string; direction: "long" | "short"; status: "open" | "closed" | "cancelled";
  opened_at: string; closed_at: string | null; lot_size: number; entry_price: number; exit_price: number | null; stop_loss: number | null;
  take_profit: number | null; risk_amount: number | null; gross_pnl: number; commission: number; swap: number; net_pnl: number; currency: string;
  setup_tag: string | null; thesis: string | null; emotion: string | null; lesson: string | null;
};

const emptyForm = {
  accountId: "", symbol: "", direction: "long" as "long" | "short", status: "open" as "open" | "closed", lotSize: "", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "", riskAmount: "", grossPnl: "0", commission: "0", swap: "0", openedAt: new Date().toISOString().slice(0, 16), closedAt: new Date().toISOString().slice(0, 16), setupTag: "", thesis: "", emotion: "", lesson: "",
};

const asNullableNumber = (value: string) => value.trim() === "" ? null : Number(value);

export default function TradingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [requestingReviewId, setRequestingReviewId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: accountData, error: accountError }, { data: tradeData, error: tradeError }] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency").eq("user_id", user.id).eq("kind", "trading").eq("is_active", true).order("name"),
        supabase.from("forex_trades").select("id, account_id, symbol, direction, status, opened_at, closed_at, lot_size, entry_price, exit_price, stop_loss, take_profit, risk_amount, gross_pnl, commission, swap, net_pnl, currency, setup_tag, thesis, emotion, lesson").eq("user_id", user.id).order("opened_at", { ascending: false }),
      ]);
      if (accountError) throw accountError;
      if (tradeError) throw tradeError;
      setAccounts((accountData ?? []) as Account[]); setTrades((tradeData ?? []) as Trade[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat jurnal trading. Jalankan migrasi Supabase terlebih dahulu.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);

  const metrics = useMemo(() => {
    const closed = trades.filter((trade) => trade.status === "closed");
    const pnl = closed.reduce((sum, trade) => sum + Number(trade.net_pnl), 0);
    const wins = closed.filter((trade) => Number(trade.net_pnl) > 0).length;
    const averageRValues = closed.map((trade) => calculateForexRMultiple({ netPnl: Number(trade.net_pnl), riskAmount: Number(trade.risk_amount) })).filter((value): value is number => value !== null);
    return { open: trades.filter((trade) => trade.status === "open").length, closed: closed.length, pnl, winRate: closed.length ? (wins / closed.length) * 100 : 0, averageR: averageRValues.length ? averageRValues.reduce((sum, value) => sum + value, 0) / averageRValues.length : null };
  }, [trades]);

  async function saveTrade(event: React.FormEvent) {
    event.preventDefault();
    const lotSize = Number(form.lotSize); const entryPrice = Number(form.entryPrice); const commission = Number(form.commission); const swap = Number(form.swap); const grossPnl = Number(form.grossPnl);
    const optionalFields = [asNullableNumber(form.exitPrice), asNullableNumber(form.stopLoss), asNullableNumber(form.takeProfit), asNullableNumber(form.riskAmount)];
    if (!form.accountId || !form.symbol.trim() || !Number.isFinite(lotSize) || lotSize <= 0 || !Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(commission) || commission < 0 || !Number.isFinite(swap) || !Number.isFinite(grossPnl) || optionalFields.some((value) => value !== null && (!Number.isFinite(value) || value <= 0)) || (form.status === "closed" && asNullableNumber(form.exitPrice) === null)) {
      setError("Lengkapi data trade dengan angka yang valid; trade tertutup wajib memiliki harga keluar."); return;
    }
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const account = accounts.find((item) => item.id === form.accountId);
      const { error: insertError } = await supabase.from("forex_trades").insert({
        user_id: user.id, account_id: form.accountId, symbol: form.symbol.trim().toUpperCase(), direction: form.direction, status: form.status,
        opened_at: new Date(form.openedAt).toISOString(), closed_at: form.status === "closed" ? new Date(form.closedAt).toISOString() : null,
        lot_size: lotSize, entry_price: entryPrice, exit_price: asNullableNumber(form.exitPrice), stop_loss: asNullableNumber(form.stopLoss), take_profit: asNullableNumber(form.takeProfit), risk_amount: asNullableNumber(form.riskAmount), gross_pnl: grossPnl, commission, swap, currency: account?.currency ?? "USD", setup_tag: form.setupTag.trim() || null, thesis: form.thesis.trim() || null, emotion: form.emotion.trim() || null, lesson: form.lesson.trim() || null,
      });
      if (insertError) throw insertError;
      setModalOpen(false); setForm(emptyForm); await loadData();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan trade."); } finally { setSaving(false); }
  }

  async function requestAiReview(tradeId: string) {
    setRequestingReviewId(tradeId); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
      const response = await fetch(`/api/trades/${tradeId}/review`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Gagal meminta review AI.");
      alert("Review AI sedang diproses. Buka Insights beberapa saat lagi untuk melihat hasilnya.");
    } catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : "Gagal meminta review AI."); } finally { setRequestingReviewId(null); }
  }

  return <div className="min-h-screen bg-[#050507] pb-24 text-[#f7f8f8] md:pb-6"><Navbar /><main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Trading journal</p><h1 className="mt-1 text-2xl font-semibold">Forex Journal</h1><p className="mt-1 text-sm text-[#8a8f98]">Rekam setup, risiko, emosi, dan hasil trade HFM atau Exness. AI nanti hanya memberi review, bukan mengubah data Anda.</p></div><button onClick={() => setModalOpen(true)} disabled={accounts.length === 0} className="inline-flex items-center justify-center gap-2 rounded bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Catat trade</button></section>
    {error && <div className="rounded border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
    {accounts.length === 0 && !loading && <div className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Tambahkan akun bertipe Trading (misalnya HFM atau Exness) terlebih dahulu di <Link className="font-bold underline" href="/accounts">Akun</Link>.</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article className="linear-panel rounded-lg p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">Trade terbuka</p><p className="mt-2 font-mono text-3xl font-bold">{metrics.open}</p></article><article className="linear-panel rounded-lg p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">Win rate</p><p className="mt-2 font-mono text-3xl font-bold">{metrics.winRate.toFixed(0)}%</p><p className="mt-2 text-xs text-[#8a8f98]">Dari {metrics.closed} trade tertutup.</p></article><article className="linear-panel rounded-lg p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">P/L tertutup</p><p className={`mt-2 font-mono text-2xl font-bold ${metrics.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{metrics.pnl >= 0 ? "+" : "-"}${Math.abs(metrics.pnl).toLocaleString("en-US")}</p><p className="mt-2 text-xs text-[#8a8f98]">Pada mata uang akun trade.</p></article><article className="linear-panel rounded-lg p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">R rata-rata</p><p className="mt-2 font-mono text-3xl font-bold">{metrics.averageR === null ? "—" : `${metrics.averageR.toFixed(2)}R`}</p><p className="mt-2 text-xs text-[#8a8f98]">P/L dibanding risiko yang direncanakan.</p></article></section>
    {loading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-violet-400" /></div> : trades.length === 0 ? <section className="linear-panel rounded-lg p-10 text-center"><Target className="mx-auto h-10 w-10 text-violet-400" /><h2 className="mt-4 font-semibold">Belum ada trade</h2><p className="mt-2 text-sm text-[#8a8f98]">Mulai dengan trade pertama, lalu simpan juga alasan entry dan emosimu untuk bahan review AI.</p></section> : <section className="space-y-3">{trades.map((trade) => { const r = calculateForexRMultiple({ netPnl: Number(trade.net_pnl), riskAmount: Number(trade.risk_amount) }); return <article key={trade.id} className="linear-panel rounded-lg p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex gap-3"><div className={`rounded p-2 ${Number(trade.net_pnl) >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{Number(trade.net_pnl) >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}</div><div><div className="flex items-center gap-2"><h2 className="font-mono text-lg font-bold">{trade.symbol}</h2><span className="rounded border border-neutral-800 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-400">{trade.direction}</span><span className="rounded border border-neutral-800 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-400">{trade.status}</span></div><p className="mt-1 text-xs text-[#8a8f98]">{new Date(trade.opened_at).toLocaleDateString("id-ID")} · {Number(trade.lot_size)} lot · {trade.setup_tag || "Tanpa setup tag"}</p></div></div><div className="text-left sm:text-right"><p className={`font-mono text-xl font-bold ${Number(trade.net_pnl) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{Number(trade.net_pnl) >= 0 ? "+" : ""}{trade.currency} {Number(trade.net_pnl).toLocaleString("en-US")}</p><p className="mt-1 text-xs text-neutral-500">{r === null ? "Risiko belum dicatat" : `${r.toFixed(2)}R`}</p></div></div>{(trade.thesis || trade.emotion || trade.lesson) && <div className="mt-4 grid gap-3 border-t border-neutral-800 pt-4 text-xs sm:grid-cols-3">{trade.thesis && <div><p className="font-bold uppercase tracking-wider text-neutral-500">Tesis</p><p className="mt-1 text-neutral-300">{trade.thesis}</p></div>}{trade.emotion && <div><p className="font-bold uppercase tracking-wider text-neutral-500">Emosi</p><p className="mt-1 text-neutral-300">{trade.emotion}</p></div>}{trade.lesson && <div><p className="font-bold uppercase tracking-wider text-neutral-500">Pelajaran</p><p className="mt-1 text-neutral-300">{trade.lesson}</p></div>}</div>}<div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-800 pt-3"><span className="flex items-center gap-2 text-[10px] text-violet-300"><BrainCircuit className="h-3.5 w-3.5" /> AI hanya memberi saran terpisah.</span><button onClick={() => requestAiReview(trade.id)} disabled={requestingReviewId === trade.id} className="shrink-0 rounded border border-violet-500/30 px-2 py-1 text-[10px] font-bold text-violet-300 hover:bg-violet-500/10 disabled:opacity-50">{requestingReviewId === trade.id ? "Meminta..." : "Minta review AI"}</button></div></article>; })}</section>}
  </main>{modalOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center"><form onSubmit={saveTrade} className="linear-panel max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-lg p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Catat trade forex</h2><button type="button" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></button></div><div className="grid gap-3 sm:grid-cols-2"><select required value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="">Pilih akun trading...</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name} ({account.currency})</option>)}</select><input required value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })} placeholder="Pair, mis. EURUSD" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div><div className="grid gap-3 sm:grid-cols-3"><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as "long" | "short" })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="long">Long / buy</option><option value="short">Short / sell</option></select><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "open" | "closed" })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="open">Masih terbuka</option><option value="closed">Sudah tertutup</option></select><input required type="number" min="0.001" step="any" value={form.lotSize} onChange={(event) => setForm({ ...form, lotSize: event.target.value })} placeholder="Lot" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div><div className="grid gap-3 sm:grid-cols-3"><input required type="number" min="0.000001" step="any" value={form.entryPrice} onChange={(event) => setForm({ ...form, entryPrice: event.target.value })} placeholder="Harga entry" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input type="number" min="0.000001" step="any" value={form.stopLoss} onChange={(event) => setForm({ ...form, stopLoss: event.target.value })} placeholder="Stop loss" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input type="number" min="0.000001" step="any" value={form.takeProfit} onChange={(event) => setForm({ ...form, takeProfit: event.target.value })} placeholder="Take profit" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div>{form.status === "closed" && <><div className="grid gap-3 sm:grid-cols-2"><input required type="number" min="0.000001" step="any" value={form.exitPrice} onChange={(event) => setForm({ ...form, exitPrice: event.target.value })} placeholder="Harga exit" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input type="datetime-local" value={form.closedAt} onChange={(event) => setForm({ ...form, closedAt: event.target.value })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div><div className="grid gap-3 sm:grid-cols-3"><input type="number" step="any" value={form.grossPnl} onChange={(event) => setForm({ ...form, grossPnl: event.target.value })} placeholder="Gross P/L" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input type="number" min="0" step="any" value={form.commission} onChange={(event) => setForm({ ...form, commission: event.target.value })} placeholder="Komisi" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input type="number" step="any" value={form.swap} onChange={(event) => setForm({ ...form, swap: event.target.value })} placeholder="Swap (+/-)" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div></>}<div className="grid gap-3 sm:grid-cols-2"><input type="number" min="0" step="any" value={form.riskAmount} onChange={(event) => setForm({ ...form, riskAmount: event.target.value })} placeholder="Risiko awal (mata uang akun)" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input type="datetime-local" value={form.openedAt} onChange={(event) => setForm({ ...form, openedAt: event.target.value })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div><input value={form.setupTag} onChange={(event) => setForm({ ...form, setupTag: event.target.value })} placeholder="Setup, mis. London breakout" className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><textarea value={form.thesis} onChange={(event) => setForm({ ...form, thesis: event.target.value })} placeholder="Alasan entry / tesis" className="h-16 w-full resize-none rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><input value={form.emotion} onChange={(event) => setForm({ ...form, emotion: event.target.value })} placeholder="Emosi saat entry" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input value={form.lesson} onChange={(event) => setForm({ ...form, lesson: event.target.value })} placeholder="Pelajaran (opsional)" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div><button disabled={saving} className="w-full rounded bg-violet-600 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan trade"}</button></form></div>}</div>;
}
