"use client";

import Link from "next/link";
import { ArrowRight, Flame, Sprout } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { journeyLevel } from "@/lib/journey";
import type { useFinancialJourney } from "@/components/FinancialJourney";

export default function JourneySummary({ journey }: { journey: ReturnType<typeof useFinancialJourney> }) {
  const { language } = useLanguage();
  const en = language === "en";
  const { data, error } = journey;
  const { level, progress } = journeyLevel(data?.totalXp ?? 0);
  return (
    <Link href="/journey" aria-label={en ? "View Financial Journey" : "Lihat perjalanan Financial Journey"} className="my-5 block app-card p-4 transition hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Sprout aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700" />
        <h2>Financial Journey</h2>
        {data && <span className="ml-auto shrink-0 text-xs font-medium text-emerald-700">Level {level}</span>}
      </div>
      {data && !error ? <>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-orange-700"><Flame aria-hidden="true" className="h-4 w-4" />{data.streak.current} {en ? "days in a row" : "hari berturut-turut"}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-50" aria-hidden="true"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress / 3}%` }} /></div>
        <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-slate-500"><span>{data.completed.length}/3 {en ? "missions this week" : "misi minggu ini selesai"}</span><span>{progress} / 300 XP</span></div>
      </> : <p className="mt-3 text-xs text-slate-500">{error ? (en ? "Progress unavailable. Open Journey to retry." : "Progres belum tersedia. Buka Journey untuk mencoba lagi.") : (en ? "Loading your progress…" : "Memuat progresmu…")}</p>}
      <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-700">{en ? "View journey" : "Lihat perjalanan"}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></span>
    </Link>
  );
}
