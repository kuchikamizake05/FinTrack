"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  BriefcaseBusiness,
  Car,
  CircleDot,
  CreditCard,
  Edit3,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Layers3,
  Palette,
  PiggyBank,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Tag,
  Tags,
  Trash2,
  Tv,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import {
  CATEGORY_ICONS,
  buildAllTimeCategoryUsage,
  buildCategoryUsage,
  filterCategories,
  getCategoryEditLocks,
  normalizeCategoryIcon,
  summarizeCategories,
  validateCategoryForm,
  type CategoryFormErrors,
  type CategoryIcon,
  type CategoryRecord,
  type CategoryType,
  type CategoryUsage,
} from "@/lib/categories";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { cn } from "@/lib/utils";

const iconMap: Record<CategoryIcon, LucideIcon> = {
  Tag,
  Utensils,
  Car,
  ShoppingBag,
  CreditCard,
  Tv,
  HeartPulse,
  GraduationCap,
  Home,
  BriefcaseBusiness,
  Gift,
  PiggyBank,
};

const iconLabels: Record<CategoryIcon, string> = {
  Tag: "Umum",
  Utensils: "Makanan",
  Car: "Transportasi",
  ShoppingBag: "Belanja",
  CreditCard: "Tagihan",
  Tv: "Hiburan",
  HeartPulse: "Kesehatan",
  GraduationCap: "Pendidikan",
  Home: "Rumah",
  BriefcaseBusiness: "Pekerjaan",
  Gift: "Hadiah",
  PiggyBank: "Tabungan",
};

const presetColors = ["#166534", "#047857", "#0f766e", "#0369a1", "#4338ca", "#7e22ce", "#be123c", "#b45309"];
const defaultForm = { name: "", type: "expense" as CategoryType, icon: "Tag" as CategoryIcon, color: "#166534" };

