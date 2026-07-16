"use client";

import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
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
    } catch (loadError) {
      reportHandledError("Trade reviews unavailable", loadError, "Review belum berhasil dimuat.");
      setError("Review belum berhasil dimuat. Coba lagi beberapa saat lagi.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void loadReviews(), 0); return () => window.clearTimeout(timer); }, [loadReviews]);

  if (loading) return <Surface className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /></Surface>;
  if (error) return <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><Button variant="secondary" size="compact" onClick={() => void loadReviews()}>Coba lagi</Button></div>;
  if (!reviews.length) return <Surface><EmptyState icon={BrainCircuit} title="Belum ada review" description="Minta review dari trade yang ingin ditinjau. Hasilnya muncul sebagai saran terpisah dan tidak pernah mengubah jurnal." /></Surface>;
  return <section className="space-y-4">{reviews.map((review) => <Surface key={review.id} className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{review.scope === "trade" ? "Review trade" : `Ringkasan ${review.period_start}–${review.period_end}`}</p><p className="mt-2 text-sm leading-6 text-slate-700">{review.summary}</p></div></div><div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><ReviewList title="Yang sudah baik" icon={CheckCircle2} tone="text-emerald-700" items={review.strengths} /><ReviewList title="Fokus perbaikan" icon={Lightbulb} tone="text-amber-700" items={review.improvements} /></div></Surface>)}</section>;
}

function ReviewList({ title, icon: Icon, tone, items }: { title: string; icon: typeof CheckCircle2; tone: string; items: string[] }) { return <div><p className={`flex items-center gap-2 text-xs font-bold ${tone}`}><Icon className="h-4 w-4" /> {title}</p><ul className="mt-2 space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{item}</li>)}</ul></div>; }
