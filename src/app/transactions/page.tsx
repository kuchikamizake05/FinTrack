"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Edit3,
  Eye,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import {
  buildCategoryFilterOptions,
  buildTransactionCategoryOptions,
  type CategoryRecord,
  type CategoryType,
} from "@/lib/categories";
import { filterTransactions, type TransactionFilters } from "@/lib/finance";
import { getPrivateReceiptObjectPath } from "@/lib/shared-receipt";
import { supabase } from "@/infrastructure/supabase/browser-client";
import {
  canApproveTransaction,
  getTransactionSaveStatus,
  getTransactionSourceLabel,
  getTransactionStatusLabel,
  hasActiveTransactionFilters,
  summarizeTransactionList,
  validateTransactionForm,
} from "@/lib/transactions";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { formatLocalDate } from "@/lib/planning";
import { cn } from "@/lib/utils";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  merchant: string | null;
  category: string;
  amount: number;
  note: string | null;
  source: string;
  receipt_url: string | null;
  raw_text: string | null;
  ai_confidence: number | null;
  status: "confirmed" | "pending_approval" | "needs_review" | "deleted";
  created_at: string;
  account_id: string | null;
};

type FinancialAccount = {
  id: string;
  name: string;
  currency: string;
};

type TransactionFormState = {
  date: string;
  type: "income" | "expense";
  merchant: string;
  category: string;
  amount: string;
  note: string;
  accountId: string;
};

const defaultFilters: TransactionFilters = {
  search: "",
  category: "all",
  type: "all",
  status: "active",
  startDate: "",
  endDate: "",
};

function createDefaultForm(): TransactionFormState {
  return {
    date: formatLocalDate(new Date()),
    type: "expense",
    merchant: "",
    category: "",
    amount: "",
    note: "",
    accountId: "",
  };
}

