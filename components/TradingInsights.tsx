"use client";

import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Review = { id: string; scope: "trade" | "weekly"; period_start: string | null; period_end: string | null; summary: string; strengths: string[]; improvements: string[] };

export default function TradingInsights() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadReviews = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: queryError } = await supabase.from("ai_trade_reviews").select("id, scope, period_start, period_end, summary, strengths, improvements").eq("user_id", user.id).order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setReviews((data ?? []) as Review[]);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Belum bisa memuat insight AI."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void loadReviews(), 0); return () => window.clearTimeout(timer); }, [loadReviews]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-violet-400" /></div>;
  if (error) return <div className="rounded border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>;
  if (!reviews.length) return <section className="linear-panel rounded-lg p-10 text-center"><BrainCircuit className="mx-auto h-10 w-10 text-violet-400" /><h2 className="mt-4 font-semibold">Belum ada review AI</h2><p className="mx-auto mt-2 max-w-lg text-sm text-[#8a8f98]">Minta review dari jurnal trade. Nanti hasilnya muncul di sini sebagai saran, tanpa mengubah data trade kamu.</p></section>;
  return <section className="space-y-4">{reviews.map((review) => <article key={review.id} className="linear-panel rounded-lg p-5"><div className="flex items-start gap-3"><div className="rounded bg-violet-600/10 p-2 text-violet-400"><Sparkles className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">{review.scope === "trade" ? "Review trade" : `Ringkasan mingguan ${review.period_start}–${review.period_end}`}</p><p className="mt-2 text-sm leading-6 text-neutral-200">{review.summary}</p></div></div><div className="mt-5 grid gap-4 border-t border-neutral-800 pt-4 sm:grid-cols-2"><div><p className="text-xs font-bold text-emerald-400">Yang sudah baik</p><ul className="mt-2 space-y-1.5 text-xs text-neutral-300">{review.strengths.map((item, index) => <li key={index}>• {item}</li>)}</ul></div><div><p className="text-xs font-bold text-amber-300">Fokus perbaikan</p><ul className="mt-2 space-y-1.5 text-xs text-neutral-300">{review.improvements.map((item, index) => <li key={index}>• {item}</li>)}</ul></div></div></article>)}</section>;
}
