"use client";

import { Activity, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Surface } from "@/components/ui/Surface";
import { buildPortfolioWeeklyEquitySeries, calculateTradingPerformance } from "@/lib/analytics";

type Trade = { status: string; net_pnl: number };
type Snapshot = { account_id: string; recorded_at: string; equity: number };

export default function TradingAnalytics({ trades, snapshots, currency = "USD" }: { trades: Trade[]; snapshots: Snapshot[]; currency?: string }) {
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const performance = calculateTradingPerformance(closedTrades.map((trade) => ({ netPnl: Number(trade.net_pnl) })));
  const equitySeries = buildPortfolioWeeklyEquitySeries(snapshots.map((snapshot) => ({ accountId: snapshot.account_id, recordedAt: snapshot.recorded_at, equity: Number(snapshot.equity) })));
  return (
    <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
      <Surface className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Activity className="h-4 w-4 text-emerald-700" /> Equity curve trading</h2>
        <p className="mt-1 text-xs text-slate-500">Nilai equity manual terakhir setiap minggu; bukan estimasi dari trade.</p>
        {equitySeries.length > 1 ? (
          <div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={equitySeries}><defs><linearGradient id="trading-equity" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#15803d" stopOpacity={0.22} /><stop offset="100%" stopColor="#15803d" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={52} /><Tooltip formatter={(value) => `${currency} ${Number(value).toLocaleString("en-US")}`} contentStyle={{ borderRadius: 12, borderColor: "#d1fae5" }} /><Area type="monotone" dataKey="equity" stroke="#15803d" strokeWidth={3} fill="url(#trading-equity)" /></AreaChart></ResponsiveContainer></div>
        ) : (
          <div className="mt-4 rounded-xl bg-emerald-50/70 p-6 text-center"><TrendingDown className="mx-auto h-6 w-6 text-emerald-700" /><p className="mt-2 text-xs font-bold text-slate-900">Catat dua snapshot untuk equity curve</p><p className="mt-1 text-[11px] text-slate-500">Update equity akun secara rutin, idealnya mingguan.</p></div>
        )}
      </Surface>
      <Surface className="p-5">
        <h2 className="text-sm font-bold text-slate-900">Kualitas performa</h2>
        <p className="mt-1 text-xs text-slate-500">Metrik ini hanya memakai trade tertutup.</p>
        <dl className="mt-5 grid grid-cols-2 gap-4"><Metric label="Profit factor" value={Number.isFinite(performance.profitFactor) ? performance.profitFactor.toFixed(2) : "∞"} /><Metric label="Max drawdown" value={`${currency} ${performance.maxDrawdown.toLocaleString("en-US")}`} /><Metric label="Win rate" value={`${performance.winRate.toFixed(0)}%`} /><Metric label="Net P/L" value={`${performance.totalPnl >= 0 ? "+" : "−"}${currency} ${Math.abs(performance.totalPnl).toLocaleString("en-US")}`} /></dl>
      </Surface>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-900">{value}</dd></div>; }
