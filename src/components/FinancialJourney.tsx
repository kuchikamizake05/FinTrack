"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Award, Check, Circle, Flame, Sprout } from "lucide-react";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { useLanguage } from "@/components/LanguageProvider";
import { JOURNEY_MISSIONS, journeyLevel, parseJourney, type JourneyMission, type JourneyState } from "@/lib/journey";

export function useFinancialJourney() {
  const [data, setData] = useState<JourneyState | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<JourneyMission | null>(null);
  const [dailySaving, setDailySaving] = useState(false);
  const [confirming, setConfirming] = useState<JourneyMission | null>(null);
  const [notice, setNotice] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const owner = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    const request = ++generation.current;
    setLoading(true);
    try {
      const result = await supabase.rpc("get_financial_journey").abortSignal(AbortSignal.timeout(12_000));
      if (result.error) throw result.error;
      const next = parseJourney(result.data);
      if (request !== generation.current) return;
      setData(next);
      setError(false);
    } catch {
      if (request === generation.current) setError(true);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const invalidate = () => { ++generation.current; };
    const timer = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    // Refresh tabs left open across the Jakarta Monday boundary.
    const interval = window.setInterval(onFocus, 300_000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextOwner = session?.user.id ?? null;
      if (event === "INITIAL_SESSION") owner.current = nextOwner;
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && nextOwner !== owner.current)) {
        owner.current = nextOwner;
        ++generation.current;
        busy.current = false;
        setData(null);
        setSaving(null);
        setDailySaving(false);
        setConfirming(null);
        setNotice(false);
        if (nextOwner) window.setTimeout(onFocus, 0);
      }
    });
    return () => {
      invalidate();
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      subscription.unsubscribe();
    };
  }, [refresh]);

  const complete = async (mission: JourneyMission) => {
    if (busy.current || !data || error || data.completed.includes(mission)) return;
    busy.current = true;
    const request = ++generation.current;
    setSaving(mission);
    setNotice(false);
    try {
      const result = await supabase.rpc("complete_financial_journey", { mission_id: mission }).abortSignal(AbortSignal.timeout(12_000));
      if (result.error) throw result.error;
      const next = parseJourney(result.data);
      if (request !== generation.current) return;
      setData(next);
      setConfirming(null);
      setNotice(true);
    } catch {
      if (request === generation.current) setError(true);
    } finally {
      if (request === generation.current) {
        busy.current = false;
        setSaving(null);
        setLoading(false);
      }
    }
  };
  const completeDailyReview = async () => {
    if (busy.current || !data || error || data.streak.completedToday) return;
    busy.current = true;
    const request = ++generation.current;
    setDailySaving(true);
    setNotice(false);
    try {
      const result = await supabase.rpc("complete_financial_journey_daily_review").abortSignal(AbortSignal.timeout(12_000));
      if (result.error) throw result.error;
      const next = parseJourney(result.data);
      if (request !== generation.current) return;
      setData(next);
      setNotice(true);
    } catch {
      if (request === generation.current) setError(true);
    } finally {
      if (request === generation.current) {
        busy.current = false;
        setDailySaving(false);
        setLoading(false);
      }
    }
  };
  return { data, error, loading, saving, dailySaving, confirming, setConfirming, notice, refresh, complete, completeDailyReview };
}

