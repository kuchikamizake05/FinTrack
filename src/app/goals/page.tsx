"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Plus, Target, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import { calculateGoalProgress } from "@/lib/home";
import { supabase } from "@/infrastructure/supabase/browser-client";

type FinancialGoal = { id: string; name: string; target_amount: number; current_amount: number; currency: string; color: string | null; due_date: string | null; is_active: boolean };
type GoalForm = { name: string; targetAmount: string; currentAmount: string; currency: string; dueDate: string };

const emptyForm: GoalForm = { name: "", targetAmount: "", currentAmount: "0", currency: "IDR", dueDate: "" };

export default function GoalsPage() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<GoalForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true); setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { if (requestId === requestRef.current) setGoals([]); return; }
      const { data, error: goalsError } = await supabase.from("financial_goals").select("id,name,target_amount,current_amount,currency,color,due_date,is_active").eq("user_id", user.id).eq("is_active", true).order("due_date", { ascending: true, nullsFirst: false });
      if (goalsError) throw goalsError;
      if (requestId === requestRef.current) setGoals((data ?? []) as FinancialGoal[]);
    } catch (caught) {
      if (requestId === requestRef.current) { reportHandledError("Goals unavailable", caught, "Goals belum berhasil dimuat."); setError(t("Goals belum berhasil dimuat. Coba lagi.")); }
    } finally { if (requestId === requestRef.current) setLoading(false); }
  }, [t]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); requestRef.current += 1; }; }, [load]);

  const openSheet = () => { setForm(emptyForm); setSheetOpen(true); };
  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    const targetAmount = Number(form.targetAmount); const currentAmount = Number(form.currentAmount);
    if (!form.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(currentAmount) || currentAmount < 0 || !/^[A-Z]{3}$/.test(form.currency)) return;
    setSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error: insertError } = await supabase.from("financial_goals").insert({ user_id: user.id, name: form.name.trim(), target_amount: targetAmount, current_amount: currentAmount, currency: form.currency, due_date: form.dueDate || null });
      if (insertError) throw insertError;
      setSheetOpen(false); await load();
    } catch (caught) { reportHandledError("Goal save failed", caught, "Target belum tersimpan."); setError(t("Target belum tersimpan. Coba lagi.")); }
    finally { setSaving(false); }
  }

  async function archiveGoal(goal: FinancialGoal) {
    setArchivingId(goal.id);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error: updateError } = await supabase.from("financial_goals").update({ is_active: false }).eq("id", goal.id).eq("user_id", user.id);
      if (updateError) throw updateError;
      await load();
    } catch (caught) { reportHandledError("Goal archive failed", caught, "Target belum dapat diarsipkan."); setError(t("Target belum dapat diarsipkan. Coba lagi.")); }
    finally { setArchivingId(null); }
  }

  return <div className="app-page"><Navbar /><main id="main-content" tabIndex={-1} className="app-page-content max-w-5xl space-y-5 outline-none sm:space-y-6">
    <section className="flex items-start justify-between gap-4 pt-1 md:hidden"><div><h1 className="text-[1.75rem] font-bold leading-[1.06] tracking-[-0.045em] text-slate-900">{t("Goals")}</h1><p className="mt-2 text-[13px] leading-5 text-slate-500">{t("Mimpi besar, mulai dari recehan.")}</p></div><Button size="icon" onClick={openSheet} className="h-11 min-h-11 w-11 rounded-xl" aria-label={t("Tambah goal")}><Plus className="h-5 w-5" /></Button></section>
    <div className="hidden md:block"><PageHeader eyebrow={t("Target keuangan")} title={t("Goals")} description={t("Buat target, pantau progresnya, lalu arsipkan saat tujuan selesai.")} actions={<Button onClick={openSheet}><Plus className="h-4 w-4" /> {t("Tambah goal")}</Button>} /></div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {loading ? <div role="status" aria-label={t("Memuat goals")} className="grid animate-pulse gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-36 rounded-[var(--radius-surface)] border border-emerald-100 bg-white/80" />)}<span className="sr-only">{t("Memuat goals")}</span></div> : goals.length === 0 ? <Surface className="rounded-2xl"><EmptyState icon={Target} title={t("Belum ada goal") } description={t("Buat target dana darurat, liburan, atau rencana besar lainnya.")} action={<Button onClick={openSheet}><Plus className="h-4 w-4" /> {t("Tambah goal")}</Button>} /></Surface> : <section className="grid gap-3 sm:grid-cols-2">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} onArchive={() => void archiveGoal(goal)} archiving={archivingId === goal.id} />)}</section>}
  </main>{sheetOpen && <DialogFrame titleId="goal-sheet-title" descriptionId="goal-sheet-description" onClose={() => !saving && setSheetOpen(false)} closeDisabled={saving}><div className="p-5"><div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-slate-200" /><div className="flex items-start justify-between gap-4"><div><h2 id="goal-sheet-title" className="text-xl font-bold tracking-[-0.03em] text-slate-900">{t("Goal baru")}</h2><p id="goal-sheet-description" className="mt-1 text-sm leading-5 text-slate-500">{t("Tentukan tujuan dan target yang ingin kamu capai.")}</p></div><button type="button" onClick={() => setSheetOpen(false)} aria-label={t("Tutup")} className="grid h-9 w-9 place-items-center rounded-lg text-xl text-slate-400"><X className="h-5 w-5" /></button></div><form onSubmit={saveGoal} className="mt-6 grid gap-4"><Field label={t("Nama goal")} htmlFor="goal-name"><input id="goal-name" required maxLength={120} placeholder={t("Contoh: Dana darurat")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldControlStyles} /></Field><Field label={t("Target")} htmlFor="goal-target"><input id="goal-target" required type="number" min="1" inputMode="numeric" placeholder={t("Rp 0")} value={form.targetAmount} onChange={(event) => setForm({ ...form, targetAmount: event.target.value })} className={fieldControlStyles} /></Field><Field label={t("Setoran awal")} htmlFor="goal-current"><input id="goal-current" required type="number" min="0" inputMode="numeric" value={form.currentAmount} onChange={(event) => setForm({ ...form, currentAmount: event.target.value })} className={fieldControlStyles} /></Field><Field label={t("Target tanggal")} htmlFor="goal-date"><input id="goal-date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={fieldControlStyles} /></Field><Button type="submit" loading={saving}><Plus className="h-4 w-4" /> {t("Simpan goal")}</Button></form></div></DialogFrame>}</div>;
}

function GoalCard({ goal, onArchive, archiving }: { goal: FinancialGoal; onArchive: () => void; archiving: boolean }) {
  const { t } = useLanguage();
  const progress = calculateGoalProgress(Number(goal.current_amount), Number(goal.target_amount));
  return <Surface className="rounded-2xl p-4"><div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-xl">🎯</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-bold text-slate-900">{goal.name}</h2>{goal.due_date && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {goal.due_date}</p>}</div><span className="text-sm font-extrabold text-emerald-700">{progress.percentage}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100" role="progressbar" aria-label={goal.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.percentage}%`, backgroundColor: goal.color ?? undefined }} /></div><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{formatMoney(Number(goal.current_amount), goal.currency)} / {formatMoney(Number(goal.target_amount), goal.currency)}</span><Button variant="ghost" size="compact" loading={archiving} onClick={onArchive} className="min-h-7 px-1.5 text-[11px] text-slate-400">{t("Arsipkan")}</Button></div></div></div></Surface>;
}

function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value); }