export default function TransactionsPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : idLocale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoOpenedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<Transaction | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);
  const [dateFiltersOpen, setDateFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionFormState>(createDefaultForm);
  const merchantInputRef = useRef<HTMLInputElement>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [transactionResult, accountResult, categoryResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("financial_accounts")
          .select("id, name, currency")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("categories")
          .select("id, user_id, name, type, icon, color, created_at")
          .order("name", { ascending: true }),
      ]);

      if (transactionResult.error) throw transactionResult.error;
      if (accountResult.error) throw accountResult.error;
      if (categoryResult.error) throw categoryResult.error;
      setTransactions((transactionResult.data ?? []) as Transaction[]);
      setFinancialAccounts((accountResult.data ?? []) as FinancialAccount[]);
      setCategories((categoryResult.data ?? []) as CategoryRecord[]);
    } catch (error) {
      reportHandledError("Transactions unavailable", error, "Data transaksi belum berhasil dimuat.");
      setPageError("Data transaksi belum berhasil dimuat. Coba lagi beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchTransactions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchTransactions]);

  const filteredTx = useMemo(
    () => filterTransactions(transactions, filters),
    [filters, transactions],
  );
  const summary = useMemo(() => summarizeTransactionList(filteredTx), [filteredTx]);
  const accountNames = useMemo(
    () => new Map(financialAccounts.map((account) => [account.id, account.name])),
    [financialAccounts],
  );
  const filtersActive = hasActiveTransactionFilters(filters);
  const isEditMode = selectedTx !== null;
  const filterCategoryOptions = useMemo(
    () => buildCategoryFilterOptions(categories, transactions.map((transaction) => transaction.category)),
    [categories, transactions],
  );
  const transactionCategoryOptions = useMemo(
    () => buildTransactionCategoryOptions(categories, form.type, selectedTx?.category),
    [categories, form.type, selectedTx?.category],
  );

  const openAdd = useCallback(() => {
    setSelectedTx(null);
    const nextForm = createDefaultForm();
    nextForm.category = buildTransactionCategoryOptions(categories, "expense")[0] ?? "";
    setForm(nextForm);
    setFormError(null);
    setModalOpen(true);
  }, [categories]);

  useEffect(() => {
    if (loading || autoOpenedRef.current) return;

    const action = searchParams.get("new") === "1"
      ? "new"
      : searchParams.get("status") === "review"
        ? "review"
        : null;
    if (!action) return;

    const timer = window.setTimeout(() => {
      if (autoOpenedRef.current) return;
      autoOpenedRef.current = true;
      if (action === "new") {
        openAdd();
        router.replace("/transactions", { scroll: false });
        return;
      }
      setFilters((current) => ({ ...current, status: "review" }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loading, openAdd, router, searchParams]);

  const openEdit = (transaction: Transaction) => {
    setSelectedTx(transaction);
    setForm({
      date: transaction.date,
      type: transaction.type,
      merchant: transaction.merchant ?? "",
      category: transaction.category,
      amount: String(transaction.amount),
      note: transaction.note ?? "",
      accountId: transaction.account_id ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateTransactionForm(form);
    if (validationError || !form.category) {
      setFormError(validationError ?? "Pilih kategori sebelum menyimpan transaksi.");
      return;
    }

    if (!canWriteOnline()) {
      setFormError(offlineWriteMessage);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing authenticated user");

      const payload = {
        user_id: user.id,
        date: form.date,
        type: form.type,
        merchant: form.merchant.trim() || null,
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim() || null,
        source: selectedTx?.source ?? "manual",
        status: getTransactionSaveStatus(selectedTx?.status),
        account_id: form.accountId,
      };

      const result = isEditMode
        ? await supabase.from("transactions").update(payload).eq("id", selectedTx.id)
        : await supabase.from("transactions").insert([payload]);
      if (result.error) throw result.error;

      setModalOpen(false);
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction save failed", error, "Transaksi belum berhasil disimpan.");
      setFormError("Transaksi belum berhasil disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const requestApproval = (transaction: Transaction) => {
    setApproveTarget(transaction);
    setApproveError(null);
  };

  const handleApprove = async () => {
    if (!approveTarget || approvingId || !canApproveTransaction(approveTarget.status)) return;
    if (!canWriteOnline()) {
      setApproveError(offlineWriteMessage);
      return;
    }

    setApprovingId(approveTarget.id);
    setApproveError(null);
    try {
      const { error } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", approveTarget.id);
      if (error) throw error;
      setApproveTarget(null);
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction approval failed", error, "Transaksi belum berhasil disetujui.");
      setApproveError("Transaksi belum berhasil disetujui. Coba lagi.");
    } finally {
      setApprovingId(null);
    }
  };

  const requestDelete = (transaction: Transaction) => {
    setDeleteTarget(transaction);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deletingId) return;
    if (!canWriteOnline()) {
      setDeleteError(offlineWriteMessage);
      return;
    }

    const transactionId = deleteTarget.id;
    setDeletingId(transactionId);
    setDeleteError(null);
    try {
      const { error } = await supabase.from("transactions").update({ status: "deleted" }).eq("id", transactionId);
      if (error) throw error;
      setDeleteTarget(null);
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction delete failed", error, "Transaksi belum berhasil dihapus.");
      setDeleteError("Transaksi belum berhasil dihapus. Coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (transactionId: string) => {
    if (restoringId) return;
    if (!canWriteOnline()) {
      setPageError(offlineWriteMessage);
      return;
    }

    setRestoringId(transactionId);
    try {
      const { error } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", transactionId);
      if (error) throw error;
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction restore failed", error, "Transaksi belum berhasil dipulihkan.");
      setPageError("Transaksi belum berhasil dipulihkan. Coba lagi.");
    } finally {
      setRestoringId(null);
    }
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setDateFiltersOpen(false);
  };

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content space-y-5 outline-none sm:space-y-6">
        <PageHeader
          eyebrow={t("Ledger keuangan")}
          title={t("Transaksi")}
          description={t("{shown} dari {total} transaksi ditampilkan. Cari, tinjau, dan catat arus uang tanpa kehilangan konteks.", { shown: filteredTx.length, total: transactions.length })}
          actions={(
            <>
              <Link href="/categories" className={buttonStyles({ variant: "secondary" })}>
                <Tags className="h-4 w-4" /> {t("Kategori")}
              </Link>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" /> {t("Catat")}
              </Button>
            </>
          )}
        />

        <Surface className="grid overflow-hidden sm:grid-cols-3">
          <SummaryMetric icon={ArrowUpRight} label={t("Pemasukan terkonfirmasi")} value={formatIdr(summary.income)} tone="emerald" />
          <SummaryMetric icon={ArrowDownRight} label={t("Pengeluaran terkonfirmasi")} value={formatIdr(summary.expense)} tone="rose" />
          <SummaryMetric icon={CircleDollarSign} label={t("Selisih hasil filter")} value={formatSignedIdr(summary.net)} tone={summary.net >= 0 ? "emerald" : "rose"} />
        </Surface>

        {pageError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{pageError}</span>
            <Button variant="ghost" size="compact" onClick={() => void fetchTransactions()}>
              <RotateCcw className="h-4 w-4" /> {t("Coba lagi")}
            </Button>
          </div>
        )}

        <Surface className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <SlidersHorizontal className="h-4 w-4 text-emerald-700" /> {t("Cari dan filter")}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{t("Persempit ledger berdasarkan detail yang kamu ingat.")}</p>
            </div>
            {filtersActive && (
              <Button variant="ghost" size="compact" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" /> {t("Reset")}
              </Button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.5fr)_repeat(3,minmax(150px,0.75fr))]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label={t("Cari transaksi")}
                type="search"
                placeholder={t("Cari merchant, catatan, atau kategori")}
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                className={cn(fieldControlStyles, "pl-11")}
              />
            </div>
            <select
              aria-label={t("Filter tipe transaksi")}
              value={filters.type}
              onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as TransactionFilters["type"] }))}
              className={fieldControlStyles}
            >
              <option value="all">{t("Semua tipe")}</option>
              <option value="expense">{t("Pengeluaran")}</option>
              <option value="income">{t("Pemasukan")}</option>
            </select>
            <select
              aria-label={t("Filter kategori")}
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              className={fieldControlStyles}
            >
              <option value="all">{t("Semua kategori")}</option>
              {filterCategoryOptions.map((category) => <option key={category} value={category}>{t(category)}</option>)}
            </select>
            <select
              aria-label={t("Filter status transaksi")}
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TransactionFilters["status"] }))}
              className={fieldControlStyles}
            >
              <option value="active">{t("Transaksi aktif")}</option>
              <option value="review">{t("Perlu ditinjau & persetujuan")}</option>
              <option value="confirmed">{t("Terkonfirmasi")}</option>
              <option value="pending_approval">{t("Perlu persetujuan")}</option>
              <option value="needs_review">{t("Perlu ditinjau")}</option>
              <option value="deleted">{t("Sampah")}</option>
              <option value="all">{t("Semua riwayat")}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setDateFiltersOpen((value) => !value)}
            aria-expanded={dateFiltersOpen}
            className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-600 sm:hidden"
          >
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-700" /> {t("Rentang tanggal")}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", dateFiltersOpen && "rotate-180")} />
          </button>
          <div className={cn("mt-3 gap-3 sm:grid sm:grid-cols-2", dateFiltersOpen ? "grid" : "hidden")}>
            <Field label={t("Mulai tanggal")} htmlFor="filter-start-date">
              <input
                id="filter-start-date"
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                className={fieldControlStyles}
              />
            </Field>
            <Field label={t("Sampai tanggal")} htmlFor="filter-end-date">
              <input
                id="filter-end-date"
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                className={fieldControlStyles}
              />
            </Field>
          </div>
        </Surface>

        {loading ? (
          <TransactionSkeleton />
        ) : filteredTx.length === 0 ? (
          <Surface>
            <EmptyState
              icon={filtersActive ? Search : ReceiptText}
              title={filtersActive ? t("Tidak ada transaksi yang cocok") : t("Belum ada transaksi")}
              description={filtersActive ? t("Coba ubah kata kunci atau reset filter untuk melihat transaksi lain.") : t("Catat pemasukan atau pengeluaran pertama agar arus kas mulai terbaca.")}
              action={filtersActive
                ? <Button variant="secondary" onClick={resetFilters}><RotateCcw className="h-4 w-4" /> {t("Reset filter")}</Button>
                : <Button onClick={openAdd}><Plus className="h-4 w-4" /> {t("Catat")}</Button>}
            />
          </Surface>
        ) : (
          <TransactionResults
            transactions={filteredTx}
            accountNames={accountNames}
            dateLocale={dateLocale}
            onEdit={openEdit}
            onDelete={requestDelete}
            onRestore={handleRestore}
            onApprove={requestApproval}
            deletingId={deletingId}
            restoringId={restoringId}
            approvingId={approvingId}
          />
        )}
      </main>

      {approveTarget && (
        <ConfirmDialog
          titleId="approve-transaction-title"
          descriptionId="approve-transaction-description"
          title={t("Setujui “{name}”?", { name: approveTarget.merchant || approveTarget.category })}
          description={t("Transaksi ini akan menjadi terkonfirmasi dan mengubah saldo akun.")}
          confirmLabel={t("Setujui transaksi")}
          onClose={() => {
            if (!approvingId) {
              setApproveTarget(null);
              setApproveError(null);
            }
          }}
          onConfirm={() => void handleApprove()}
          loading={Boolean(approvingId)}
          error={approveError}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          titleId="delete-transaction-title"
          descriptionId="delete-transaction-description"
          title={t("Hapus “{name}”?", { name: deleteTarget.merchant || deleteTarget.category })}
          description={t("Transaksi akan dipindahkan ke Sampah. Saldo dan riwayat tetap dapat dipulihkan dari sana.")}
          confirmLabel={t("Hapus transaksi")}
          onClose={() => {
            if (!deletingId) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => void handleDelete()}
          loading={Boolean(deletingId)}
          error={deleteError}
        />
      )}

      {modalOpen && (
        <TransactionDialog
          form={form}
          setForm={setForm}
          accounts={financialAccounts}
          categories={categories}
          categoryOptions={transactionCategoryOptions}
          transaction={selectedTx}
          isEditMode={isEditMode}
          saving={saving}
          error={formError}
          merchantInputRef={merchantInputRef}
          onClose={closeModal}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value, tone }: {
  icon: typeof ArrowUpRight;
  label: string;
  value: string;
  tone: "emerald" | "rose";
}) {
  return (
    <div className="border-b border-emerald-100 px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon className={cn("h-4 w-4", tone === "emerald" ? "text-emerald-700" : "text-rose-600")} /> {label}
      </p>
      <p className={cn("mt-2 text-xl font-bold tracking-[-0.03em]", tone === "emerald" ? "text-emerald-700" : "text-rose-600")}>
        {value}
      </p>
    </div>
  );
}

function TransactionResults({ transactions, accountNames, dateLocale, onEdit, onDelete, onRestore, onApprove, deletingId, restoringId, approvingId }: {
  transactions: Transaction[];
  accountNames: ReadonlyMap<string, string>;
  dateLocale: typeof idLocale;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onRestore: (transactionId: string) => Promise<void>;
  onApprove: (transaction: Transaction) => void;
  deletingId: string | null;
  restoringId: string | null;
  approvingId: string | null;
}) {
  const { t } = useLanguage();
  return (
    <>
      <Surface className="hidden overflow-hidden md:block">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t("Ledger transaksi")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("Urutan terbaru berdasarkan tanggal transaksi.")}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{t("{count} item", { count: transactions.length })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              <tr>
                <th className="px-5 py-3">{t("Transaksi")}</th>
                <th className="px-5 py-3">{t("Akun & kategori")}</th>
                <th className="px-5 py-3 text-right">{t("Jumlah")}</th>
                <th className="px-5 py-3">{t("Status")}</th>
                <th className="px-5 py-3 text-right">{t("Aksi")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="group hover:bg-emerald-50/35">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800">{transaction.merchant || t(transaction.category)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" /> {format(parseISO(transaction.date), "dd MMM yyyy", { locale: dateLocale })}
                      {transaction.note && <span className="max-w-[220px] truncate">· {transaction.note}</span>}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <WalletCards className="h-4 w-4 text-emerald-700" /> {transaction.account_id ? accountNames.get(transaction.account_id) ?? t("Akun tidak tersedia") : t("Tanpa akun")}
                    </p>
                    <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t(transaction.category)}</span>
                  </td>
                  <td className={cn("px-5 py-4 text-right text-sm font-bold", transaction.type === "income" ? "text-emerald-700" : "text-slate-800")}>
                    {transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={transaction.status} />
                    <p className="mt-1.5 text-[11px] font-medium text-slate-400">{t(getTransactionSourceLabel(transaction.source))}</p>
                  </td>
                  <td className="px-5 py-4">
                    <TransactionActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} onRestore={onRestore} onApprove={onApprove} deletingId={deletingId} restoringId={restoringId} approvingId={approvingId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <div className="space-y-3 md:hidden">
        {transactions.map((transaction) => (
          <Surface key={transaction.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{transaction.merchant || t(transaction.category)}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" /> {format(parseISO(transaction.date), "dd MMM yyyy", { locale: dateLocale })}
                </p>
              </div>
              <p className={cn("shrink-0 text-sm font-bold", transaction.type === "income" ? "text-emerald-700" : "text-slate-900")}>
                {transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-slate-100 pt-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-600">
                  {transaction.account_id ? accountNames.get(transaction.account_id) ?? t("Akun tidak tersedia") : t("Tanpa akun")} · {t(transaction.category)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={transaction.status} />
                  <span className="text-[11px] text-slate-400">{t(getTransactionSourceLabel(transaction.source))}</span>
                </div>
              </div>
              <TransactionActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} onRestore={onRestore} onApprove={onApprove} deletingId={deletingId} restoringId={restoringId} approvingId={approvingId} />
            </div>
            {transaction.note && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">{transaction.note}</p>}
          </Surface>
        ))}
      </div>
    </>
  );
}

function TransactionActions({ transaction, onEdit, onDelete, onRestore, onApprove, deletingId, restoringId, approvingId }: {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onRestore: (transactionId: string) => Promise<void>;
  onApprove: (transaction: Transaction) => void;
  deletingId: string | null;
  restoringId: string | null;
  approvingId: string | null;
}) {
  const { t } = useLanguage();
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [openingReceipt, setOpeningReceipt] = useState(false);

  const openReceipt = async () => {
    if (openingReceipt || !transaction.receipt_url) return;
    setOpeningReceipt(true);
    setReceiptError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Missing authenticated user");
      const objectPath = getPrivateReceiptObjectPath(transaction.receipt_url, user.id);
      if (!objectPath) throw new Error("Invalid receipt path");
      const { data, error } = await supabase.storage.from("receipts").createSignedUrl(objectPath, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Receipt URL unavailable");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      reportHandledError("Receipt signed URL failed", error, "Struk belum dapat dibuka.");
      setReceiptError(t("Struk belum dapat dibuka. Coba lagi."));
    } finally {
      setOpeningReceipt(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {transaction.receipt_url && (
        <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg" onClick={() => void openReceipt()} loading={openingReceipt} aria-label={t("Lihat struk {name}", { name: transaction.merchant || transaction.category })}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {transaction.status === "deleted" ? (
        <Button variant="secondary" size="compact" onClick={() => void onRestore(transaction.id)} loading={restoringId === transaction.id}>
          <RotateCcw className="h-3.5 w-3.5" /> {t("Pulihkan")}
        </Button>
      ) : (
        <>
          {canApproveTransaction(transaction.status) && (
            <Button variant="secondary" size="compact" onClick={() => onApprove(transaction)} loading={approvingId === transaction.id}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("Setujui")}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg" onClick={() => onEdit(transaction)} aria-label={t("Edit {name}", { name: transaction.merchant || transaction.category })}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onDelete(transaction)} disabled={Boolean(deletingId)} aria-label={t("Hapus {name}", { name: transaction.merchant || transaction.category })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
      {receiptError && <p role="alert" className="basis-full text-right text-[11px] text-rose-700">{receiptError}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const { t } = useLanguage();
  const tones = {
    confirmed: "bg-emerald-50 text-emerald-700",
    pending_approval: "bg-amber-50 text-amber-700",
    needs_review: "bg-rose-50 text-rose-700",
    deleted: "bg-slate-100 text-slate-500",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold", tones[status])}>{t(getTransactionStatusLabel(status))}</span>;
}

function TransactionDialog({ form, setForm, accounts, categories, categoryOptions, transaction, isEditMode, saving, error, merchantInputRef, onClose, onSubmit }: {
  form: TransactionFormState;
  setForm: Dispatch<SetStateAction<TransactionFormState>>;
  accounts: FinancialAccount[];
  categories: CategoryRecord[];
  categoryOptions: string[];
  transaction: Transaction | null;
  isEditMode: boolean;
  saving: boolean;
  error: string | null;
  merchantInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { t } = useLanguage();
  const changeType = (type: CategoryType) => {
    const options = buildTransactionCategoryOptions(categories, type);
    setForm((current) => ({ ...current, type, category: options.includes(current.category) ? current.category : options[0] ?? "" }));
  };
  return (
    <DialogFrame
      titleId="transaction-dialog-title"
      descriptionId="transaction-dialog-description"
      initialFocusRef={merchantInputRef}
      onClose={onClose}
      closeDisabled={saving}
    >
      <form onSubmit={onSubmit}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{isEditMode ? t("Perbarui ledger") : t("Transaksi baru")}</p>
            <h2 id="transaction-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {isEditMode ? t("Edit transaksi") : t("Catat transaksi")}
            </h2>
            <p id="transaction-dialog-description" className="mt-1 text-xs leading-5 text-slate-500">{t("Isi detail utama. Biasanya selesai kurang dari satu menit.")}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup form transaksi")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label={t("Tipe transaksi")}>
            <button
              type="button"
              aria-pressed={form.type === "expense"}
              onClick={() => changeType("expense")}
              className={cn("min-h-11 rounded-lg text-sm font-bold transition", form.type === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500")}
            >
              {t("Pengeluaran")}
            </button>
            <button
              type="button"
              aria-pressed={form.type === "income"}
              onClick={() => changeType("income")}
              className={cn("min-h-11 rounded-lg text-sm font-bold transition", form.type === "income" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500")}
            >
              {t("Pemasukan")}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Merchant atau sumber")} htmlFor="transaction-merchant" hint={t("Contoh: Superindo atau Gaji bulanan.")}>
              <input
                ref={merchantInputRef}
                id="transaction-merchant"
                value={form.merchant}
                onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))}
                placeholder={t("Nama transaksi")}
                className={fieldControlStyles}
              />
            </Field>
            <Field label={t("Tanggal")} htmlFor="transaction-date">
              <input
                id="transaction-date"
                type="date"
                required
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className={fieldControlStyles}
              />
            </Field>
          </div>

          <Field label={t("Akun")} htmlFor="transaction-account" hint={accounts.length === 0 ? t("Tambahkan akun dahulu melalui halaman Akun & saldo.") : t("Saldo akun akan mengikuti transaksi ini.")}>
            <select
              id="transaction-account"
              required
              value={form.accountId}
              onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
              className={fieldControlStyles}
            >
              <option value="">{t("Pilih akun")}</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
          </Field>

          <Field label={t("Nominal")} htmlFor="transaction-amount" hint={t("Masukkan angka tanpa tanda titik atau koma.")} descriptionId="transaction-amount-hint">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
              <input
                id="transaction-amount"
                aria-describedby="transaction-amount-hint"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0"
                className={cn(fieldControlStyles, "pl-11 text-lg font-bold")}
              />
            </div>
          </Field>

          <Field label={t("Kategori")} htmlFor="transaction-category">
            <select
              id="transaction-category"
              required
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className={fieldControlStyles}
            >
              {categoryOptions.length === 0 && <option value="">{t("Belum ada kategori untuk tipe ini")}</option>}
              {categoryOptions.map((category) => <option key={category} value={category}>{t(category)}</option>)}
            </select>
            {categoryOptions.length === 0 && <p className="mt-2 text-xs leading-5 text-amber-700">{t("Buat kategori {type} di ", { type: form.type === "expense" ? t("Pengeluaran") : t("Pemasukan") })}<Link href="/categories" className="font-bold underline underline-offset-2">{t("halaman Kategori")}</Link>.</p>}
          </Field>

          <Field label={t("Catatan")} htmlFor="transaction-note" hint={t("Opsional—tambahkan konteks yang berguna saat ditinjau nanti.")}>
            <textarea
              id="transaction-note"
              rows={3}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder={t("Catatan singkat")}
              className={cn(fieldControlStyles, "resize-none")}
            />
          </Field>

          {transaction && canApproveTransaction(transaction.status) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <p className="font-bold">{t("Transaksi masih perlu ditinjau.")}</p>
              <p>{t("Simpan perubahan tidak mengubah saldo. Gunakan Setujui setelah detail benar.")}</p>
              {transaction.receipt_url && <p className="mt-2">{t("Bukti struk tersedia.")}</p>}
              {transaction.ai_confidence !== null && <p>{t("Keyakinan ekstraksi AI: {confidence}%", { confidence: Math.round(transaction.ai_confidence * 100) })}</p>}
              {transaction.raw_text && <details className="mt-2"><summary className="cursor-pointer font-semibold">{t("Lihat teks hasil ekstraksi")}</summary><p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-xs text-slate-700">{transaction.raw_text}</p></details>}
            </div>
          )}

          <div aria-live="polite" aria-atomic="true">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p>}
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
          <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">{t("Batal")}</Button>
          <Button type="submit" disabled={saving || accounts.length === 0 || categoryOptions.length === 0} className="flex-[1.4] sm:flex-none">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Menyimpan...")}</> : <><FileSpreadsheet className="h-4 w-4" /> {isEditMode ? t("Simpan perubahan") : t("Simpan transaksi")}</>}
          </Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function TransactionSkeleton() {
  return (
    <Surface className="animate-pulse overflow-hidden" aria-label="Memuat transaksi">
      <div className="h-16 border-b border-slate-100 bg-white" />
      {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 border-b border-slate-100 bg-slate-50/50 last:border-0" />)}
      <span className="sr-only">Memuat transaksi...</span>
    </Surface>
  );
}

function formatIdr(value: number) {
  return `Rp${Math.abs(value).toLocaleString("id-ID")}`;
}

function formatSignedIdr(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatIdr(value)}`;
}