export default function CategoriesPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [currentUsage, setCurrentUsage] = useState<CategoryUsage>({});
  const [allTimeUsage, setAllTimeUsage] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CategoryType>("expense");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date()), "yyyy-MM-dd");
      const [categoryResult, currentResult, allTimeResult] = await Promise.all([
        supabase.from("categories").select("id, user_id, name, type, icon, color, created_at").order("name", { ascending: true }),
        supabase.from("transactions").select("category, amount, type, status").eq("user_id", user.id).eq("status", "confirmed").gte("date", start).lte("date", end),
        supabase.from("transactions").select("category, status").eq("user_id", user.id).neq("status", "deleted"),
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (currentResult.error) throw currentResult.error;
      if (allTimeResult.error) throw allTimeResult.error;
      setCategories((categoryResult.data ?? []) as CategoryRecord[]);
      setCurrentUsage(buildCategoryUsage((currentResult.data ?? []) as Parameters<typeof buildCategoryUsage>[0]));
      setAllTimeUsage(buildAllTimeCategoryUsage((allTimeResult.data ?? []) as Parameters<typeof buildAllTimeCategoryUsage>[0]));
    } catch (error) {
      reportHandledError("Categories unavailable", error, "Kategori belum berhasil dimuat.");
      setPageError(t("Kategori belum berhasil dimuat. Coba lagi beberapa saat lagi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchCategories(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchCategories]);

  const filteredCategories = useMemo(
    () => filterCategories(categories, { search, type: typeFilter }),
    [categories, search, typeFilter],
  );
  const summary = useMemo(() => summarizeCategories(categories, currentUsage), [categories, currentUsage]);

  function openCreateForm() {
    setEditingCategory(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEditForm(category: CategoryRecord) {
    if (!getCategoryEditLocks(category, allTimeUsage).canEdit) return;
    setEditingCategory(category);
    setForm({
      name: category.name,
      type: category.type,
      icon: normalizeCategoryIcon(category.icon),
      color: category.color && /^#[0-9a-f]{6}$/i.test(category.color) ? category.color : "#166534",
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setFormErrors({});
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateCategoryForm(form, categories, editingCategory?.id);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    if (!canWriteOnline()) {
      setFormErrors({ name: t(offlineWriteMessage) });
      return;
    }

    setSaving(true);
    setFormErrors({});
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const locks = editingCategory ? getCategoryEditLocks(editingCategory, allTimeUsage) : null;
      const payload = locks?.identityLocked
        ? { icon: form.icon, color: form.color }
        : { name: form.name.trim(), type: form.type, icon: form.icon, color: form.color };
      const result = editingCategory
        ? await supabase.from("categories").update(payload).eq("id", editingCategory.id).eq("user_id", user.id)
        : await supabase.from("categories").insert({ ...payload, user_id: user.id });
      if (result.error) throw result.error;
      setFormOpen(false);
      await fetchCategories();
    } catch (error) {
      reportHandledError("Category save failed", error, "Kategori belum berhasil disimpan.");
      setFormErrors({ name: t("Kategori belum berhasil disimpan. Silakan coba lagi.") });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || saving) return;
    if (!canWriteOnline()) {
      setDeleteError(t(offlineWriteMessage));
      return;
    }

    setSaving(true);
    setDeleteError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id).eq("user_id", user.id);
      if (error) throw error;
      setDeleteTarget(null);
      await fetchCategories();
    } catch (error) {
      reportHandledError("Category delete failed", error, "Kategori belum berhasil dihapus.");
      setDeleteError(t("Kategori belum berhasil dihapus. Riwayat transaksi Anda tetap aman."));
    } finally {
      setSaving(false);
    }
  }

  const hasFilters = Boolean(search.trim() || typeFilter !== "expense");

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content space-y-5 outline-none sm:space-y-6">
        <PageHeader
          eyebrow={t("Category ledger")}
          title={t("Kategori")}
          description={t("Susun pemasukan dan pengeluaran dengan struktur yang mudah dipakai, tanpa mengganggu riwayat transaksi lama.")}
          actions={<Button onClick={openCreateForm}><Plus className="h-4 w-4" /> {t("Tambah kategori")}</Button>}
        />

        {pageError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{pageError}</span>
            <Button variant="secondary" size="compact" onClick={() => void fetchCategories()}>{t("Coba lagi")}</Button>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3" aria-label={t("Ringkasan kategori")}>
          <SummaryCard label={t("Kategori terlihat")} value={summary.visible} hint={t("Bawaan dan kategori buatan Anda")} icon={Layers3} />
          <SummaryCard label={t("Dipakai bulan ini")} value={summary.used} hint={t("Kategori dengan transaksi terkonfirmasi")} icon={Tags} />
          <SummaryCard label={t("Transaksi terkonfirmasi")} value={summary.transactions} hint={t("Aktivitas bulan berjalan")} icon={CircleDot} />
        </section>

        <Surface className="overflow-hidden">
          <div className="border-b border-emerald-100 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label={t("Tipe kategori")}>
                {(["expense", "income", "all"] as const).map((type) => (
                  <button
                    key={type}
                    id={`category-filter-tab-${type}`}
                    type="button"
                    role="tab"
                    aria-controls="category-filter-results"
                    tabIndex={typeFilter === type ? 0 : -1}
                    aria-selected={typeFilter === type}
                    onClick={() => setTypeFilter(type)}
                    className={cn("min-h-10 shrink-0 rounded-lg px-4 text-sm font-bold transition", typeFilter === type ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >
                    {type === "expense" ? t("Pengeluaran") : type === "income" ? t("Pemasukan") : t("Semua")}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <label className="relative min-w-0 flex-1 lg:w-72" htmlFor="category-search">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <span className="sr-only">{t("Cari kategori")}</span>
                  <input id="category-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Cari kategori")} className={cn(fieldControlStyles, "pl-10")} />
                </label>
                {hasFilters && <Button variant="ghost" size="icon" onClick={() => { setSearch(""); setTypeFilter("expense"); }} aria-label={t("Reset filter")}><RotateCcw className="h-4 w-4" /></Button>}
              </div>
            </div>
          </div>

          <div id="category-filter-results" role="tabpanel" aria-labelledby={`category-filter-tab-${typeFilter}`}>
          {loading ? <CategorySkeleton /> : filteredCategories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={categories.length === 0 ? t("Belum ada kategori") : t("Kategori tidak ditemukan")}
              description={categories.length === 0 ? t("Buat kategori pertama agar pencatatan transaksi lebih rapi.") : t("Coba kata kunci atau tipe kategori lain.")}
              action={categories.length === 0 ? <Button onClick={openCreateForm}><Plus className="h-4 w-4" /> {t("Tambah kategori")}</Button> : <Button variant="secondary" onClick={() => { setSearch(""); setTypeFilter("all"); }}>{t("Reset pencarian")}</Button>}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                    <tr><th className="w-[34%] px-5 py-3">{t("Kategori")}</th><th className="w-[18%] px-4 py-3">{t("Tipe")}</th><th className="w-[20%] px-4 py-3">{t("Bulan ini")}</th><th className="w-[16%] px-4 py-3">{t("Penggunaan")}</th><th className="w-[12%] px-5 py-3 text-right">{t("Aksi")}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.map((category) => <CategoryRow key={category.id} category={category} usage={currentUsage[category.name]} allTimeCount={allTimeUsage[category.name] ?? 0} onEdit={openEditForm} onDelete={setDeleteTarget} />)}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredCategories.map((category) => <CategoryCard key={category.id} category={category} usage={currentUsage[category.name]} allTimeCount={allTimeUsage[category.name] ?? 0} onEdit={openEditForm} onDelete={setDeleteTarget} />)}
              </div>
            </>
          )}
          </div>
        </Surface>
      </main>

      {formOpen && <CategoryFormDialog category={editingCategory} allTimeUsage={allTimeUsage} form={form} setForm={setForm} errors={formErrors} saving={saving} nameInputRef={nameInputRef} onClose={closeForm} onSubmit={handleSave} />}
      {deleteTarget && <DeleteCategoryDialog category={deleteTarget} usageCount={allTimeUsage[deleteTarget.name] ?? 0} saving={saving} error={deleteError} onClose={() => { if (!saving) { setDeleteTarget(null); setDeleteError(null); } }} onConfirm={() => void handleDelete()} />}
    </div>
  );
}

function SummaryCard({ label, value, hint, icon: Icon }: { label: string; value: number; hint: string; icon: LucideIcon }) {
  return <Surface className="p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value.toLocaleString("id-ID")}</p><p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span></div></Surface>;
}

function CategoryIdentity({ category }: { category: CategoryRecord }) {
  const { t } = useLanguage();
  const Icon = iconMap[normalizeCategoryIcon(category.icon)];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: category.color || "#166534" }}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{t(category.name)}</p>
          {category.user_id === null && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("Bawaan")}</span>}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{t(iconLabels[normalizeCategoryIcon(category.icon)])}</p>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: CategoryType }) {
  const { t } = useLanguage();
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", type === "expense" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>{type === "expense" ? t("Pengeluaran") : t("Pemasukan")}</span>;
}

