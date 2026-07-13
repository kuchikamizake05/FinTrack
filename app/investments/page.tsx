"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { summarizeStockPosition, type StockExecution } from "@/lib/trading";
import { supabase } from "@/lib/supabase";

type Account = { id: string; name: string; currency: string };
type Execution = StockExecution & { id: string; ticker: string; executed_at: string; currency: string; note: string | null };

const emptyForm = {
  accountId: "",
  ticker: "",
  side: "buy" as "buy" | "sell",
  quantity: "",
  price: "",
  fee: "0",
  executedAt: new Date().toISOString().slice(0, 16),
  note: "",
};

export default function InvestmentsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: accountData, error: accountError }, { data: executionData, error: executionError }] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency").eq("user_id", user.id).eq("kind", "investment").eq("is_active", true).order("name"),
        supabase.from("stock_executions").select("id, ticker, side, quantity, price, fee, executed_at, currency, note").eq("user_id", user.id).order("executed_at", { ascending: false }),
      ]);
      if (accountError) throw accountError;
      if (executionError) throw executionError;
      setAccounts((accountData ?? []) as Account[]);
      setExecutions((executionData ?? []) as Execution[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat investasi. Jalankan migrasi Supabase terlebih dahulu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const positions = useMemo(() => {
    const grouped = new Map<string, Execution[]>();
    for (const execution of executions) {
      const list = grouped.get(execution.ticker) ?? [];
      list.push(execution);
      grouped.set(execution.ticker, list);
    }
    return [...grouped.entries()].map(([ticker, tickerExecutions]) => ({
      ticker,
      summary: summarizeStockPosition([...tickerExecutions].reverse()),
    })).sort((a, b) => b.summary.costBasis - a.summary.costBasis);
  }, [executions]);

  const totalCostBasis = positions.reduce((total, position) => total + position.summary.costBasis, 0);
  const totalRealizedPnl = positions.reduce((total, position) => total + position.summary.realizedPnl, 0);

  async function saveExecution(event: React.FormEvent) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    const fee = Number(form.fee);
    if (!form.accountId || !form.ticker.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(fee) || fee < 0) {
      setError("Lengkapi broker, ticker, jumlah, harga, dan biaya dengan nilai valid.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const account = accounts.find((item) => item.id === form.accountId);
      const { error: insertError } = await supabase.from("stock_executions").insert({
        user_id: user.id,
        account_id: form.accountId,
        ticker: form.ticker.trim().toUpperCase(),
        side: form.side,
        quantity,
        price,
        fee,
        currency: account?.currency ?? "IDR",
        executed_at: new Date(form.executedAt).toISOString(),
        note: form.note.trim() || null,
      });
      if (insertError) throw insertError;
      setModalOpen(false);
      setForm(emptyForm);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan eksekusi saham.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="min-h-screen bg-[#050507] pb-24 text-[#f7f8f8] md:pb-6">
    <Navbar />
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Portfolio journal</p>
          <h1 className="mt-1 text-2xl font-semibold">Investasi Saham</h1>
          <p className="mt-1 text-sm text-[#8a8f98]">Catat setiap beli dan jual dari Stockbit atau broker lain. Nilai akun broker tetap dikelola dari menu Akun.</p>
        </div>
        <button onClick={() => setModalOpen(true)} disabled={accounts.length === 0} className="inline-flex items-center justify-center gap-2 rounded bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Catat eksekusi</button>
      </section>

      {error && <div className="rounded border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {accounts.length === 0 && !loading && <div className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Tambahkan akun bertipe Investasi (misalnya Stockbit) terlebih dahulu di <Link className="font-bold underline" href="/accounts">Akun</Link>.</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="linear-panel rounded-lg p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">Posisi terbuka</p><p className="mt-2 font-mono text-3xl font-bold">{positions.filter((position) => position.summary.quantity > 0).length}</p><p className="mt-2 text-xs text-[#8a8f98]">Ticker dengan kepemilikan tersisa.</p></article>
        <article className="linear-panel rounded-lg p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">Modal tersisa</p><p className="mt-2 font-mono text-2xl font-bold">Rp{totalCostBasis.toLocaleString("id-ID")}</p><p className="mt-2 text-xs text-[#8a8f98]">Cost basis rata-rata tertimbang (IDR).</p></article>
        <article className="linear-panel rounded-lg p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">P/L terealisasi</p><p className={`mt-2 font-mono text-2xl font-bold ${totalRealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{totalRealizedPnl >= 0 ? "+" : "-"}Rp{Math.abs(totalRealizedPnl).toLocaleString("id-ID")}</p><p className="mt-2 text-xs text-[#8a8f98]">Setelah biaya transaksi yang dicatat.</p></article>
      </section>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-violet-400" /></div> : positions.length === 0 ? <section className="linear-panel rounded-lg p-10 text-center"><BarChart3 className="mx-auto h-10 w-10 text-violet-400" /><h2 className="mt-4 font-semibold">Belum ada eksekusi saham</h2><p className="mt-2 text-sm text-[#8a8f98]">Masukkan pembelian pertama agar posisi dan cost basis dapat dihitung otomatis.</p></section> : <section className="grid gap-4 lg:grid-cols-2">{positions.map((position) => <article key={position.ticker} className="linear-panel rounded-lg p-5"><div className="flex items-start justify-between"><div><h2 className="font-mono text-xl font-bold text-white">{position.ticker}</h2><p className="mt-1 text-xs text-[#8a8f98]">{position.summary.quantity.toLocaleString("id-ID")} lembar tersisa</p></div>{position.summary.realizedPnl >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-rose-400" />}</div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-neutral-800 pt-4 text-xs"><div><p className="text-neutral-500">Rata-rata</p><p className="mt-1 font-mono font-bold">Rp{position.summary.averageCost.toLocaleString("id-ID")}</p></div><div><p className="text-neutral-500">Cost basis</p><p className="mt-1 font-mono font-bold">Rp{position.summary.costBasis.toLocaleString("id-ID")}</p></div><div><p className="text-neutral-500">P/L jual</p><p className={`mt-1 font-mono font-bold ${position.summary.realizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>Rp{position.summary.realizedPnl.toLocaleString("id-ID")}</p></div></div>{position.summary.oversoldQuantity > 0 && <p className="mt-4 text-xs text-amber-300">Ada penjualan {position.summary.oversoldQuantity} lembar melebihi pembelian yang tercatat.</p>}</article>)}</section>}

      {executions.length > 0 && <section className="linear-panel rounded-lg p-5"><h2 className="text-xs font-bold uppercase tracking-wider text-[#8a8f98]">Eksekusi terbaru</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-neutral-800 text-neutral-500"><tr><th className="pb-3">Waktu</th><th className="pb-3">Ticker</th><th className="pb-3">Aksi</th><th className="pb-3">Jumlah</th><th className="pb-3">Harga</th></tr></thead><tbody>{executions.slice(0, 10).map((execution) => <tr key={execution.id} className="border-b border-neutral-900/70"><td className="py-3 text-neutral-400">{new Date(execution.executed_at).toLocaleDateString("id-ID")}</td><td className="py-3 font-mono font-bold">{execution.ticker}</td><td className={`py-3 font-bold uppercase ${execution.side === "buy" ? "text-emerald-400" : "text-rose-400"}`}>{execution.side}</td><td className="py-3">{Number(execution.quantity).toLocaleString("id-ID")}</td><td className="py-3 font-mono">Rp{Number(execution.price).toLocaleString("id-ID")}</td></tr>)}</tbody></table></div></section>}
    </main>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center"><form onSubmit={saveExecution} className="linear-panel w-full max-w-md space-y-4 rounded-lg p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Catat eksekusi saham</h2><button type="button" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></button></div><select required value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="">Pilih akun investasi...</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name} ({account.currency})</option>)}</select><div className="grid grid-cols-2 gap-3"><input required value={form.ticker} onChange={(event) => setForm({ ...form, ticker: event.target.value.toUpperCase() })} placeholder="Ticker, mis. BBCA" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value as "buy" | "sell" })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="buy">Beli</option><option value="sell">Jual</option></select></div><div className="grid grid-cols-2 gap-3"><input required type="number" min="0.0001" step="any" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="Jumlah lembar" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input required type="number" min="0" step="any" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Harga per lembar" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div><input required type="number" min="0" step="any" value={form.fee} onChange={(event) => setForm({ ...form, fee: event.target.value })} placeholder="Biaya transaksi" className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input required type="datetime-local" value={form.executedAt} onChange={(event) => setForm({ ...form, executedAt: event.target.value })} className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Catatan / tesis singkat (opsional)" className="h-20 w-full resize-none rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><button disabled={saving} className="w-full rounded bg-violet-600 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan eksekusi"}</button></form></div>}
  </div>;
}
