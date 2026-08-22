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
  CalendarDays,
  Camera,
  ChevronDown,
  Download,
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
  Printer,
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
import { getIdrRates, type FxRateResult } from "@/lib/fx";
import {
  buildCategoryFilterOptions,
  buildTransactionCategoryOptions,
  type CategoryRecord,
  type CategoryType,
} from "@/lib/categories";
import { filterTransactions, type TransactionFilters } from "@/lib/finance";
import { getPrivateReceiptObjectPath, validateSharedReceiptFile } from "@/lib/shared-receipt";
import type { ReceiptExtraction } from "@/lib/receipt-vision";
import { supabase } from "@/infrastructure/supabase/browser-client";
import {
  applyReceiptExtractionToTransactionForm,
  canApproveTransaction,
  getTransactionSaveStatus,
  getTransactionSourceLabel,
  getTransactionStatusLabel,
  hasActiveTransactionFilters,
  validateTransactionForm,
} from "@/lib/transactions";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { formatLocalDate } from "@/lib/planning";
import {
  createQueuedTransactionOperation,
  listQueuedTransactionOperations,
  projectQueuedTransactionOperations,
  queueTransactionOperation,
  removeQueuedTransactionOperation,
  replayQueuedTransactionOperations,
  updateQueuedTransactionOperation,
  type QueuedTransactionOperation,
} from "@/lib/offline-transaction-queue";
import { buildFinancialReport, serializeFinancialReportCsv, serializeRichTransactionCsv, type FinancialReport } from "@/lib/reporting";
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
  updated_at: string;
  account_id: string | null;
  syncPending?: boolean;
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
    amount: "0",
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
  const [reportRates, setReportRates] = useState<Map<string, FxRateResult>>(new Map());
  const [queueUserId, setQueueUserId] = useState<string | null>(null);
  const [queuedOperations, setQueuedOperations] = useState<QueuedTransactionOperation[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const syncingQueueRef = useRef(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [conflictTarget, setConflictTarget] = useState<QueuedTransactionOperation | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);
  const [dateFiltersOpen, setDateFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [scanDerived, setScanDerived] = useState(false);
  const [form, setForm] = useState<TransactionFormState>(createDefaultForm);
  const merchantInputRef = useRef<HTMLInputElement>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setQueueUserId(null);
        setQueuedOperations([]);
        return;
      }

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
          .order("created_at", { ascending: true }),
        supabase
          .from("categories")
          .select("id, user_id, name, type, icon, color, created_at")
          .order("name", { ascending: true }),
      ]);

      if (transactionResult.error) throw transactionResult.error;
      if (accountResult.error) throw accountResult.error;
      if (categoryResult.error) throw categoryResult.error;
      setQueueUserId(user.id);
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

  const loadQueuedOperations = useCallback(async (userId: string) => {
    try {
      setQueuedOperations(await listQueuedTransactionOperations(userId));
    } catch (error) {
      reportHandledError("Offline queue unavailable", error, "Antrean offline belum dapat dibuka.");
      setQueueMessage("Antrean offline perangkat belum dapat dibuka.");
    }
  }, []);

  const syncQueuedOperations = useCallback(async () => {
    if (syncingQueueRef.current || !canWriteOnline()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    syncingQueueRef.current = true;
    setSyncingQueue(true);
    try {
      const results = await replayQueuedTransactionOperations(user.id, {
        create: async (operation) => {
          const { data: existing, error: existingError } = await supabase.from("transactions").select("id").eq("id", operation.transactionId).eq("user_id", user.id).maybeSingle();
          if (existingError) throw existingError;
          if (existing) return "done";
          const { error } = await supabase.from("transactions").insert({ id: operation.transactionId, user_id: user.id, ...operation.payload, source: "manual" });
          if (error) throw error;
          return "done";
        },
        edit: async (operation) => {
          const query = supabase.from("transactions").update({ ...operation.payload, source: "manual" }).eq("id", operation.transactionId).eq("user_id", user.id);
          const { data, error } = operation.baseUpdatedAt
            ? await query.eq("updated_at", operation.baseUpdatedAt).select("id")
            : await query.select("id");
          if (error) throw error;
          return data?.length ? "done" : "conflict";
        },
        softDelete: async (operation) => {
          const query = supabase.from("transactions").update({ status: "deleted" }).eq("id", operation.transactionId).eq("user_id", user.id);
          const { data, error } = operation.baseUpdatedAt
            ? await query.eq("updated_at", operation.baseUpdatedAt).select("id")
            : await query.select("id");
          if (error) throw error;
          return data?.length ? "done" : "conflict";
        },
      });
      await loadQueuedOperations(user.id);
      if (results.some((result) => result.state === "done")) await fetchTransactions();
      if (results.some((result) => result.state === "conflict")) setQueueMessage("Sebagian perubahan offline perlu ditinjau sebelum disinkronkan.");
    } catch (error) {
      reportHandledError("Offline queue sync failed", error, "Sinkronisasi offline belum berhasil.");
      setQueueMessage("Sinkronisasi offline belum berhasil. Perubahan tetap tersimpan di perangkat.");
    } finally {
      syncingQueueRef.current = false;
      setSyncingQueue(false);
    }
  }, [fetchTransactions, loadQueuedOperations]);

  useEffect(() => {
    if (!queueUserId) return;
    const timer = window.setTimeout(() => {
      void loadQueuedOperations(queueUserId);
      if (canWriteOnline()) void syncQueuedOperations();
    }, 0);
    const handleOnline = () => void syncQueuedOperations();
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [loadQueuedOperations, queueUserId, syncQueuedOperations]);

  const displayedTransactions = useMemo(
    () => projectQueuedTransactionOperations(transactions, queuedOperations) as Transaction[],
    [queuedOperations, transactions],
  );
  const filteredTx = useMemo(
    () => filterTransactions(displayedTransactions, filters),
    [displayedTransactions, filters],
  );
  const filteredServerTx = useMemo(
    () => filterTransactions(transactions, filters),
    [filters, transactions],
  );
  const queuedOperationByTransactionId = useMemo(
    () => new Map(queuedOperations.map((operation) => [operation.transactionId, operation])),
    [queuedOperations],
  );
  const accountNames = useMemo(
    () => new Map(financialAccounts.map((account) => [account.id, account.name])),
    [financialAccounts],
  );
  const accountCurrencies = useMemo(
    () => new Map(financialAccounts.map((account) => [account.id, account.currency])),
    [financialAccounts],
  );
  const report = useMemo<FinancialReport>(
    () => buildFinancialReport(filteredServerTx, accountNames, accountCurrencies, reportRates),
    [accountCurrencies, accountNames, filteredServerTx, reportRates],
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
  const filterSummary = useMemo(() => [
    filters.type !== "all" ? filters.type : null,
    filters.category !== "all" ? filters.category : null,
    filters.status !== "active" ? filters.status : null,
    filters.startDate ? `≥ ${filters.startDate}` : null,
    filters.endDate ? `≤ ${filters.endDate}` : null,
    filters.search.trim() || null,
  ].filter(Boolean).join(" · ") || "Semua transaksi", [filters]);

  const downloadCsv = (contents: string, filename: string) => {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const refreshReportRates = async () => {
    const currencies = filteredServerTx.flatMap((transaction) => {
      const currency = transaction.account_id ? accountCurrencies.get(transaction.account_id) : null;
      return currency ? [currency] : [];
    });
    const rates = await getIdrRates(currencies);
    setReportRates(rates);
    return rates;
  };

  const exportLedger = () => {
    downloadCsv(serializeRichTransactionCsv(report), `fintrack-ledger-${formatLocalDate(new Date())}.csv`);
  };

  const exportReport = async () => {
    const rates = await refreshReportRates().catch(() => reportRates);
    const currentReport = buildFinancialReport(filteredServerTx, accountNames, accountCurrencies, rates);
    downloadCsv(
      serializeFinancialReportCsv(currentReport, { generatedAt: new Date().toISOString(), filterSummary }),
      `fintrack-report-${formatLocalDate(new Date())}.csv`,
    );
  };

  const printReport = async () => {
    await refreshReportRates().catch(() => undefined);
    window.setTimeout(() => window.print(), 0);
  };

  const openAdd = useCallback(() => {
    setSelectedTx(null);
    const nextForm = createDefaultForm();
    nextForm.category = buildTransactionCategoryOptions(categories, "expense")[0] ?? "";
    setForm(nextForm);
    setScanDerived(false);
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
    setScanDerived(false);
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

    const offline = !canWriteOnline();
    if (offline && selectedTx?.source && selectedTx.source !== "manual") {
      setFormError(offlineWriteMessage);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing authenticated user");

      const offlinePayload = {
        date: form.date,
        type: form.type,
        merchant: form.merchant.trim() || null,
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim() || null,
        source: "manual" as const,
        account_id: form.accountId,
      };
      const onlinePayload = {
        ...offlinePayload,
        source: selectedTx?.source ?? "manual",
        status: getTransactionSaveStatus(selectedTx?.status, scanDerived),
      };

      if (offline) {
        const transactionId = selectedTx?.id ?? crypto.randomUUID();
        await queueTransactionOperation(createQueuedTransactionOperation({
          userId: user.id,
          kind: selectedTx ? "edit" : "create",
          transactionId,
          payload: selectedTx ? offlinePayload : { ...offlinePayload, id: transactionId, ...(scanDerived ? { status: "needs_review" as const } : {}) },
          baseUpdatedAt: selectedTx?.updated_at ?? null,
        }));
        await loadQueuedOperations(user.id);
        setModalOpen(false);
        setQueueMessage("Perubahan manual disimpan di perangkat dan menunggu sinkronisasi.");
        return;
      }

      const result = isEditMode
        ? await supabase.from("transactions").update(onlinePayload).eq("id", selectedTx.id)
        : await supabase.from("transactions").insert([{ user_id: user.id, ...onlinePayload }]);
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
    const offline = !canWriteOnline();
    if (offline && deleteTarget.source !== "manual") {
      setDeleteError(offlineWriteMessage);
      return;
    }

    const transactionId = deleteTarget.id;
    setDeletingId(transactionId);
    setDeleteError(null);
    try {
      if (offline) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Missing authenticated user");
        await queueTransactionOperation(createQueuedTransactionOperation({
          userId: user.id,
          kind: "soft-delete",
          transactionId,
          payload: { status: "deleted", source: "manual" },
          baseUpdatedAt: deleteTarget.updated_at,
        }));
        await loadQueuedOperations(user.id);
        setQueueMessage("Penghapusan manual disimpan di perangkat dan menunggu sinkronisasi.");
      } else {
        const { error } = await supabase.from("transactions").update({ status: "deleted" }).eq("id", transactionId);
        if (error) throw error;
        await fetchTransactions();
      }
      setDeleteTarget(null);
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

  const discardQueuedOperation = async () => {
    if (!conflictTarget || resolvingConflict || !queueUserId) return;
    setResolvingConflict(true);
    setConflictError(null);
    try {
      await removeQueuedTransactionOperation(conflictTarget.opId);
      await loadQueuedOperations(queueUserId);
      await fetchTransactions();
      setConflictTarget(null);
      setQueueMessage("Perubahan offline dibuang. Data server dipertahankan.");
    } catch (error) {
      reportHandledError("Offline queue conflict discard failed", error, "Perubahan offline belum dapat dibuang.");
      setConflictError("Perubahan offline belum dapat dibuang. Coba lagi.");
    } finally {
      setResolvingConflict(false);
    }
  };

  const retryQueuedOperation = async (operation: QueuedTransactionOperation) => {
    if (resolvingConflict || !queueUserId || !canWriteOnline()) return;
    setResolvingConflict(true);
    setConflictError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== queueUserId) throw new Error("Missing authenticated user");
      const { data: serverRow, error } = await supabase
        .from("transactions")
        .select("id, updated_at")
        .eq("id", operation.transactionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!serverRow && operation.kind !== "create") {
        setQueueMessage("Data server sudah tidak tersedia. Buang perubahan offline atau buat transaksi baru.");
        return;
      }
      await updateQueuedTransactionOperation({
        ...operation,
        baseUpdatedAt: serverRow?.updated_at ?? null,
        attempts: 0,
        state: "pending",
        lastError: null,
      });
      await loadQueuedOperations(user.id);
      setQueueMessage("Perubahan offline siap dicoba ulang dengan versi server terbaru.");
      await syncQueuedOperations();
    } catch (error) {
      reportHandledError("Offline queue conflict retry failed", error, "Perubahan offline belum dapat disiapkan ulang.");
      setQueueMessage("Perubahan offline belum dapat disiapkan ulang. Coba lagi.");
    } finally {
      setResolvingConflict(false);
    }
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setDateFiltersOpen(false);
  };

  const pendingQueuedOperations = queuedOperations.filter((operation) => operation.state === "pending");
  const conflictQueuedOperations = queuedOperations.filter((operation) => operation.state === "conflict");

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content space-y-5 outline-none sm:space-y-6">
        <PageHeader
          eyebrow={t("Ledger keuangan")}
          title={t("Transaksi")}
          description={t("{shown} dari {total} transaksi ditampilkan. Cari, tinjau, dan catat arus uang tanpa kehilangan konteks.", { shown: filteredTx.length, total: transactions.length })}
          titleAction={(
            <Button
              variant="secondary"
              size="compact"
              onClick={() => void syncQueuedOperations()}
              loading={syncingQueue}
              disabled={pendingQueuedOperations.length === 0}
              data-print-hide
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t("Sinkronkan")}
            </Button>
          )}
          actions={(
            <>
              <details className="group relative sm:hidden" data-print-hide>
                <summary className={cn(buttonStyles({ variant: "secondary" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
                  {t("Lainnya")} <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 grid w-56 gap-1 rounded-xl border border-emerald-100 bg-white p-1.5 shadow-[var(--shadow-elevated)]">
                  <Button variant="ghost" size="compact" onClick={exportLedger}>
                    <Download className="h-4 w-4" /> {t("Ekspor transaksi CSV")}
                  </Button>
                  <Button variant="ghost" size="compact" onClick={() => void exportReport()}>
                    <FileSpreadsheet className="h-4 w-4" /> {t("Ekspor laporan CSV")}
                  </Button>
                  <Button variant="ghost" size="compact" onClick={() => void printReport()}>
                    <Printer className="h-4 w-4" /> {t("Cetak laporan")}
                  </Button>
                </div>
              </details>
              <div className="hidden items-center gap-2 sm:flex">
                <Button variant="secondary" onClick={exportLedger}>
                  <Download className="h-4 w-4" /> {t("Ekspor transaksi CSV")}
                </Button>
                <Button variant="secondary" onClick={() => void exportReport()}>
                  <FileSpreadsheet className="h-4 w-4" /> {t("Ekspor laporan CSV")}
                </Button>
                <Button variant="secondary" onClick={() => void printReport()}>
                  <Printer className="h-4 w-4" /> {t("Cetak laporan")}
                </Button>
              </div>
              <Link href="/categories" className={cn(buttonStyles({ variant: "secondary" }), "sm:hidden")} aria-label={t("Kategori")} data-print-hide>
                <Tags className="h-4 w-4" />
              </Link>
              <Link href="/categories" className={cn(buttonStyles({ variant: "secondary" }), "hidden sm:inline-flex")} data-print-hide>
                <Tags className="h-4 w-4" /> {t("Kategori")}
              </Link>
              <Button onClick={openAdd} data-print-hide>
                <Plus className="h-4 w-4" /> {t("Catat")}
              </Button>
            </>
          )}
        />

        <CurrencySummary report={report} />

        {pageError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{pageError}</span>
            <Button variant="ghost" size="compact" onClick={() => void fetchTransactions()}>
              <RotateCcw className="h-4 w-4" /> {t("Coba lagi")}
            </Button>
          </div>
        )}

        {(queueMessage || pendingQueuedOperations.length > 0 || conflictQueuedOperations.length > 0) && (
          <div aria-live="polite" className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {queueMessage && <p>{queueMessage}</p>}
            {pendingQueuedOperations.length > 0 && <p className={queueMessage ? "mt-1" : ""}>{t("{count} perubahan manual menunggu sinkronisasi.", { count: pendingQueuedOperations.length })}</p>}
            {conflictQueuedOperations.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p>{t("{count} perubahan offline perlu ditinjau.", { count: conflictQueuedOperations.length })}</p>
                {conflictQueuedOperations.map((operation) => (
                  <div key={operation.opId} className="flex items-center gap-2">
                    <Button variant="secondary" size="compact" onClick={() => void retryQueuedOperation(operation)} disabled={resolvingConflict}>
                      {t("Coba ulang dengan data server terbaru")}
                    </Button>
                    <Button variant="ghost" size="compact" onClick={() => { setConflictTarget(operation); setConflictError(null); }}>
                      {t("Buang perubahan offline")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
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

        <PrintReport report={report} filterSummary={filterSummary} />

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
            accountCurrencies={accountCurrencies}
            dateLocale={dateLocale}
            onEdit={openEdit}
            onDelete={requestDelete}
            onRestore={handleRestore}
            onApprove={requestApproval}
            deletingId={deletingId}
            restoringId={restoringId}
            approvingId={approvingId}
            queuedOperations={queuedOperationByTransactionId}
            onRetryQueue={retryQueuedOperation}
            onDiscardQueue={(operation) => { setConflictTarget(operation); setConflictError(null); }}
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

      {conflictTarget && (
        <ConfirmDialog
          titleId="discard-offline-operation-title"
          descriptionId="discard-offline-operation-description"
          title={t("Buang perubahan offline?")}
          description={t("Perubahan lokal akan dihapus. Data server tetap dipertahankan.")}
          confirmLabel={t("Buang perubahan offline")}
          onClose={() => {
            if (!resolvingConflict) {
              setConflictTarget(null);
              setConflictError(null);
            }
          }}
          onConfirm={() => void discardQueuedOperation()}
          loading={resolvingConflict}
          error={conflictError}
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
          onScan={() => setScanDerived(true)}
          onClose={closeModal}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}

function CurrencySummary({ report }: { report: FinancialReport }) {
  const { t } = useLanguage();
  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-emerald-100 px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">{t("Ringkasan arus kas")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("Nilai hanya dijumlahkan dalam mata uang yang sama.")}</p>
      </div>
      {report.currencyGroups.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {report.currencyGroups.map((group) => (
            <div key={group.currency} className="border-b border-emerald-100 px-5 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{group.currency}</p>
              <p className={cn("mt-2 text-xl font-bold tracking-[-0.03em]", group.net >= 0 ? "text-emerald-700" : "text-rose-600")}>{formatCurrency(group.net, group.currency)}</p>
              <p className="mt-1 text-xs text-slate-500">{t("Masuk")} {formatCurrency(group.income, group.currency)} · {t("Keluar")} {formatCurrency(group.expense, group.currency)}</p>
              {group.convertedNetIdr !== null && group.currency !== "IDR" && <p className="mt-2 text-[11px] text-sky-700">{t("Setara IDR terbaru")} {formatCurrency(group.convertedNetIdr, "IDR")} · Frankfurter · {group.rate.state}</p>}
              {group.rate.state === "missing" && group.currency !== "IDR" && <p className="mt-2 text-[11px] text-amber-700">{t("Kurs IDR belum tersedia. Nilai tidak digabung.")}</p>}
            </div>
          ))}
        </div>
      ) : <p className="px-5 py-4 text-sm text-slate-500">{t("Belum ada transaksi terkonfirmasi pada filter ini.")}</p>}
    </Surface>
  );
}

function PrintReport({ report, filterSummary }: { report: FinancialReport; filterSummary: string }) {
  const { t } = useLanguage();
  return (
    <section data-print-report className="hidden">
      <h1>{t("Laporan FinTrack")}</h1>
      <p>{t("Dibuat")} {new Date().toLocaleString("id-ID")}</p>
      <p>{t("Filter")}: {filterSummary}</p>
      <h2>{t("Ringkasan per mata uang")}</h2>
      <table><thead><tr><th scope="col">{t("Mata uang")}</th><th scope="col">{t("Pemasukan")}</th><th scope="col">{t("Pengeluaran")}</th><th scope="col">{t("Bersih")}</th><th scope="col">{t("Kurs")}</th></tr></thead><tbody>
        {report.currencyGroups.map((group) => <tr key={group.currency}><td>{group.currency}</td><td>{formatCurrency(group.income, group.currency)}</td><td>{formatCurrency(group.expense, group.currency)}</td><td>{formatCurrency(group.net, group.currency)}</td><td>{group.rate.rate === null ? t("Tidak tersedia") : `Frankfurter · ${group.rate.providerDate ?? "—"} · ${group.rate.state}`}</td></tr>)}
      </tbody></table>
      <h2>{t("Kategori pengeluaran terkonfirmasi")}</h2>
      <table><thead><tr><th scope="col">{t("Mata uang")}</th><th scope="col">{t("Kategori")}</th><th scope="col">{t("Jumlah")}</th></tr></thead><tbody>
        {report.categoryTotals.map((item) => <tr key={`${item.currency}-${item.category}`}><td>{item.currency}</td><td>{t(item.category)}</td><td>{formatCurrency(item.amount, item.currency)}</td></tr>)}
      </tbody></table>
      <h2>{t("Ledger transaksi")}</h2>
      <table><caption>{t("Transaksi sesuai filter aktif")}</caption><thead><tr><th scope="col">{t("Tanggal")}</th><th scope="col">{t("Tipe transaksi")}</th><th scope="col">{t("Merchant atau sumber")}</th><th scope="col">{t("Kategori")}</th><th scope="col">{t("Jumlah")}</th><th scope="col">{t("Mata uang")}</th><th scope="col">{t("Akun")}</th><th scope="col">{t("Status")}</th></tr></thead><tbody>
        {report.rows.map((row, index) => <tr key={`${row.date}-${row.account}-${index}`}><td>{row.date}</td><td>{t(row.type === "income" ? "Pemasukan" : "Pengeluaran")}</td><td>{row.merchant ?? ""}</td><td>{t(row.category)}</td><td>{formatCurrency(row.amount, row.currency)}</td><td>{row.currency}</td><td>{row.account}</td><td>{t(getTransactionStatusLabel(row.status))}</td></tr>)}
      </tbody></table>
    </section>
  );
}

function TransactionResults({ transactions, accountNames, accountCurrencies, dateLocale, onEdit, onDelete, onRestore, onApprove, deletingId, restoringId, approvingId, queuedOperations, onRetryQueue, onDiscardQueue }: {
  transactions: Transaction[];
  accountNames: ReadonlyMap<string, string>;
  accountCurrencies: ReadonlyMap<string, string>;
  dateLocale: typeof idLocale;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onRestore: (transactionId: string) => Promise<void>;
  onApprove: (transaction: Transaction) => void;
  deletingId: string | null;
  restoringId: string | null;
  approvingId: string | null;
  queuedOperations: ReadonlyMap<string, QueuedTransactionOperation>;
  onRetryQueue: (operation: QueuedTransactionOperation) => Promise<void>;
  onDiscardQueue: (operation: QueuedTransactionOperation) => void;
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
                    {transaction.type === "income" ? "+" : "−"}{formatCurrency(transaction.amount, transaction.account_id ? accountCurrencies.get(transaction.account_id) ?? "IDR" : "IDR")}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={transaction.status} />
                    <QueueOperationStatus operation={queuedOperations.get(transaction.id)} onRetry={onRetryQueue} onDiscard={onDiscardQueue} />
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
                {transaction.type === "income" ? "+" : "−"}{formatCurrency(transaction.amount, transaction.account_id ? accountCurrencies.get(transaction.account_id) ?? "IDR" : "IDR")}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-slate-100 pt-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-600">
                  {transaction.account_id ? accountNames.get(transaction.account_id) ?? t("Akun tidak tersedia") : t("Tanpa akun")} · {t(transaction.category)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={transaction.status} />
                  <QueueOperationStatus operation={queuedOperations.get(transaction.id)} onRetry={onRetryQueue} onDiscard={onDiscardQueue} compact />
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

function QueueOperationStatus({ operation, onRetry, onDiscard, compact = false }: {
  operation?: QueuedTransactionOperation;
  onRetry: (operation: QueuedTransactionOperation) => Promise<void>;
  onDiscard: (operation: QueuedTransactionOperation) => void;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  if (!operation) return null;
  if (operation.state === "conflict") {
    return (
      <span className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-rose-700">
        {t("Konflik sinkronisasi")}
        <Button variant="ghost" size="compact" className="min-h-7 px-1.5 text-[11px]" onClick={() => void onRetry(operation)}>{t("Coba ulang")}</Button>
        <Button variant="ghost" size="compact" className="min-h-7 px-1.5 text-[11px]" onClick={() => onDiscard(operation)}>{t("Buang")}</Button>
      </span>
    );
  }
  return (
    <span aria-live="polite" className="text-[11px] font-semibold text-sky-700">
      {t("Sinkronisasi tertunda")}{operation.attempts > 0 ? ` · ${t("Percobaan")} ${operation.attempts}` : ""}
      {!compact && operation.lastError ? ` · ${operation.lastError}` : ""}
    </span>
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
      {transaction.receipt_url && !transaction.syncPending && (
        <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg" onClick={() => void openReceipt()} loading={openingReceipt} aria-label={t("Lihat struk {name}", { name: transaction.merchant || transaction.category })}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {!transaction.syncPending && (transaction.status === "deleted" ? (
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
      ))}
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

function TransactionDialog({ form, setForm, accounts, categories, categoryOptions, transaction, isEditMode, saving, error, merchantInputRef, onScan, onClose, onSubmit }: {
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
  onScan: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { t } = useLanguage();
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<string[]>([]);
  const changeType = (type: CategoryType) => {
    const options = buildTransactionCategoryOptions(categories, type);
    setForm((current) => ({ ...current, type, category: options.includes(current.category) ? current.category : options[0] ?? "" }));
  };
  const scanReceipt = async (file: File) => {
    const validationError = validateSharedReceiptFile(file);
    if (validationError) {
      setReceiptNotice(validationError);
      return;
    }
    if (!canWriteOnline()) {
      setReceiptNotice(t(offlineWriteMessage));
      return;
    }
    setScanningReceipt(true);
    setReceiptNotice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/receipts/parse", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as { extraction?: ReceiptExtraction; error?: string };
      if (!response.ok || !result.extraction) throw new Error(result.error || "AI belum bisa menganalisis struk. Silakan isi form manual.");
      setForm((current) => applyReceiptExtractionToTransactionForm(
        current,
        result.extraction!,
        buildTransactionCategoryOptions(categories, result.extraction?.type ?? current.type),
      ));
      onScan();
      const summary = [
        result.extraction.type === "income" ? t("Pemasukan") : result.extraction.type === "expense" ? t("Pengeluaran") : null,
        result.extraction.merchant,
        result.extraction.amount === null ? null : String(result.extraction.amount),
      ].filter(Boolean).join(" · ");
      if (summary) setScanHistory((current) => [summary, ...current].slice(0, 3));
      setReceiptNotice(t("Data struk berhasil diekstrak otomatis. Periksa kembali sebelum menyimpan."));
    } catch (error) {
      setReceiptNotice(error instanceof Error ? error.message : t("AI belum bisa menganalisis struk. Silakan isi form manual."));
    } finally {
      if (receiptInputRef.current) receiptInputRef.current.value = "";
      setScanningReceipt(false);
    }
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
          {!isEditMode && (
            <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-3">
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void scanReceipt(file);
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void scanReceipt(file);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="compact" onClick={() => cameraInputRef.current?.click()} loading={scanningReceipt} disabled={scanningReceipt}>
                  <Camera className="h-4 w-4" /> {t("Ambil foto")}
                </Button>
                <Button type="button" variant="secondary" size="compact" onClick={() => receiptInputRef.current?.click()} disabled={scanningReceipt}>
                  <ReceiptText className="h-4 w-4" /> {t("Pilih gambar")}
                </Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{t("Pilih gambar untuk mengisi form otomatis. Gambar tidak disimpan.")}</p>
              {receiptNotice && <p role="status" className="mt-2 text-xs leading-5 text-emerald-800">{receiptNotice}</p>}
              {scanHistory.length > 0 && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-600">
                  <p className="font-bold text-emerald-800">{t("Hasil scan sesi ini")}</p>
                  <ul className="mt-1 space-y-1">{scanHistory.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                  <p className="mt-2 text-amber-800">{t("Transaksi hasil scan akan perlu ditinjau sebelum mengubah saldo.")}</p>
                </div>
              )}
            </div>
          )}
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
                onFocus={(event) => { if (!isEditMode && event.target.value === "0") event.target.select(); }}
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

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("id-ID")}`;
  }
}