type CategoryDisplayProps = { category: CategoryRecord; usage?: { amount: number; count: number }; allTimeCount: number; onEdit: (category: CategoryRecord) => void; onDelete: (category: CategoryRecord) => void };

function CategoryActions({ category, onEdit, onDelete }: Pick<CategoryDisplayProps, "category" | "onEdit" | "onDelete">) {
  const { t } = useLanguage();
  if (category.user_id === null) return <span className="text-xs text-slate-400">{t("Dikelola sistem")}</span>;
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={() => onEdit(category)} aria-label={t("Edit {name}", { name: t(category.name) })}>
        <Edit3 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="hover:bg-rose-50 hover:text-rose-700" onClick={() => onDelete(category)} aria-label={t("Hapus {name}", { name: t(category.name) })}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CategoryRow({ category, usage, allTimeCount, onEdit, onDelete }: CategoryDisplayProps) {
  const { t } = useLanguage();
  return (
    <tr className="transition hover:bg-emerald-50/30">
      <td className="px-5 py-4"><CategoryIdentity category={category} /></td>
      <td className="px-4 py-4"><TypeBadge type={category.type} /></td>
      <td className="px-4 py-4">
        <p className="text-sm font-bold text-slate-800">{formatIdr(usage?.amount ?? 0)}</p>
        <p className="mt-0.5 text-xs text-slate-400">{t("{count} terkonfirmasi", { count: usage?.count ?? 0 })}</p>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-semibold text-slate-700">{t("{count} transaksi", { count: allTimeCount })}</p>
        <p className="mt-0.5 text-xs text-slate-400">{t("Sepanjang waktu")}</p>
      </td>
      <td className="px-5 py-4"><CategoryActions category={category} onEdit={onEdit} onDelete={onDelete} /></td>
    </tr>
  );
}

function CategoryCard({ category, usage, allTimeCount, onEdit, onDelete }: CategoryDisplayProps) {
  const { t } = useLanguage();
  return (
    <article className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <CategoryIdentity category={category} />
        <CategoryActions category={category} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="flex items-center justify-between">
        <TypeBadge type={category.type} />
        <span className="text-xs font-semibold text-slate-500">{t("{count} transaksi total", { count: allTimeCount })}</span>
      </div>
      <div className="rounded-xl bg-slate-50 px-3.5 py-3">
        <p className="text-xs font-semibold text-slate-400">{t("Bulan ini")}</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="text-base font-bold text-slate-900">{formatIdr(usage?.amount ?? 0)}</p>
          <p className="text-xs text-slate-500">{t("{count} terkonfirmasi", { count: usage?.count ?? 0 })}</p>
        </div>
      </div>
    </article>
  );
}

function CategoryFormDialog({ category, allTimeUsage, form, setForm, errors, saving, nameInputRef, onClose, onSubmit }: { category: CategoryRecord | null; allTimeUsage: Record<string, number>; form: typeof defaultForm; setForm: React.Dispatch<React.SetStateAction<typeof defaultForm>>; errors: CategoryFormErrors; saving: boolean; nameInputRef: React.RefObject<HTMLInputElement | null>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const { t } = useLanguage();
  const identityLocked = category ? getCategoryEditLocks(category, allTimeUsage).identityLocked : false;
  const description = identityLocked
    ? t("Kategori sudah digunakan. Nama dan tipe dikunci agar riwayat tetap konsisten.")
    : t("Pilih identitas yang mudah dikenali saat mencatat transaksi.");

  return (
    <DialogFrame
      titleId="category-dialog-title"
      descriptionId="category-dialog-description"
      initialFocusRef={nameInputRef}
      onClose={onClose}
      closeDisabled={saving}
    >
      <form onSubmit={onSubmit}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{category ? t("Perbarui kategori") : t("Kategori baru")}</p>
            <h2 id="category-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">{category ? t("Edit {name}", { name: t(category.name) }) : t("Tambah kategori")}</h2>
            <p id="category-dialog-description" className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup form kategori")}><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label={t("Tipe kategori")}>
            {(["expense", "income"] as const).map((type) => (
              <button
                key={type}
                type="button"
                disabled={identityLocked}
                aria-pressed={form.type === type}
                onClick={() => setForm((current) => ({ ...current, type }))}
                className={cn("min-h-11 rounded-lg text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60", form.type === type ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}
              >
                {type === "expense" ? t("Pengeluaran") : t("Pemasukan")}
              </button>
            ))}
          </div>
          <Field label={t("Nama kategori")} htmlFor="category-name" error={errors.name ? t(errors.name) : undefined} hint={identityLocked ? t("Nama tetap mengikuti transaksi sebelumnya.") : t("Maksimal 48 karakter.")}>
            <input ref={nameInputRef} id="category-name" maxLength={48} disabled={identityLocked} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("Contoh: Hewan peliharaan")} className={fieldControlStyles} />
          </Field>
          <Field label={t("Ikon")} htmlFor="category-icon" error={errors.icon ? t(errors.icon) : undefined}>
            <div id="category-icon" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {CATEGORY_ICONS.map((icon) => {
                const Icon = iconMap[icon];
                return <button key={icon} type="button" title={t(iconLabels[icon])} aria-label={t(iconLabels[icon])} aria-pressed={form.icon === icon} onClick={() => setForm((current) => ({ ...current, icon }))} className={cn("flex min-h-12 items-center justify-center rounded-xl border transition", form.icon === icon ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100" : "border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50")}><Icon className="h-5 w-5" aria-hidden="true" /></button>;
              })}
            </div>
          </Field>
          <Field label={t("Warna")} htmlFor="category-color" error={errors.color ? t(errors.color) : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              {presetColors.map((color) => <button key={color} type="button" aria-label={t("Pilih warna {color}", { color })} aria-pressed={form.color === color} onClick={() => setForm((current) => ({ ...current, color }))} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 transition", form.color === color ? "border-slate-900 ring-2 ring-slate-200 ring-offset-2" : "border-white")} style={{ backgroundColor: color }}>{form.color === color && <CircleDot className="h-4 w-4 text-white" aria-hidden="true" />}</button>)}
              <label htmlFor="category-color" className="relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-slate-500" title={t("Pilih warna lain")}><Palette className="h-4 w-4" aria-hidden="true" /><input id="category-color" type="color" value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} className="absolute inset-0 cursor-pointer opacity-0" /></label>
            </div>
          </Field>
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
          <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">{t("Batal")}</Button>
          <Button type="submit" loading={saving} className="flex-[1.4] sm:flex-none">{category ? t("Simpan perubahan") : t("Tambah kategori")}</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function DeleteCategoryDialog({ category, usageCount, saving, error, onClose, onConfirm }: { category: CategoryRecord; usageCount: number; saving: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  const { t } = useLanguage();
  return (
    <ConfirmDialog
      titleId="delete-category-title"
      descriptionId="delete-category-description"
      title={t("Hapus “{name}”?", { name: t(category.name) })}
      description={<>{t("Kategori akan hilang dari pilihan baru. ")}{usageCount > 0 ? t("{count} transaksi lama tetap menyimpan label kategori ini dan tidak ikut terhapus.", { count: usageCount }) : t("Tidak ada transaksi aktif yang memakai kategori ini.")}</>}
      confirmLabel={t("Hapus kategori")}
      cancelLabel={t("Batal")}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={saving}
      error={error}
    />
  );
}

function CategorySkeleton() {
  return <div className="animate-pulse divide-y divide-slate-100" aria-label="Memuat kategori">{[0, 1, 2, 3].map((item) => <div key={item} className="h-20 bg-slate-50/50" />)}<span className="sr-only">Memuat kategori...</span></div>;
}

function formatIdr(value: number) {
  return `Rp${Number(value).toLocaleString("id-ID")}`;
}
