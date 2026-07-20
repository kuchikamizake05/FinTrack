"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
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
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { supabase } from "@/infrastructure/supabase/browser-client";
import {
  getTransactionSourceLabel,
  getTransactionStatusLabel,
  hasActiveTransactionFilters,
  summarizeTransactionList,
  validateTransactionForm,
} from "@/lib/transactions";
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
    date: new Date().toISOString().split("T")[0],
    type: "expense",
    merchant: "",
    category: "",
    amount: "",
    note: "",
    accountId: "",
  };
}

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => merchantInputRef.current?.focus(), 80);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen, saving]);

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

  const openAdd = () => {
    setSelectedTx(null);
    const nextForm = createDefaultForm();
    nextForm.category = buildTransactionCategoryOptions(categories, "expense")[0] ?? "";
    setForm(nextForm);
    setFormError(null);
    setModalOpen(true);
  };

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
        status: "confirmed",
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

  const handleDelete = async (transactionId: string) => {
    if (!window.confirm("Hapus transaksi ini? Kamu masih dapat memulihkannya dari Sampah.")) return;
    try {
      const { error } = await supabase.from("transactions").update({ status: "deleted" }).eq("id", transactionId);
      if (error) throw error;
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction delete failed", error, "Transaksi belum berhasil dihapus.");
      setPageError("Transaksi belum berhasil dihapus. Coba lagi.");
    }
  };

  const handleRestore = async (transactionId: string) => {
    try {
      const { error } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", transactionId);
      if (error) throw error;
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction restore failed", error, "Transaksi belum berhasil dipulihkan.");
      setPageError("Transaksi belum berhasil dipulihkan. Coba lagi.");
    }
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setDateFiltersOpen(false);
  };

  return (
    <div className="app-page">
      <Navbar />
      <main className="app-page-content space-y-5 sm:space-y-6">
        <PageHeader
          eyebrow="Ledger keuangan"
          title="Transaksi"
          description={`${filteredTx.length} dari ${transactions.length} transaksi ditampilkan. Cari, tinjau, dan catat arus uang tanpa kehilangan konteks.`}
          actions={(
            <>
              <Link href="/categories" className={buttonStyles({ variant: "secondary" })}>
                <Tags className="h-4 w-4" /> Kategori
              </Link>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" /> Catat transaksi
              </Button>
            </>
          )}
        />

        <Surface className="grid overflow-hidden sm:grid-cols-3">
          <SummaryMetric icon={ArrowUpRight} label="Pemasukan terkonfirmasi" value={formatIdr(summary.income)} tone="emerald" />
          <SummaryMetric icon={ArrowDownRight} label="Pengeluaran terkonfirmasi" value={formatIdr(summary.expense)} tone="rose" />
          <SummaryMetric icon={CircleDollarSign} label="Selisih hasil filter" value={formatSignedIdr(summary.net)} tone={summary.net >= 0 ? "emerald" : "rose"} />
        </Surface>

        {pageError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{pageError}</span>
            <Button variant="ghost" size="compact" onClick={() => void fetchTransactions()}>
              <RotateCcw className="h-4 w-4" /> Coba lagi
            </Button>
          </div>
        )}

        <Surface className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <SlidersHorizontal className="h-4 w-4 text-emerald-700" /> Cari dan filter
              </h2>
              <p className="mt-1 text-xs text-slate-500">Persempit ledger berdasarkan detail yang kamu ingat.</p>
            </div>
            {filtersActive && (
              <Button variant="ghost" size="compact" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.5fr)_repeat(3,minmax(150px,0.75fr))]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Cari transaksi"
                type="search"
                placeholder="Cari merchant, catatan, atau kategori"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                className={cn(fieldControlStyles, "pl-11")}
              />
            </div>
            <select
              aria-label="Filter tipe transaksi"
              value={filters.type}
              onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as TransactionFilters["type"] }))}
              className={fieldControlStyles}
            >
              <option value="all">Semua tipe</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
            <select
              aria-label="Filter kategori"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              className={fieldControlStyles}
            >
              <option value="all">Semua kategori</option>
              {filterCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select
              aria-label="Filter status transaksi"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TransactionFilters["status"] }))}
              className={fieldControlStyles}
            >
              <option value="active">Transaksi aktif</option>
              <option value="confirmed">Terkonfirmasi</option>
              <option value="pending_approval">Perlu persetujuan</option>
              <option value="needs_review">Perlu ditinjau</option>
              <option value="deleted">Sampah</option>
              <option value="all">Semua riwayat</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setDateFiltersOpen((value) => !value)}
            aria-expanded={dateFiltersOpen}
            className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-600 sm:hidden"
          >
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-700" /> Rentang tanggal</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", dateFiltersOpen && "rotate-180")} />
          </button>
          <div className={cn("mt-3 gap-3 sm:grid sm:grid-cols-2", dateFiltersOpen ? "grid" : "hidden")}>
            <Field label="Mulai tanggal" htmlFor="filter-start-date">
              <input
                id="filter-start-date"
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                className={fieldControlStyles}
              />
            </Field>
            <Field label="Sampai tanggal" htmlFor="filter-end-date">
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
              title={filtersActive ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}
              description={filtersActive ? "Coba ubah kata kunci atau reset filter untuk melihat transaksi lain." : "Catat pemasukan atau pengeluaran pertama agar arus kas mulai terbaca."}
              action={filtersActive
                ? <Button variant="secondary" onClick={resetFilters}><RotateCcw className="h-4 w-4" /> Reset filter</Button>
                : <Button onClick={openAdd}><Plus className="h-4 w-4" /> Catat transaksi</Button>}
            />
          </Surface>
        ) : (
          <TransactionResults
            transactions={filteredTx}
            accountNames={accountNames}
            onEdit={openEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
          />
        )}
      </main>

      {modalOpen && (
        <TransactionDialog
          form={form}
          setForm={setForm}
          accounts={financialAccounts}
          categories={categories}
          categoryOptions={transactionCategoryOptions}
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

function TransactionResults({ transactions, accountNames, onEdit, onDelete, onRestore }: {
  transactions: Transaction[];
  accountNames: ReadonlyMap<string, string>;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => Promise<void>;
  onRestore: (transactionId: string) => Promise<void>;
}) {
  return (
    <>
      <Surface className="hidden overflow-hidden md:block">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Ledger transaksi</h2>
            <p className="mt-1 text-xs text-slate-500">Urutan terbaru berdasarkan tanggal transaksi.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{transactions.length} item</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              <tr>
                <th className="px-5 py-3">Transaksi</th>
                <th className="px-5 py-3">Akun & kategori</th>
                <th className="px-5 py-3 text-right">Jumlah</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="group hover:bg-emerald-50/35">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800">{transaction.merchant || transaction.category}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" /> {format(parseISO(transaction.date), "dd MMM yyyy", { locale: idLocale })}
                      {transaction.note && <span className="max-w-[220px] truncate">· {transaction.note}</span>}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <WalletCards className="h-4 w-4 text-emerald-700" /> {transaction.account_id ? accountNames.get(transaction.account_id) ?? "Akun tidak tersedia" : "Tanpa akun"}
                    </p>
                    <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{transaction.category}</span>
                  </td>
                  <td className={cn("px-5 py-4 text-right text-sm font-bold", transaction.type === "income" ? "text-emerald-700" : "text-slate-800")}>
                    {transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={transaction.status} />
                    <p className="mt-1.5 text-[11px] font-medium text-slate-400">{getTransactionSourceLabel(transaction.source)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <TransactionActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} onRestore={onRestore} />
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
                <p className="truncate font-bold text-slate-900">{transaction.merchant || transaction.category}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" /> {format(parseISO(transaction.date), "dd MMM yyyy", { locale: idLocale })}
                </p>
              </div>
              <p className={cn("shrink-0 text-sm font-bold", transaction.type === "income" ? "text-emerald-700" : "text-slate-900")}>
                {transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-slate-100 pt-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-600">
                  {transaction.account_id ? accountNames.get(transaction.account_id) ?? "Akun tidak tersedia" : "Tanpa akun"} · {transaction.category}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={transaction.status} />
                  <span className="text-[11px] text-slate-400">{getTransactionSourceLabel(transaction.source)}</span>
                </div>
              </div>
              <TransactionActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} onRestore={onRestore} />
            </div>
            {transaction.note && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">{transaction.note}</p>}
          </Surface>
        ))}
      </div>
    </>
  );
}

function TransactionActions({ transaction, onEdit, onDelete, onRestore }: {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => Promise<void>;
  onRestore: (transactionId: string) => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {transaction.receipt_url && (
        <a
          href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/private/${transaction.receipt_url}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Lihat struk ${transaction.merchant || transaction.category}`}
          className={buttonStyles({ variant: "ghost", size: "icon", className: "h-9 min-h-9 w-9 rounded-lg" })}
        >
          <Eye className="h-4 w-4" />
        </a>
      )}
      {transaction.status === "deleted" ? (
        <Button variant="secondary" size="compact" onClick={() => void onRestore(transaction.id)}>
          <RotateCcw className="h-3.5 w-3.5" /> Pulihkan
        </Button>
      ) : (
        <>
          <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg" onClick={() => onEdit(transaction)} aria-label={`Edit ${transaction.merchant || transaction.category}`}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void onDelete(transaction.id)} aria-label={`Hapus ${transaction.merchant || transaction.category}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const tones = {
    confirmed: "bg-emerald-50 text-emerald-700",
    pending_approval: "bg-amber-50 text-amber-700",
    needs_review: "bg-rose-50 text-rose-700",
    deleted: "bg-slate-100 text-slate-500",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold", tones[status])}>{getTransactionStatusLabel(status)}</span>;
}

function TransactionDialog({ form, setForm, accounts, categories, categoryOptions, isEditMode, saving, error, merchantInputRef, onClose, onSubmit }: {
  form: TransactionFormState;
  setForm: Dispatch<SetStateAction<TransactionFormState>>;
  accounts: FinancialAccount[];
  categories: CategoryRecord[];
  categoryOptions: string[];
  isEditMode: boolean;
  saving: boolean;
  error: string | null;
  merchantInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const changeType = (type: CategoryType) => {
    const options = buildTransactionCategoryOptions(categories, type);
    setForm((current) => ({ ...current, type, category: options.includes(current.category) ? current.category : options[0] ?? "" }));
  };
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-dialog-title"
        className="max-h-[calc(100svh-0.75rem)] w-full overflow-y-auto rounded-t-[28px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:max-w-xl sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{isEditMode ? "Perbarui ledger" : "Transaksi baru"}</p>
            <h2 id="transaction-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {isEditMode ? "Edit transaksi" : "Catat transaksi"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Isi detail utama. Biasanya selesai kurang dari satu menit.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Tutup form transaksi">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label="Tipe transaksi">
            <button
              type="button"
              aria-pressed={form.type === "expense"}
              onClick={() => changeType("expense")}
              className={cn("min-h-11 rounded-lg text-sm font-bold transition", form.type === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500")}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              aria-pressed={form.type === "income"}
              onClick={() => changeType("income")}
              className={cn("min-h-11 rounded-lg text-sm font-bold transition", form.type === "income" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500")}
            >
              Pemasukan
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Merchant atau sumber" htmlFor="transaction-merchant" hint="Contoh: Superindo atau Gaji bulanan.">
              <input
                ref={merchantInputRef}
                id="transaction-merchant"
                value={form.merchant}
                onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))}
                placeholder="Nama transaksi"
                className={fieldControlStyles}
              />
            </Field>
            <Field label="Tanggal" htmlFor="transaction-date">
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

          <Field label="Akun" htmlFor="transaction-account" hint={accounts.length === 0 ? "Tambahkan akun dahulu melalui halaman Akun & saldo." : "Saldo akun akan mengikuti transaksi ini."}>
            <select
              id="transaction-account"
              required
              value={form.accountId}
              onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
              className={fieldControlStyles}
            >
              <option value="">Pilih akun</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
          </Field>

          <Field label="Nominal" htmlFor="transaction-amount" hint="Masukkan angka tanpa tanda titik atau koma.">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
              <input
                id="transaction-amount"
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

          <Field label="Kategori" htmlFor="transaction-category">
            <select
              id="transaction-category"
              required
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className={fieldControlStyles}
            >
              {categoryOptions.length === 0 && <option value="">Belum ada kategori untuk tipe ini</option>}
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            {categoryOptions.length === 0 && <p className="mt-2 text-xs leading-5 text-amber-700">Buat kategori {form.type === "expense" ? "pengeluaran" : "pemasukan"} di <Link href="/categories" className="font-bold underline underline-offset-2">halaman Kategori</Link>.</p>}
          </Field>

          <Field label="Catatan" htmlFor="transaction-note" hint="Opsional—tambahkan konteks yang berguna saat ditinjau nanti.">
            <textarea
              id="transaction-note"
              rows={3}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Catatan singkat"
              className={cn(fieldControlStyles, "resize-none")}
            />
          </Field>

          <div aria-live="polite" aria-atomic="true">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p>}
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
          <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">Batal</Button>
          <Button type="submit" disabled={saving || accounts.length === 0 || categoryOptions.length === 0} className="flex-[1.4] sm:flex-none">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><FileSpreadsheet className="h-4 w-4" /> {isEditMode ? "Simpan perubahan" : "Simpan transaksi"}</>}
          </Button>
        </div>
      </form>
    </div>
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
