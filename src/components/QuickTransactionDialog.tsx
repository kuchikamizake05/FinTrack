"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Plus, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { formatLocalDate } from "@/lib/planning";
import { supabase } from "@/infrastructure/supabase/browser-client";

type Account = { id: string; name: string; currency: string };
type Category = { name: string; type: "income" | "expense" };
type QuickTransactionForm = { type: "income" | "expense"; merchant: string; amount: string; accountId: string; category: string; date: string };

function initialForm(): QuickTransactionForm {
  return { type: "expense", merchant: "", amount: "", accountId: "", category: "", date: formatLocalDate(new Date()) };
}

export function QuickTransactionDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesi login tidak ditemukan.");
        const [accountResult, categoryResult] = await Promise.all([
          supabase.from("financial_accounts").select("id,name,currency").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: true }),
          supabase.from("categories").select("name,type").order("name", { ascending: true }),
        ]);
        if (accountResult.error) throw accountResult.error;
        if (categoryResult.error) throw categoryResult.error;
        if (!active) return;
        const nextAccounts = (accountResult.data ?? []) as Account[];
        setAccounts(nextAccounts);
        setCategories((categoryResult.data ?? []) as Category[]);
        setForm((current) => current.accountId || !nextAccounts[0] ? current : { ...current, accountId: nextAccounts[0].id });
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t("Form transaksi belum dapat dimuat."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [t]);

  const categoryOptions = useMemo(() => [...new Set(categories.filter((category) => category.type === form.type).map((category) => category.name))], [categories, form.type]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.accountId || !form.category.trim() || Number(form.amount) <= 0) {
      setError(t("Lengkapi akun, nominal, dan kategori terlebih dahulu."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: user.id,
        date: form.date,
        type: form.type,
        merchant: form.merchant.trim() || null,
        category: form.category.trim(),
        amount: Number(form.amount),
        account_id: form.accountId,
        source: "manual",
        status: "confirmed",
      });
      if (insertError) throw insertError;
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Transaksi belum berhasil disimpan. Coba lagi."));
    } finally {
      setSaving(false);
    }
  };

  return <DialogFrame titleId="quick-transaction-title" descriptionId="quick-transaction-description" onClose={() => !saving && onClose()} closeDisabled={saving} contentClassName="sm:max-w-md"><form onSubmit={submit}><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{t("Catat cepat")}</p><h2 id="quick-transaction-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">{t("Catat transaksi")}</h2><p id="quick-transaction-description" className="mt-1 text-xs leading-5 text-slate-500">{t("Simpan pengeluaran atau pemasukan tanpa meninggalkan halaman ini.")}</p></div><Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup form transaksi")}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 px-5 py-5"><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setForm((current) => ({ ...current, type: "expense", category: "" }))} className={`min-h-10 rounded-lg text-sm font-bold ${form.type === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}>{t("Pengeluaran")}</button><button type="button" onClick={() => setForm((current) => ({ ...current, type: "income", category: "" }))} className={`min-h-10 rounded-lg text-sm font-bold ${form.type === "income" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>{t("Pemasukan")}</button></div><Field label={t("Nominal")} htmlFor="quick-transaction-amount"><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span><input id="quick-transaction-amount" required type="number" min="1" inputMode="numeric" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" className={`${fieldControlStyles} pl-11 text-lg font-bold`} /></div></Field><Field label={t("Kategori")} htmlFor="quick-transaction-category"><input id="quick-transaction-category" required list="quick-transaction-categories" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder={t("Contoh: Makan")} className={fieldControlStyles} /><datalist id="quick-transaction-categories">{categoryOptions.map((category) => <option key={category} value={category} />)}</datalist></Field><Field label={t("Akun")} htmlFor="quick-transaction-account"><select id="quick-transaction-account" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={fieldControlStyles}><option value="">{t("Pilih akun")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label={t("Tanggal")} htmlFor="quick-transaction-date"><input id="quick-transaction-date" required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className={fieldControlStyles} /></Field><Field label={t("Merchant atau sumber")} htmlFor="quick-transaction-merchant"><input id="quick-transaction-merchant" value={form.merchant} onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))} placeholder={t("Opsional")} className={fieldControlStyles} /></Field></div>{accounts.length === 0 && !loading && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{t("Tambahkan Dompet terlebih dahulu sebelum mencatat transaksi.")} <Link href="/accounts" onClick={onClose} className="font-bold underline">{t("Buka Dompet")}</Link></p>}{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p>}</div><div className="flex gap-2 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"><Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1">{t("Batal")}</Button><Button type="submit" disabled={loading || saving || accounts.length === 0} className="flex-[1.35]">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Menyimpan...")}</> : <><Plus className="h-4 w-4" /> {t("Simpan")}</>}</Button></div></form></DialogFrame>;
}