export default function FinancialJourney({ journey }: { journey: ReturnType<typeof useFinancialJourney> }) {
  const { language } = useLanguage();
  const en = language === "en";
  const copy = (id: string, english: string) => en ? english : id;
  const titleId = useId();
  const { data, error, loading, saving, dailySaving, confirming, setConfirming, notice, refresh, complete, completeDailyReview } = journey;
  const { level, progress } = journeyLevel(data?.totalXp ?? 0);
  const badges = [
    { name: copy("Review pertama", "First review"), earned: (data?.totalXp ?? 0) > 0 },
    { name: copy("Minggu tuntas", "Complete week"), earned: (data?.completeWeeks ?? 0) >= 1 },
    { name: copy("Empat minggu tuntas", "Four complete weeks"), earned: (data?.completeWeeks ?? 0) >= 4 },
    { name: copy("Goal tercapai", "Goal achieved"), earned: data?.goalAchieved ?? false },
  ];
  const accent = level >= 3 ? "border-indigo-200 bg-indigo-50/60" : level >= 2 ? "border-teal-200 bg-teal-50/60" : "border-emerald-100 bg-white";
  return <section aria-labelledby={titleId} className={`my-5 overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6 ${accent}`}>
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">{copy("Langkah kecil, kebiasaan baik", "Small steps, lasting habits")}</p><h2 id={titleId} className="mt-1 text-lg font-bold tracking-tight text-slate-900">Financial Journey</h2></div>
      <Sprout aria-hidden="true" className="h-9 w-9 shrink-0 rounded-xl bg-emerald-50 p-2 text-emerald-700" />
    </div>
    {loading && !data && <p role="status" className="mt-4 text-sm text-slate-600">{copy("Memuat perjalananmu…", "Loading your journey…")}</p>}
    {error && <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p>{copy("Journey belum bisa tersambung. Coba lagi untuk memeriksa progres yang tersimpan.", "Journey could not sync. Retry to check your saved progress.")}</p><button type="button" disabled={loading || !!saving} onClick={() => void refresh()} className="mt-1 min-h-11 font-semibold underline disabled:opacity-50">{copy("Coba lagi", "Retry")}</button></div>}
    {data && <>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-bold text-slate-800">Level {level} · {level >= 3 ? copy("Makin konsisten", "Growing steadily") : level >= 2 ? copy("Mulai teratur", "Finding your rhythm") : copy("Langkah awal", "First steps")}</p><p className="text-xs font-medium text-slate-600">{progress} / 300 XP</p></div>
      <div role="progressbar" aria-label={copy("Progres ke level berikutnya", "Progress to next level")} aria-valuemin={0} aria-valuemax={300} aria-valuenow={progress} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 motion-safe:transition-all" style={{ width: `${progress / 3}%` }} /></div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{data.totalXp} {copy("XP terkumpul · Levelmu tidak direset.", "lifetime XP · Your level never resets.")}</p>
      <section aria-label={copy("Streak review harian", "Daily review streak")} className="mt-5 rounded-xl border border-orange-100 bg-orange-50/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><Flame aria-hidden="true" className="h-5 w-5 text-orange-600" /><div><h3 className="text-sm font-bold text-slate-800">{copy("Jaga ritmemu", "Keep your rhythm")}</h3><p className="mt-0.5 text-xs text-slate-600">{data.streak.current} {copy("hari berturut-turut", "days in a row")}</p></div></div><p className="text-xs font-medium text-slate-600">{copy("Rekor terbaik", "Best")}: {data.streak.longest} {copy("hari", "days")}</p></div>
        <div aria-label={copy("Riwayat tujuh hari terakhir", "Last seven days")} className="mt-4 grid grid-cols-7 gap-1.5">{data.streak.days.map((day) => {
          const label = new Intl.DateTimeFormat(en ? "en-GB" : "id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }).format(new Date(`${day.date}T00:00:00+07:00`));
          const status = day.completed ? copy("review selesai", "review complete") : copy("belum direview", "not reviewed");
          return <div key={day.date} aria-label={`${label}: ${status}`} className="min-w-0 text-center"><p className="truncate text-[10px] font-medium text-slate-500">{label}</p><span aria-hidden="true" className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${day.completed ? "bg-orange-500 text-white" : "bg-white text-slate-400"}`}>{day.completed ? "✓" : "·"}</span></div>;
        })}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">{data.streak.completedToday ? copy("Review hari ini sudah tercatat.", "Today's review is saved.") : copy("Selesaikan satu review hari ini untuk lanjut.", "Finish one review today to continue.")}</p><button type="button" disabled={dailySaving || data.streak.completedToday || error || loading} onClick={() => void completeDailyReview()} className="min-h-11 rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">{dailySaving ? copy("Menyimpan…", "Saving…") : data.streak.completedToday ? copy("Review hari ini selesai", "Today's review is complete") : copy("Sudah review hari ini", "I've reviewed today")}</button></div>
      </section>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-slate-600"><p className="font-semibold">{copy("Minggu ini", "This week")} · {data.completed.length}/3 {copy("selesai", "complete")}</p><p>{copy("Mulai", "From")} {new Intl.DateTimeFormat(en ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${data.week}T00:00:00+07:00`))} · WIB</p></div>
      <ul className="mt-2 grid divide-y divide-slate-100 md:grid-cols-3 md:gap-5 md:divide-y-0">{JOURNEY_MISSIONS.map((mission) => {
        const done = data.completed.includes(mission.id);
        return <li key={mission.id} className="py-3"><div className="flex items-start gap-3">
          {done ? <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <Circle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />}
          <div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-1 text-sm"><h3 className="font-semibold text-slate-800">{en ? mission.en : mission.title}</h3><span className="text-xs font-semibold text-emerald-700">+{mission.xp} XP</span></div>
            {done ? <p className="mt-1 text-xs text-emerald-700">{copy("Selesai minggu ini", "Completed this week")}</p> : <>
              <p className="mt-1 text-xs leading-5 text-slate-500">{en ? mission.descriptionEn : mission.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4"><Link href={mission.href} className="inline-flex min-h-11 items-center text-xs font-semibold text-emerald-700 hover:underline">{copy("Buka halaman ↗", "Open ↗")}</Link><button type="button" disabled={!!saving || error || loading} onClick={() => setConfirming(mission.id)} className="min-h-11 text-xs font-semibold text-slate-700 hover:underline disabled:opacity-40">{copy("Selesaikan misi", "Finish mission")}<span className="sr-only">: {en ? mission.en : mission.title}</span></button></div>
              {confirming === mission.id && <div className="mt-1 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-xs leading-5 text-slate-700">{copy("Konfirmasi setelah kamu melakukan review ini. Penyelesaian berdasarkan konfirmasimu sendiri.", "Confirm after you have done this review. This is your own check-in.")}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={!!saving || error || loading} onClick={() => void complete(mission.id)} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{saving ? copy("Menyimpan…", "Saving…") : copy("Sudah aku review", "I have reviewed it")}</button><button type="button" disabled={!!saving} onClick={() => setConfirming(null)} className="min-h-11 px-3 text-xs font-semibold text-slate-600">{copy("Batal", "Cancel")}</button></div></div>}
            </>}
          </div></div></li>;
      })}</ul>
      <p role="status" className="text-xs font-semibold text-emerald-700">{notice ? copy("Progres tersimpan. Satu langkah kecil yang berarti!", "Progress saved. A small step worth celebrating!") : ""}</p>
      <div className="mt-3 border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-700">{copy("Pencapaianmu", "Your milestones")}</p><div className="mt-2 flex flex-wrap gap-2">{badges.map((badge) => <span key={badge.name} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium ${badge.earned ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}><Award aria-hidden="true" className="h-3.5 w-3.5" />{badge.name}<span className="sr-only">{badge.earned ? copy(": diraih", ": earned") : copy(": belum diraih", ": locked")}</span></span>)}</div><p className="mt-3 text-xs leading-5 text-slate-500">{copy("Tuntaskan 3 misi untuk menambah minggu tuntas. Tidak harus berturut-turut. Badge goal dicatat saat review perencanaan.", "Complete all 3 missions to count a week. Weeks need not be consecutive. Goal badges are recorded during planning reviews.")}</p><p className="mt-2 text-xs leading-5 text-slate-500">{level >= 3 ? copy("Aksen indigo terbuka ✦", "Indigo accent unlocked ✦") : level >= 2 ? copy("Aksen teal terbuka · Indigo di level 3", "Teal accent unlocked · Indigo at level 3") : copy("Level 2 membuka aksen teal untuk kartu ini.", "Level 2 unlocks a teal card accent.")}</p></div>
    </>}
  </section>;
}
