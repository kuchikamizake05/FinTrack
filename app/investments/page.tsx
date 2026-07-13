"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Camera, LineChart as LineChartIcon, Loader2, Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Navbar from "@/components/Navbar";
import { buildPortfolioWeeklyEquitySeries } from "@/lib/analytics";
import { summarizeStockPosition, type StockExecution } from "@/lib/trading";
import { supabase } from "@/lib/supabase";

type Account = { id: string; name: string; currency: string };
type Execution = StockExecution & { id: string; ticker: string; executed_at: string; currency: string; note: string | null };
type Snapshot = { id: string; account_id: string; recorded_at: string; equity: number; currency: string; note: string | null };

const emptyExecution = { accountId: "", ticker: "", side: "buy" as "buy" | "sell", quantity: "", price: "", fee: "0", executedAt: new Date().toISOString().slice(0, 16), note: "" };
const emptySnapshot = { accountId: "", equity: "", recordedAt: new Date().toISOString().slice(0, 16), note: "" };

export default function InvestmentsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [executionForm, setExecutionForm] = useState(emptyExecution);
  const [snapshotForm, setSnapshotForm] = useState(emptySnapshot);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountsResult, executionsResult, snapshotsResult] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency").eq("user_id", user.id).eq("kind", "investment").eq("is_active", true).order("name"),
        supabase.from("stock_executions").select("id, ticker, side, quantity, price, fee, executed_at, currency, note").eq("user_id", user.id).order("executed_at", { ascending: false }),
        supabase.from("account_equity_snapshots").select("id, account_id, recorded_at, equity, currency, note, financial_accounts!inner(kind)").eq("user_id", user.id).eq("financial_accounts.kind", "investment").order("recorded_at", { ascending: true }),
      ]);
      if (accountsResult.error) throw accountsResult.error;
      if (executionsResult.error) throw executionsResult.error;
      if (snapshotsResult.error) throw snapshotsResult.error;
      setAccounts((accountsResult.data ?? []) as Account[]);
      setExecutions((executionsResult.data ?? []) as Execution[]);
      setSnapshots((snapshotsResult.data ?? []) as Snapshot[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat investasi. Jalankan migrasi Supabase terlebih dahulu.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);

  const positions = useMemo(() => {
    const grouped = new Map<string, Execution[]>();
    for (const execution of executions) grouped.set(execution.ticker, [...(grouped.get(execution.ticker) ?? []), execution]);
    return [...grouped.entries()].map(([ticker, list]) => ({ ticker, summary: summarizeStockPosition([...list].reverse()) })).sort((a, b) => b.summary.costBasis - a.summary.costBasis);
  }, [executions]);
  const totalCostBasis = positions.reduce((total, position) => total + position.summary.costBasis, 0);
  const totalRealizedPnl = positions.reduce((total, position) => total + position.summary.realizedPnl, 0);
  const equitySeries = useMemo(() => buildPortfolioWeeklyEquitySeries(snapshots.map((snapshot) => ({ accountId: snapshot.account_id, recordedAt: snapshot.recorded_at, equity: Number(snapshot.equity) }))), [snapshots]);
  const latestEquity = equitySeries.at(-1)?.equity ?? null;

  async function saveExecution(event: React.FormEvent) {
    event.preventDefault();
    const quantity = Number(executionForm.quantity); const price = Number(executionForm.price); const fee = Number(executionForm.fee);
    if (!executionForm.accountId || !executionForm.ticker.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(fee) || fee < 0) { setError("Lengkapi broker, ticker, jumlah, harga, dan biaya dengan nilai valid."); return; }
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error("Sesi login tidak ditemukan.");
      const account = accounts.find((item) => item.id === executionForm.accountId);
      const { error: insertError } = await supabase.from("stock_executions").insert({ user_id: user.id, account_id: executionForm.accountId, ticker: executionForm.ticker.trim().toUpperCase(), side: executionForm.side, quantity, price, fee, currency: account?.currency ?? "IDR", executed_at: new Date(executionForm.executedAt).toISOString(), note: executionForm.note.trim() || null });
      if (insertError) throw insertError;
      setExecutionModalOpen(false); setExecutionForm(emptyExecution); await loadData();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan eksekusi saham."); } finally { setSaving(false); }
  }

  async function saveSnapshot(event: React.FormEvent) {
    event.preventDefault(); const equity = Number(snapshotForm.equity);
    if (!snapshotForm.accountId || !Number.isFinite(equity) || equity < 0) { setError("Pilih akun dan masukkan nilai portfolio yang valid."); return; }
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error("Sesi login tidak ditemukan.");
      const account = accounts.find((item) => item.id === snapshotForm.accountId);
      const { error: insertError } = await supabase.from("account_equity_snapshots").insert({ user_id: user.id, account_id: snapshotForm.accountId, equity, currency: account?.currency ?? "IDR", recorded_at: new Date(snapshotForm.recordedAt).toISOString(), note: snapshotForm.note.trim() || null });
      if (insertError) throw insertError;
      setSnapshotModalOpen(false); setSnapshotForm(emptySnapshot); await loadData();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan snapshot portfolio."); } finally { setSaving(false); }
  }

  return <div className="min-h-screen bg-[#050507] pb-24 text-[#f7f8f8] md:pb-6"><Navbar /><main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-500">Portfolio journal</p><h1 className="mt-1 text-2xl font-bold text-[#17233b]">Investasi Saham</h1><p className="mt-1 text-sm text-slate-500">Eksekusi untuk cost basis; snapshot manual untuk nilai equity yang benar.</p></div><div className="flex gap-2"><button onClick={() => setSnapshotModalOpen(true)} disabled={!accounts.length} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 disabled:opacity-50"><Camera className="h-4 w-4" /> Update equity</button><button onClick={() => setExecutionModalOpen(true)} disabled={!accounts.length} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"><Plus className="h-4 w-4" /> Catat eksekusi</button></div></section>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {accounts.length === 0 && !loading && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Tambahkan akun Investasi seperti Stockbit terlebih dahulu di <Link className="font-bold underline" href="/accounts">Akun</Link>.</div>}
    <section className="grid gap-4 md:grid-cols-4"><Metric label="Posisi terbuka" value={String(positions.filter((position) => position.summary.quantity > 0).length)} hint="Ticker yang masih dimiliki." /><Metric label="Modal tersisa" value={`Rp${totalCostBasis.toLocaleString("id-ID")}`} hint="Cost basis rata-rata tertimbang." /><Metric label="Equity terakhir" value={latestEquity === null ? "—" : `Rp${latestEquity.toLocaleString("id-ID")}`} hint={latestEquity === null ? "Catat snapshot pertama." : "Dari snapshot manual terbaru."} /><Metric label="P/L terealisasi" value={`${totalRealizedPnl >= 0 ? "+" : "-"}Rp${Math.abs(totalRealizedPnl).toLocaleString("id-ID")}`} hint="Setelah biaya transaksi." tone={totalRealizedPnl >= 0 ? "text-emerald-600" : "text-rose-600"} /></section>
    <section className="linear-panel rounded-2xl p-5"><div className="flex items-start justify-between"><div><h2 className="flex items-center gap-2 text-sm font-bold text-[#17233b]"><LineChartIcon className="h-4 w-4 text-violet-600" /> Equity portfolio per minggu</h2><p className="mt-1 text-xs text-slate-500">Nilai terakhir tiap akun pada tiap minggu, dari snapshot yang kamu catat.</p></div></div>{equitySeries.length > 1 ? <div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={equitySeries} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tickFormatter={(value) => `Rp${Number(value / 1_000_000).toFixed(1)}jt`} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={58} /><Tooltip formatter={(value) => `Rp${Number(value).toLocaleString("id-ID")}`} contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }} /><Line type="monotone" dataKey="equity" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3, fill: "#7c3aed" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center"><BarChart3 className="mx-auto h-6 w-6 text-violet-500" /><p className="mt-2 text-xs font-bold text-[#17233b]">Butuh dua snapshot untuk membentuk grafik</p><p className="mt-1 text-[11px] text-slate-500">Masukkan nilai portfolio sekarang, lalu update rutin setiap minggu.</p></div>}</section>
    {loading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-violet-500" /></div> : positions.length === 0 ? <section className="linear-panel rounded-2xl p-10 text-center"><BarChart3 className="mx-auto h-10 w-10 text-violet-500" /><h2 className="mt-4 font-semibold text-[#17233b]">Belum ada eksekusi saham</h2><p className="mt-2 text-sm text-slate-500">Masukkan pembelian pertama agar posisi dan cost basis dapat dihitung otomatis.</p></section> : <section className="grid gap-4 lg:grid-cols-2">{positions.map((position) => <article key={position.ticker} className="linear-panel rounded-2xl p-5"><div className="flex items-start justify-between"><div><h2 className="font-mono text-xl font-bold text-[#17233b]">{position.ticker}</h2><p className="mt-1 text-xs text-slate-500">{position.summary.quantity.toLocaleString("id-ID")} lembar tersisa</p></div>{position.summary.realizedPnl >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-rose-500" />}</div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-xs"><div><p className="text-slate-500">Rata-rata</p><p className="mt-1 font-mono font-bold">Rp{position.summary.averageCost.toLocaleString("id-ID")}</p></div><div><p className="text-slate-500">Cost basis</p><p className="mt-1 font-mono font-bold">Rp{position.summary.costBasis.toLocaleString("id-ID")}</p></div><div><p className="text-slate-500">P/L jual</p><p className={`mt-1 font-mono font-bold ${position.summary.realizedPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>Rp{position.summary.realizedPnl.toLocaleString("id-ID")}</p></div></div>{position.summary.oversoldQuantity > 0 && <p className="mt-4 text-xs text-amber-600">Ada penjualan {position.summary.oversoldQuantity} lembar melebihi pembelian tercatat.</p>}</article>)}</section>}
  </main>{executionModalOpen && <Modal title="Catat eksekusi saham" onClose={() => setExecutionModalOpen(false)}><form onSubmit={saveExecution} className="space-y-3"><select required value={executionForm.accountId} onChange={(event) => setExecutionForm({ ...executionForm, accountId: event.target.value })} className="field"><option value="">Pilih akun investasi...</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name} ({account.currency})</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><input required value={executionForm.ticker} onChange={(event) => setExecutionForm({ ...executionForm, ticker: event.target.value.toUpperCase() })} placeholder="Ticker, mis. BBCA" className="field" /><select value={executionForm.side} onChange={(event) => setExecutionForm({ ...executionForm, side: event.target.value as "buy" | "sell" })} className="field"><option value="buy">Beli</option><option value="sell">Jual</option></select></div><div className="grid gap-3 sm:grid-cols-3"><input required type="number" min="1" step="any" value={executionForm.quantity} onChange={(event) => setExecutionForm({ ...executionForm, quantity: event.target.value })} placeholder="Jumlah" className="field" /><input required type="number" min="0" step="any" value={executionForm.price} onChange={(event) => setExecutionForm({ ...executionForm, price: event.target.value })} placeholder="Harga" className="field" /><input type="number" min="0" step="any" value={executionForm.fee} onChange={(event) => setExecutionForm({ ...executionForm, fee: event.target.value })} placeholder="Biaya" className="field" /></div><input type="datetime-local" value={executionForm.executedAt} onChange={(event) => setExecutionForm({ ...executionForm, executedAt: event.target.value })} className="field" /><input value={executionForm.note} onChange={(event) => setExecutionForm({ ...executionForm, note: event.target.value })} placeholder="Catatan (opsional)" className="field" /><button disabled={saving} className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan eksekusi"}</button></form></Modal>}{snapshotModalOpen && <Modal title="Update equity portfolio" onClose={() => setSnapshotModalOpen(false)}><form onSubmit={saveSnapshot} className="space-y-3"><p className="text-xs text-slate-500">Masukkan total nilai akun saat ini, termasuk kas broker dan nilai sahamnya.</p><select required value={snapshotForm.accountId} onChange={(event) => setSnapshotForm({ ...snapshotForm, accountId: event.target.value })} className="field"><option value="">Pilih akun investasi...</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name} ({account.currency})</option>)}</select><input required type="number" min="0" step="any" value={snapshotForm.equity} onChange={(event) => setSnapshotForm({ ...snapshotForm, equity: event.target.value })} placeholder="Total nilai portfolio" className="field" /><input type="datetime-local" value={snapshotForm.recordedAt} onChange={(event) => setSnapshotForm({ ...snapshotForm, recordedAt: event.target.value })} className="field" /><input value={snapshotForm.note} onChange={(event) => setSnapshotForm({ ...snapshotForm, note: event.target.value })} placeholder="Catatan (opsional)" className="field" /><button disabled={saving} className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan snapshot"}</button></form></Modal>}</div>;
}

function Metric({ label, value, hint, tone = "text-[#17233b]" }: { label: string; value: string; hint: string; tone?: string }) { return <article className="linear-panel rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 font-mono text-2xl font-bold ${tone}`}>{value}</p><p className="mt-2 text-xs text-slate-500">{hint}</p></article>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-4 sm:items-center sm:justify-center"><div className="linear-panel w-full max-w-lg rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-[#17233b]">{title}</h2><button type="button" onClick={onClose} aria-label="Tutup"><X className="h-5 w-5" /></button></div>{children}</div></div>; }
