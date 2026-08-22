"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { format, parseISO } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  Landmark,
  Plus,
  RefreshCw,
  RotateCw,
  Smartphone,
  WalletCards,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { DialogFrame as AccessibleDialogFrame } from "@/components/ui/DialogFrame";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import { getIdrRates, type FxRateResult } from "@/lib/fx";
import {
  filterAccounts,
  getAccountKindLabel,
  getMissingForeignAccounts,
  summarizeAccounts,
  validateAccountForm,
  validateTransferForm,
  type AccountFilter,
  type AccountOverviewRecord,
} from "@/lib/accounts";
import type { FinancialAccountKind } from "@/lib/ledger";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { formatLocalDate } from "@/lib/planning";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { cn } from "@/lib/utils";

const accountKinds: Array<{ value: FinancialAccountKind; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "E-wallet" },
  { value: "investment", label: "Investasi" },
  { value: "trading", label: "Trading" },
  { value: "liability", label: "Kewajiban" },
];

const accountFilters: Array<{ value: AccountFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "liquid", label: "Dana likuid" },
  { value: "investment", label: "Investasi" },
  { value: "trading", label: "Trading" },
  { value: "liability", label: "Kewajiban" },
];

const kindIcon = {
  bank: Landmark,
  ewallet: Smartphone,
  investment: ChartNoAxesCombined,
  trading: ChartNoAxesCombined,
  liability: Building2,
};

const emptyAccountForm = {
  name: "",
  institution: "",
  kind: "bank" as FinancialAccountKind,
  currency: "IDR",
  currentBalance: "0",
  reportingBalanceIdr: "",
};

const createTransferForm = () => ({
  sourceAccountId: "",
  destinationAccountId: "",
  amount: "",
  destinationAmount: "",
  date: formatLocalDate(new Date()),
  kind: "transfer",
  note: "",
});

type AccountFormState = typeof emptyAccountForm;
type TransferFormState = ReturnType<typeof createTransferForm>;
type BalanceFormState = { currentBalance: string; reportingBalanceIdr: string };
type TransferRecord = {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  destination_amount: number;
  currency: string;
  destination_currency: string;
  date: string;
  note: string | null;
};
type ReconciliationRecord = {
  id: string;
  account_id: string;
  statement_balance: number;
  ledger_balance: number;
  reconciled_at: string;
  note: string | null;
};
type DialogKind = "account" | "transfer" | "balance" | null;
type AccountDialogMode = "create" | "edit";

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value);
}

export default function AccountsPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : idLocale;
  const [accounts, setAccounts] = useState<AccountOverviewRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [fxRefreshMessage, setFxRefreshMessage] = useState<string | null>(null);
  const [fxRates, setFxRates] = useState<Map<string, FxRateResult>>(new Map());
  const [activeDialog, setActiveDialog] = useState<DialogKind>(null);
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("all");
  const [balanceAccount, setBalanceAccount] = useState<AccountOverviewRecord | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountOverviewRecord | null>(null);
  const [accountToToggle, setAccountToToggle] = useState<AccountOverviewRecord | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<AccountOverviewRecord | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormState>(emptyAccountForm);
  const [transferForm, setTransferForm] = useState<TransferFormState>(createTransferForm);
  const [balanceForm, setBalanceForm] = useState<BalanceFormState>({ currentBalance: "", reportingBalanceIdr: "" });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLSelectElement>(null);
  const balanceInputRef = useRef<HTMLInputElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountsResult, transfersResult, reconciliationsResult] = await Promise.all([
        supabase
          .from("financial_accounts")
          .select("id, name, institution, kind, currency, current_balance, reporting_balance_idr, is_active, updated_at")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("account_transfers")
          .select("id, source_account_id, destination_account_id, amount, destination_amount, currency, destination_currency, date, note")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(5),
        supabase
          .from("account_reconciliations")
          .select("id, account_id, statement_balance, ledger_balance, reconciled_at, note")
          .eq("user_id", user.id)
          .order("reconciled_at", { ascending: false })
          .limit(5),
      ]);
      const error = accountsResult.error || transfersResult.error || reconciliationsResult.error;
      if (error) throw error;
      setAccounts((accountsResult.data ?? []) as AccountOverviewRecord[]);
      setTransfers((transfersResult.data ?? []) as TransferRecord[]);
      setReconciliations((reconciliationsResult.data ?? []) as ReconciliationRecord[]);
    } catch (error) {
      reportHandledError("Accounts unavailable", error, "Data akun belum berhasil dimuat.");
      setPageError(t("Data akun belum berhasil dimuat. Coba lagi beberapa saat lagi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccounts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  const closeDialog = useCallback(() => {
    if (saving) return;
    setActiveDialog(null);
    setEditingAccount(null);
    setFormError(null);
    setFormErrors({});
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }, [saving]);

  const summary = useMemo(() => summarizeAccounts(accounts), [accounts]);
  const missingForeignAccounts = useMemo(() => getMissingForeignAccounts(accounts), [accounts]);
  const filteredAccounts = useMemo(() => filterAccounts(accounts, activeFilter), [accounts, activeFilter]);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);
  const sourceAccount = activeAccounts.find((account) => account.id === transferForm.sourceAccountId);
  const destinationAccount = activeAccounts.find((account) => account.id === transferForm.destinationAccountId);
  const isCrossCurrencyTransfer = Boolean(sourceAccount && destinationAccount && sourceAccount.currency !== destinationAccount.currency);

  function rememberTrigger() {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function openAccountDialog() {
    rememberTrigger();
    setEditingAccount(null);
    setAccountForm(emptyAccountForm);
    setFormError(null);
    setFormErrors({});
    setActiveDialog("account");
  }

  function openEditAccountDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setEditingAccount(account);
    setAccountForm({
      name: account.name,
      institution: account.institution ?? "",
      kind: account.kind,
      currency: account.currency,
      currentBalance: String(account.current_balance),
      reportingBalanceIdr: account.reporting_balance_idr === null ? "" : String(account.reporting_balance_idr),
    });
    setFormError(null);
    setFormErrors({});
    setActiveDialog("account");
  }

  function openAccountToggleDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setFormError(null);
    setAccountToToggle(account);
  }

  function openAccountDeleteDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setFormError(null);
    setAccountToDelete(account);
  }

  async function deleteAccount() {
    if (!accountToDelete) return;
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    if (Number(accountToDelete.current_balance) !== 0) {
      setFormError(t("Saldo akun harus nol sebelum dihapus permanen."));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const accountId = accountToDelete.id;
      const linkedResults = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("account_transfers").select("id", { count: "exact", head: true }).eq("user_id", user.id).or(`source_account_id.eq.${accountId},destination_account_id.eq.${accountId}`),
        supabase.from("recurring_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("account_reconciliations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("stock_executions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("forex_trades").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("account_equity_snapshots").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
      ]);
      const linkedError = linkedResults.find((result) => result.error)?.error;
      if (linkedError) throw linkedError;
      if (linkedResults.some((result) => (result.count ?? 0) > 0)) {
        setFormError(t("Akun punya riwayat terhubung dan tidak dapat dihapus. Arsipkan akun sebagai gantinya."));
        return;
      }

      const { error } = await supabase
        .from("financial_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", user.id);
      if (error) throw error;
      setAccountToDelete(null);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Account delete failed", error, "Akun belum berhasil dihapus.");
      setFormError(t("Akun belum berhasil dihapus. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  function openTransferDialog() {
    rememberTrigger();
    setTransferForm(createTransferForm());
    setFormError(null);
    setFormErrors({});
    setActiveDialog("transfer");
  }

  function openBalanceDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setBalanceAccount(account);
    setBalanceForm({
      currentBalance: String(account.current_balance),
      reportingBalanceIdr: account.reporting_balance_idr === null ? "" : String(account.reporting_balance_idr),
    });
    setFormError(null);
    setFormErrors({});
    setActiveDialog("balance");
  }

  async function refreshForeignBalances() {
    const foreignAccounts = activeAccounts.filter((account) => account.currency !== "IDR");
    if (!foreignAccounts.length || refreshingFx) return;
    if (!canWriteOnline()) {
      setFxRefreshMessage(t(offlineWriteMessage));
      return;
    }

    setRefreshingFx(true);
    setFxRefreshMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const rates = await getIdrRates(foreignAccounts.map((account) => account.currency), { forceRefresh: true });
      setFxRates(rates);
      const updates = await Promise.all(foreignAccounts.map(async (account) => {
        const rate = rates.get(account.currency);
        if (!rate || rate.rate === null) return false;
        const { error } = await supabase
          .from("financial_accounts")
          .update({ reporting_balance_idr: Number(account.current_balance) * rate.rate })
          .eq("id", account.id)
          .eq("user_id", user.id);
        if (error) throw error;
        return true;
      }));
      const updatedCount = updates.filter(Boolean).length;
      const missingCount = foreignAccounts.length - updatedCount;
      setFxRefreshMessage(missingCount
        ? t("Kurs diperbarui untuk {count} akun. {missing} akun mempertahankan nilai manual karena kurs tidak tersedia.", { count: updatedCount, missing: missingCount })
        : t("Kurs IDR terbaru diperbarui untuk {count} akun.", { count: updatedCount }));
      await loadAccounts();
    } catch (error) {
      reportHandledError("FX refresh failed", error, "Kurs IDR belum berhasil diperbarui.");
      setFxRefreshMessage(t("Kurs IDR belum berhasil diperbarui. Nilai manual tetap dipakai."));
    } finally {
      setRefreshingFx(false);
    }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const validation = validateAccountForm(accountForm);
    if (!validation.valid) {
      setFormErrors(validation.errors as Record<string, string>);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const reportingBalanceIdr = accountForm.reportingBalanceIdr.trim() ? Number(accountForm.reportingBalanceIdr) : null;
      const identity = { name: accountForm.name.trim(), institution: accountForm.institution.trim() || null };
      const { error } = editingAccount
        ? await supabase.from("financial_accounts").update(identity).eq("id", editingAccount.id).eq("user_id", user.id)
        : await supabase.from("financial_accounts").insert({
          user_id: user.id,
          ...identity,
          kind: accountForm.kind,
          currency: accountForm.currency.toUpperCase(),
          current_balance: Number(accountForm.currentBalance),
          reporting_balance_idr: accountForm.currency === "IDR" ? null : reportingBalanceIdr,
        });
      if (error) throw error;
      setActiveDialog(null);
      setEditingAccount(null);
      setAccountForm(emptyAccountForm);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Account save failed", error, "Akun belum berhasil disimpan.");
      setFormError(t("Akun belum berhasil disimpan. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccountActive() {
    if (!accountToToggle) return;
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const { error } = await supabase
        .from("financial_accounts")
        .update({ is_active: !accountToToggle.is_active })
        .eq("id", accountToToggle.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setAccountToToggle(null);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Account lifecycle update failed", error, "Status akun belum berhasil diperbarui.");
      setFormError(t("Status akun belum berhasil diperbarui. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  async function saveTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const validation = validateTransferForm({
      sourceAccountId: transferForm.sourceAccountId,
      destinationAccountId: transferForm.destinationAccountId,
      sourceAmount: transferForm.amount,
      destinationAmount: transferForm.destinationAmount,
      sourceCurrency: sourceAccount?.currency ?? "",
      destinationCurrency: destinationAccount?.currency ?? "",
      date: transferForm.date,
    });
    if (!validation.valid || !sourceAccount || !destinationAccount) {
      setFormErrors(validation.errors as Record<string, string>);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const destinationAmount = isCrossCurrencyTransfer ? Number(transferForm.destinationAmount) : Number(transferForm.amount);
      const { error } = await supabase.from("account_transfers").insert({
        user_id: user.id,
        source_account_id: sourceAccount.id,
        destination_account_id: destinationAccount.id,
        amount: Number(transferForm.amount),
        destination_amount: destinationAmount,
        currency: sourceAccount.currency,
        destination_currency: destinationAccount.currency,
        date: transferForm.date,
        kind: transferForm.kind,
        note: transferForm.note.trim() || null,
      });
      if (error) throw error;
      setActiveDialog(null);
      setTransferForm(createTransferForm());
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Transfer save failed", error, "Transfer belum berhasil disimpan.");
      setFormError(t("Transfer belum berhasil disimpan. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    if (!balanceAccount) return;
    const reportingBalanceIdr = balanceForm.reportingBalanceIdr.trim() ? Number(balanceForm.reportingBalanceIdr) : null;
    if (balanceAccount.currency !== "IDR" && reportingBalanceIdr !== null && (!Number.isFinite(reportingBalanceIdr) || reportingBalanceIdr < 0)) {
      setFormErrors({ reportingBalanceIdr: "Nilai setara IDR harus nol atau lebih." });
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const { error } = await supabase
        .from("financial_accounts")
        .update({ reporting_balance_idr: balanceAccount.currency === "IDR" ? null : reportingBalanceIdr })
        .eq("id", balanceAccount.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setActiveDialog(null);
      setBalanceAccount(null);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Balance update failed", error, "Saldo belum berhasil diperbarui.");
      setFormError(t("Saldo belum berhasil diperbarui. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content space-y-5 outline-none sm:space-y-6">
        <PageHeader
          eyebrow={t("Pusat akun")}
          title={t("Akun & saldo")}
          description={t("Lihat kekayaan bersih, cek kesegaran saldo, dan pindahkan dana tanpa kehilangan konteks.")}
          actions={
            <>
              <Button variant="secondary" onClick={() => void refreshForeignBalances()} disabled={!activeAccounts.some((account) => account.currency !== "IDR")} loading={refreshingFx}>
                <RotateCw className="h-4 w-4" /> {t("Perbarui kurs IDR")}
              </Button>
              <div className="min-w-0">
                <Button variant="secondary" onClick={openTransferDialog} disabled={activeAccounts.length < 2} aria-describedby={activeAccounts.length < 2 ? "transfer-prerequisite" : undefined}>
                  <ArrowLeftRight className="h-4 w-4" /> {t("Transfer")}
                </Button>
                {activeAccounts.length < 2 && <p id="transfer-prerequisite" className="mt-1 max-w-48 text-xs leading-4 text-slate-500">{t("Tambahkan satu akun aktif lagi untuk transfer.")}</p>}
              </div>
              <Button onClick={openAccountDialog}>
                <Plus className="h-4 w-4" /> {t("Tambah akun")}
              </Button>
            </>
          }
        />

        {pageError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{pageError}</span>
            <Button variant="secondary" size="compact" onClick={() => void loadAccounts()}>
              <RefreshCw className="h-4 w-4" /> {t("Coba lagi")}
            </Button>
          </div>
        )}

        {fxRefreshMessage && (
          <div aria-live="polite" className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
            <p>{fxRefreshMessage}</p>
            {[...fxRates.values()].filter((rate) => rate.rate !== null && rate.base !== "IDR").map((rate) => (
              <p key={rate.base} className="mt-1 text-xs text-sky-700">{rate.base}/IDR · Frankfurter · {rate.providerDate ?? t("tanggal kurs tidak tersedia")} · {rate.state}</p>
            ))}
          </div>
        )}

        {loading ? (
          <AccountsSkeleton />
        ) : (
          <>
            <WealthOverview summary={summary} />

            {missingForeignAccounts.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">{t("{count} akun belum masuk total IDR", { count: missingForeignAccounts.length })}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">{t("Isi nilai setara IDR agar net worth tidak kurang dari kondisi sebenarnya.")}</p>
                  </div>
                </div>
                <Button variant="secondary" size="compact" onClick={() => openBalanceDialog(missingForeignAccounts[0])}>
                  {t("Lengkapi {name}", { name: missingForeignAccounts[0].name })}
                </Button>
              </div>
            )}

            <Surface className="overflow-hidden">
              <div className="border-b border-emerald-100 px-4 py-4 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">{t("Portofolio akun")}</h2>
                    <p className="mt-1 text-xs text-slate-500">{t("{count} akun terhubung · {active} aktif", { count: accounts.length, active: summary.activeCount })}</p>
                  </div>
                </div>
                <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("Filter jenis akun")}>
                  {accountFilters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      aria-pressed={activeFilter === filter.value}
                      onClick={() => setActiveFilter(filter.value)}
                      className={cn(
                        "min-h-10 shrink-0 rounded-xl border px-3.5 text-xs font-bold transition",
                        activeFilter === filter.value
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700",
                      )}
                    >
                      {t(filter.label)}
                    </button>
                  ))}
                </div>
              </div>

              {accounts.length === 0 ? (
                <EmptyState
                  icon={WalletCards}
                  title={t("Mulai dari akun pertamamu")}
                  description={t("Tambahkan rekening bank, e-wallet, akun investasi, atau broker untuk membangun gambaran kekayaan yang utuh.")}
                  action={<Button onClick={openAccountDialog}><Plus className="h-4 w-4" /> {t("Tambah akun")}</Button>}
                />
              ) : filteredAccounts.length === 0 ? (
                <EmptyState
                  icon={WalletCards}
                  title={t("Belum ada akun di kelompok ini")}
                  description={t("Pilih kelompok lain atau kembali ke seluruh akun.")}
                  action={<Button variant="secondary" onClick={() => setActiveFilter("all")}>{t("Lihat semua akun")}</Button>}
                />
              ) : (
                <AccountLedger accounts={filteredAccounts} onUpdateBalance={openBalanceDialog} onEdit={openEditAccountDialog} onToggleActive={openAccountToggleDialog} onDelete={openAccountDeleteDialog} dateLocale={dateLocale} />
              )}
            </Surface>

            <AccountHistory
              accounts={accounts}
              transfers={transfers}
              reconciliations={reconciliations}
              dateLocale={dateLocale}
            />
          </>
        )}
      </main>

      {activeDialog === "account" && (
        <AccountDialog
          form={accountForm}
          setForm={setAccountForm}
          mode={editingAccount ? "edit" : "create"}
          errors={formErrors}
          error={formError}
          saving={saving}
          nameInputRef={nameInputRef}
          onClose={closeDialog}
          onSubmit={saveAccount}
        />
      )}
      {accountToToggle && (
        <ConfirmDialog
          titleId="account-lifecycle-title"
          descriptionId="account-lifecycle-description"
          title={t(accountToToggle.is_active ? "Arsipkan {name}?" : "Aktifkan kembali {name}?", { name: accountToToggle.name })}
          description={t(accountToToggle.is_active ? "Akun akan disembunyikan dari transaksi, transfer, dan entri baru. Riwayat tetap utuh." : "Akun akan tersedia lagi untuk transaksi, transfer, dan entri baru.")}
          confirmLabel={t(accountToToggle.is_active ? "Arsipkan akun" : "Aktifkan akun")}
          cancelLabel={t("Batal")}
          onClose={() => { if (!saving) setAccountToToggle(null); }}
          onConfirm={() => void toggleAccountActive()}
          loading={saving}
          error={formError}
        />
      )}
      {accountToDelete && (
        <ConfirmDialog
          titleId="account-delete-title"
          descriptionId="account-delete-description"
          title={t("Hapus permanen {name}?", { name: accountToDelete.name })}
          description={t("Tindakan ini tidak dapat dibatalkan. Akun hanya bisa dihapus bila saldo nol dan tidak punya riwayat transaksi, transfer, jadwal, atau jurnal.")}
          confirmLabel={t("Hapus permanen")}
          cancelLabel={t("Batal")}
          onClose={() => { if (!saving) setAccountToDelete(null); }}
          onConfirm={() => void deleteAccount()}
          loading={saving}
          error={formError}
        />
      )}
      {activeDialog === "transfer" && (
        <TransferDialog
          form={transferForm}
          setForm={setTransferForm}
          accounts={activeAccounts}
          sourceAccount={sourceAccount}
          destinationAccount={destinationAccount}
          crossCurrency={isCrossCurrencyTransfer}
          errors={formErrors}
          error={formError}
          saving={saving}
          sourceInputRef={sourceInputRef}
          onClose={closeDialog}
          onSubmit={saveTransfer}
        />
      )}
      {activeDialog === "balance" && balanceAccount && (
        <BalanceDialog
          account={balanceAccount}
          form={balanceForm}
          setForm={setBalanceForm}
          errors={formErrors}
          error={formError}
          saving={saving}
          balanceInputRef={balanceInputRef}
          onClose={closeDialog}
          onSubmit={saveBalance}
        />
      )}
    </div>
  );
}

function WealthOverview({ summary }: { summary: ReturnType<typeof summarizeAccounts> }) {
  const { t } = useLanguage();
  return (
    <Surface className="overflow-hidden">
      <div className="grid lg:grid-cols-[1.45fr_1fr]">
        <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white px-5 py-6 sm:px-7 sm:py-7 lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{t("Kekayaan bersih")}</p>
          <p className="mt-3 break-words font-mono text-3xl font-bold tracking-[-0.05em] text-slate-950 sm:text-4xl">
            {idrFormatter.format(summary.netWorth)}
          </p>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">{t("Aset aktif dikurangi kewajiban aktif, berdasarkan nilai laporan IDR terbaru.")}</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-emerald-100 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
          <OverviewMetric icon={<ArrowUpRight className="h-4 w-4" />} label={t("Total aset")} value={idrFormatter.format(summary.assets)} tone="positive" />
          <OverviewMetric icon={<ArrowDownLeft className="h-4 w-4" />} label={t("Kewajiban")} value={idrFormatter.format(summary.liabilities)} tone="negative" />
          <OverviewMetric icon={<WalletCards className="h-4 w-4" />} label={t("Akun aktif")} value={String(summary.activeCount)} />
        </div>
      </div>
    </Surface>
  );
}

function OverviewMetric({ icon, label, value, tone = "neutral" }: { icon: ReactNode; label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return (
    <div className="min-w-0 px-3 py-4 sm:px-5 lg:flex lg:items-center lg:gap-4 lg:py-5">
      <span className={cn(
        "hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl lg:flex",
        tone === "positive" && "bg-emerald-50 text-emerald-700",
        tone === "negative" && "bg-rose-50 text-rose-600",
        tone === "neutral" && "bg-slate-100 text-slate-600",
      )}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:text-xs">{label}</p>
        <p className="mt-1 truncate text-xs font-bold text-slate-800 sm:text-sm">{value}</p>
      </div>
    </div>
  );
}

function AccountLedger({ accounts, onUpdateBalance, onEdit, onToggleActive, onDelete, dateLocale }: { accounts: AccountOverviewRecord[]; onUpdateBalance: (account: AccountOverviewRecord) => void; onEdit: (account: AccountOverviewRecord) => void; onToggleActive: (account: AccountOverviewRecord) => void; onDelete: (account: AccountOverviewRecord) => void; dateLocale: typeof idLocale }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="hidden md:block">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1fr)_auto] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          <span>{t("Akun")}</span><span>{t("Jenis")}</span><span className="text-right">{t("Saldo")}</span><span className="w-72 text-right">{t("Aksi")}</span>
        </div>
        {accounts.map((account) => <AccountRow key={account.id} account={account} onUpdateBalance={onUpdateBalance} onEdit={onEdit} onToggleActive={onToggleActive} onDelete={onDelete} dateLocale={dateLocale} />)}
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {accounts.map((account) => <AccountCard key={account.id} account={account} onUpdateBalance={onUpdateBalance} onEdit={onEdit} onToggleActive={onToggleActive} onDelete={onDelete} dateLocale={dateLocale} />)}
      </div>
    </>
  );
}

function AccountIdentity({ account, dateLocale }: { account: AccountOverviewRecord; dateLocale: typeof idLocale }) {
  const { t } = useLanguage();
  const Icon = kindIcon[account.kind];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", account.kind === "liability" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{account.name}</p>
          {!account.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">{t("Nonaktif")}</span>}
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{account.institution || t("Akun pribadi")} · {t("Diperbarui {date}", { date: format(parseISO(account.updated_at), "dd MMM yyyy", { locale: dateLocale }) })}</p>
      </div>
    </div>
  );
}

function AccountBalance({ account, align = "right" }: { account: AccountOverviewRecord; align?: "left" | "right" }) {
  const { t } = useLanguage();
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="font-mono text-sm font-bold text-slate-900">{formatMoney(Number(account.current_balance), account.currency)}</p>
      {account.currency !== "IDR" && (
        <p className={cn("mt-1 text-xs", account.reporting_balance_idr === null ? "font-semibold text-amber-700" : "text-slate-500")}>
          {account.reporting_balance_idr === null ? t("Nilai IDR belum diisi") : `${t("Setara")} ${idrFormatter.format(Number(account.reporting_balance_idr))}`}
        </p>
      )}
    </div>
  );
}

function AccountRow({ account, onUpdateBalance, onEdit, onToggleActive, onDelete, dateLocale }: { account: AccountOverviewRecord; onUpdateBalance: (account: AccountOverviewRecord) => void; onEdit: (account: AccountOverviewRecord) => void; onToggleActive: (account: AccountOverviewRecord) => void; onDelete: (account: AccountOverviewRecord) => void; dateLocale: typeof idLocale }) {
  const { t } = useLanguage();
  return (
    <article className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-emerald-50/35">
      <AccountIdentity account={account} dateLocale={dateLocale} />
      <div><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{t(getAccountKindLabel(account.kind))} · {account.currency}</span></div>
      <AccountBalance account={account} />
      <div className="flex w-72 justify-end gap-1"><Button variant="ghost" size="compact" onClick={() => onEdit(account)}>{t("Edit")}</Button>{account.is_active && account.currency !== "IDR" && <Button variant="ghost" size="compact" onClick={() => onUpdateBalance(account)}>{t("Perbarui nilai IDR")}</Button>}<Button variant="ghost" size="compact" onClick={() => onToggleActive(account)}>{t(account.is_active ? "Arsipkan" : "Aktifkan")}</Button><Button variant="ghost" size="compact" onClick={() => onDelete(account)}>{t("Hapus")}</Button></div>
    </article>
  );
}

function AccountCard({ account, onUpdateBalance, onEdit, onToggleActive, onDelete, dateLocale }: { account: AccountOverviewRecord; onUpdateBalance: (account: AccountOverviewRecord) => void; onEdit: (account: AccountOverviewRecord) => void; onToggleActive: (account: AccountOverviewRecord) => void; onDelete: (account: AccountOverviewRecord) => void; dateLocale: typeof idLocale }) {
  const { t } = useLanguage();
  return (
    <article className="p-4">
      <AccountIdentity account={account} dateLocale={dateLocale} />
      <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
        <AccountBalance account={account} align="left" />
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{t(getAccountKindLabel(account.kind))}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => onEdit(account)}>{t("Edit")}</Button><Button variant="secondary" onClick={() => onToggleActive(account)}>{t(account.is_active ? "Arsipkan" : "Aktifkan")}</Button>{account.is_active && account.currency !== "IDR" && <Button variant="secondary" onClick={() => onUpdateBalance(account)} className="col-span-2">{t("Perbarui nilai IDR")}</Button>}<Button variant="ghost" onClick={() => onDelete(account)} className="col-span-2 text-rose-700 hover:bg-rose-50 hover:text-rose-800">{t("Hapus permanen")}</Button></div>
    </article>
  );
}

function AccountHistory({ accounts, transfers, reconciliations, dateLocale }: {
  accounts: AccountOverviewRecord[];
  transfers: TransferRecord[];
  reconciliations: ReconciliationRecord[];
  dateLocale: typeof idLocale;
}) {
  const { t } = useLanguage();
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);

  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{t("Riwayat akun")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("Transfer dan rekonsiliasi terakhir. Riwayat tidak dapat diubah dari sini.")}</p>
      </div>
      {transfers.length === 0 && reconciliations.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500 sm:px-5">{t("Belum ada riwayat akun.")}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{t("Transfer")} · {accountNames.get(transfer.source_account_id) ?? t("Akun tidak tersedia")} → {accountNames.get(transfer.destination_account_id) ?? t("Akun tidak tersedia")}</p>
                  <p className="mt-1 text-xs text-slate-500">{format(parseISO(transfer.date), "dd MMM yyyy", { locale: dateLocale })}{transfer.note ? ` · ${transfer.note}` : ""}</p>
                </div>
                <p className="text-right font-mono text-sm font-bold text-slate-800">{formatMoney(Number(transfer.amount), transfer.currency)} → {formatMoney(Number(transfer.destination_amount), transfer.destination_currency)}</p>
              </div>
            </div>
          ))}
          {reconciliations.map((reconciliation) => {
            const account = accounts.find((item) => item.id === reconciliation.account_id);
            const currency = account?.currency ?? "IDR";
            const difference = Number(reconciliation.statement_balance) - Number(reconciliation.ledger_balance);
            return (
              <div key={reconciliation.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{t("Rekonsiliasi akun")} · {account?.name ?? t("Akun tidak tersedia")}</p>
                    <p className="mt-1 text-xs text-slate-500">{format(parseISO(reconciliation.reconciled_at), "dd MMM yyyy", { locale: dateLocale })}{reconciliation.note ? ` · ${reconciliation.note}` : ""}</p>
                  </div>
                  <p className="text-right text-xs leading-5 text-slate-600">{t("Statement {statement}; ledger {ledger}; selisih {difference}", {
                    statement: formatMoney(Number(reconciliation.statement_balance), currency),
                    ledger: formatMoney(Number(reconciliation.ledger_balance), currency),
                    difference: formatMoney(difference, currency),
                  })}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}

function AccountDialogFrame({ title, eyebrow, description, saving, error, initialFocusRef, onClose, onSubmit, children, submitLabel, submitDisabled = false }: {
  title: string;
  eyebrow: string;
  description: string;
  saving: boolean;
  error: string | null;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  children: ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <AccessibleDialogFrame
      titleId="account-dialog-title"
      descriptionId="account-dialog-description"
      initialFocusRef={initialFocusRef}
      onClose={onClose}
      closeDisabled={saving}
    >
      <form onSubmit={onSubmit}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p>
            <h2 id="account-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
            <p id="account-dialog-description" className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup {title}", { title: title.toLowerCase() })}><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          {children}
          <div aria-live="polite" aria-atomic="true">{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p>}</div>
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
          <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">{t("Batal")}</Button>
          <Button type="submit" loading={saving} disabled={submitDisabled} className="flex-[1.4] sm:flex-none">{submitLabel}</Button>
        </div>
      </form>
    </AccessibleDialogFrame>
  );
}

function AccountDialog({ form, setForm, mode, errors, error, saving, nameInputRef, onClose, onSubmit }: {
  form: AccountFormState;
  setForm: Dispatch<SetStateAction<AccountFormState>>;
  mode: AccountDialogMode;
  errors: Record<string, string>;
  error: string | null;
  saving: boolean;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { t } = useLanguage();
  const validation = validateAccountForm(form);
  const editing = mode === "edit";
  return (
    <AccountDialogFrame title={t(editing ? "Edit akun" : "Tambah akun")} eyebrow={t(editing ? "Identitas akun" : "Akun baru")} description={t(editing ? "Nama dan institusi dapat diperbarui. Saldo memakai form pembaruan saldo terpisah." : "Hubungkan satu sumber dana atau kewajiban ke overview FinTrack.")} saving={saving} error={error} initialFocusRef={nameInputRef} onClose={onClose} onSubmit={onSubmit} submitLabel={t(editing ? "Simpan perubahan" : "Simpan akun")} submitDisabled={!validation.valid}>
      <Field label={t("Nama akun")} htmlFor="account-name" error={errors.name ? t(errors.name) : undefined} hint={t("Contoh: Jago Utama atau Stockbit.")}>
        <input ref={nameInputRef} id="account-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("Nama yang mudah dikenali")} className={fieldControlStyles} />
      </Field>
      <Field label={t("Institusi")} htmlFor="account-institution" hint={t("Opsional—misalnya Bank Jago, BCA, atau HFM.")}>
        <input id="account-institution" value={form.institution} onChange={(event) => setForm((current) => ({ ...current, institution: event.target.value }))} placeholder={t("Nama bank atau platform")} className={fieldControlStyles} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Jenis akun")} htmlFor="account-kind">
          <select id="account-kind" disabled={editing} value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as FinancialAccountKind }))} className={fieldControlStyles}>
            {accountKinds.map((kind) => <option key={kind.value} value={kind.value}>{t(kind.label)}</option>)}
          </select>
        </Field>
        <Field label={t("Mata uang")} htmlFor="account-currency" error={errors.currency ? t(errors.currency) : undefined}>
          <input id="account-currency" disabled={editing} minLength={3} maxLength={3} value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className={fieldControlStyles} />
        </Field>
      </div>
      {!editing && <><Field label={t("Saldo awal")} htmlFor="account-balance" error={errors.currentBalance ? t(errors.currentBalance) : undefined} hint={t("Masukkan angka tanpa pemisah ribuan.")}>
        <input id="account-balance" type="number" step="any" inputMode="decimal" value={form.currentBalance} onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))} className={cn(fieldControlStyles, "font-mono text-base font-bold")} />
      </Field>
      {form.currency !== "IDR" && (
        <Field label={t("Nilai setara IDR")} htmlFor="account-reporting-balance" error={errors.reportingBalanceIdr ? t(errors.reportingBalanceIdr) : undefined} hint={t("Opsional, tetapi diperlukan agar akun masuk ke net worth IDR.")}>
          <input id="account-reporting-balance" type="number" min="0" step="any" inputMode="decimal" value={form.reportingBalanceIdr} onChange={(event) => setForm((current) => ({ ...current, reportingBalanceIdr: event.target.value }))} placeholder="0" className={fieldControlStyles} />
        </Field>
      )}</>}
      {editing && <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{t("Jenis akun, mata uang, dan saldo terkunci agar riwayat tetap konsisten.")}</p>}
    </AccountDialogFrame>
  );
}

function TransferDialog({ form, setForm, accounts, sourceAccount, destinationAccount, crossCurrency, errors, error, saving, sourceInputRef, onClose, onSubmit }: {
  form: TransferFormState;
  setForm: Dispatch<SetStateAction<TransferFormState>>;
  accounts: AccountOverviewRecord[];
  sourceAccount?: AccountOverviewRecord;
  destinationAccount?: AccountOverviewRecord;
  crossCurrency: boolean;
  errors: Record<string, string>;
  error: string | null;
  saving: boolean;
  sourceInputRef: RefObject<HTMLSelectElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { t } = useLanguage();
  const validation = validateTransferForm({ sourceAccountId: form.sourceAccountId, destinationAccountId: form.destinationAccountId, sourceAmount: form.amount, destinationAmount: form.destinationAmount, sourceCurrency: sourceAccount?.currency ?? "", destinationCurrency: destinationAccount?.currency ?? "", date: form.date });
  return (
    <AccountDialogFrame title={t("Transfer antar akun")} eyebrow={t("Pindahkan dana")} description={t("Saldo akun akan diperbarui otomatis setelah transfer tersimpan.")} saving={saving} error={error} initialFocusRef={sourceInputRef} onClose={onClose} onSubmit={onSubmit} submitLabel={t("Simpan transfer")} submitDisabled={!validation.valid}>
      <Field label={t("Dari akun")} htmlFor="transfer-source" error={errors.sourceAccountId ? t(errors.sourceAccountId) : undefined}>
        <select ref={sourceInputRef} id="transfer-source" value={form.sourceAccountId} onChange={(event) => setForm((current) => ({ ...current, sourceAccountId: event.target.value }))} className={fieldControlStyles}>
          <option value="">{t("Pilih akun asal")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
        </select>
      </Field>
      <Field label={t("Ke akun")} htmlFor="transfer-destination" error={errors.destinationAccountId ? t(errors.destinationAccountId) : undefined}>
        <select id="transfer-destination" value={form.destinationAccountId} onChange={(event) => setForm((current) => ({ ...current, destinationAccountId: event.target.value }))} className={fieldControlStyles}>
          <option value="">{t("Pilih akun tujuan")}</option>{accounts.map((account) => <option key={account.id} value={account.id} disabled={account.id === form.sourceAccountId}>{account.name} · {account.currency}</option>)}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Nominal dikirim{currency}", { currency: sourceAccount ? ` (${sourceAccount.currency})` : "" })} htmlFor="transfer-amount" error={errors.sourceAmount ? t(errors.sourceAmount) : undefined}>
          <input id="transfer-amount" type="number" min="0.000001" step="any" inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "font-mono font-bold")} />
        </Field>
        <Field label={t("Tanggal")} htmlFor="transfer-date" error={errors.date ? t(errors.date) : undefined}>
          <input id="transfer-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className={fieldControlStyles} />
        </Field>
      </div>
      {crossCurrency ? (
        <Field label={t("Nominal diterima ({currency})", { currency: destinationAccount?.currency ?? "" })} htmlFor="transfer-destination-amount" error={errors.destinationAmount ? t(errors.destinationAmount) : undefined} hint={t("Masukkan hasil konversi yang benar-benar diterima.")}>
          <input id="transfer-destination-amount" type="number" min="0.000001" step="any" inputMode="decimal" value={form.destinationAmount} onChange={(event) => setForm((current) => ({ ...current, destinationAmount: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "font-mono font-bold")} />
        </Field>
      ) : sourceAccount && destinationAccount ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">{t("Nominal diterima sama dengan nominal dikirim karena kedua akun memakai {currency}.", { currency: sourceAccount.currency })}</p>
      ) : null}
      <Field label={t("Jenis transfer")} htmlFor="transfer-kind">
        <select id="transfer-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))} className={fieldControlStyles}><option value="transfer">{t("Transfer biasa")}</option><option value="broker_deposit">{t("Deposit ke broker")}</option><option value="broker_withdrawal">{t("Withdraw dari broker")}</option></select>
      </Field>
      <Field label={t("Catatan")} htmlFor="transfer-note" hint={t("Opsional—tambahkan konteks untuk peninjauan berikutnya.")}>
        <textarea id="transfer-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder={t("Catatan singkat")} className={cn(fieldControlStyles, "resize-none")} />
      </Field>
    </AccountDialogFrame>
  );
}

function BalanceDialog({ account, form, setForm, errors, error, saving, balanceInputRef, onClose, onSubmit }: {
  account: AccountOverviewRecord;
  form: BalanceFormState;
  setForm: Dispatch<SetStateAction<BalanceFormState>>;
  errors: Record<string, string>;
  error: string | null;
  saving: boolean;
  balanceInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { t } = useLanguage();
  const reportingBalanceIdr = form.reportingBalanceIdr.trim() ? Number(form.reportingBalanceIdr) : null;
  const validReportingBalance = reportingBalanceIdr === null || (Number.isFinite(reportingBalanceIdr) && reportingBalanceIdr >= 0);
  return (
    <AccountDialogFrame title={t("Perbarui {name}", { name: account.name })} eyebrow={t("Nilai laporan")} description={t("Saldo ledger berubah dari transaksi terkonfirmasi, transfer, atau penyesuaian. Form ini hanya menyimpan nilai setara IDR untuk akun asing.")} saving={saving} error={error} initialFocusRef={balanceInputRef} onClose={onClose} onSubmit={onSubmit} submitLabel={t("Simpan nilai laporan")} submitDisabled={account.currency === "IDR" || !validReportingBalance}>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">{t("Saldo saat ini")}</p>
        <p className="mt-2 font-mono text-xl font-bold text-slate-900">{formatMoney(Number(account.current_balance), account.currency)}</p>
      </div>
      <Field label={t("Saldo ledger ({currency})", { currency: account.currency })} htmlFor="balance-current">
        <input ref={balanceInputRef} id="balance-current" type="number" value={form.currentBalance} readOnly aria-readonly="true" className={cn(fieldControlStyles, "cursor-not-allowed bg-slate-50 font-mono text-base font-bold text-slate-500")} />
      </Field>
      {account.currency === "IDR" && <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{t("Saldo akun IDR diperbarui lewat transaksi terkonfirmasi, transfer, atau penyesuaian rekening.")}</p>}
      {account.currency !== "IDR" && (
        <Field label={t("Nilai setara IDR")} htmlFor="balance-reporting" error={errors.reportingBalanceIdr ? t(errors.reportingBalanceIdr) : undefined} hint={t("Kosongkan jika belum ingin memasukkan akun ini ke total IDR.")}>
          <input id="balance-reporting" type="number" min="0" step="any" inputMode="decimal" value={form.reportingBalanceIdr} onChange={(event) => setForm((current) => ({ ...current, reportingBalanceIdr: event.target.value }))} placeholder="0" className={fieldControlStyles} />
        </Field>
      )}
    </AccountDialogFrame>
  );
}

function AccountsSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6" aria-label={t("Memuat akun")}>
      <Surface className="animate-pulse overflow-hidden"><div className="grid lg:grid-cols-[1.45fr_1fr]"><div className="space-y-4 px-6 py-8"><div className="h-3 w-28 rounded bg-emerald-100" /><div className="h-10 w-64 max-w-full rounded bg-slate-100" /><div className="h-4 w-80 max-w-full rounded bg-slate-100" /></div><div className="grid grid-cols-3 border-t border-emerald-100 lg:grid-cols-1 lg:border-l lg:border-t-0">{[1, 2, 3].map((item) => <div key={item} className="space-y-2 border-r border-emerald-100 px-4 py-5 last:border-r-0 lg:border-b lg:border-r-0"><div className="h-3 rounded bg-slate-100" /><div className="h-4 rounded bg-slate-100" /></div>)}</div></div></Surface>
      <Surface className="animate-pulse overflow-hidden"><div className="border-b border-slate-100 px-5 py-5"><div className="h-5 w-36 rounded bg-slate-100" /><div className="mt-4 h-10 w-full rounded bg-slate-100" /></div>{[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4 border-b border-slate-100 px-5 py-5 last:border-b-0"><div className="h-10 w-10 rounded-xl bg-emerald-100" /><div className="flex-1 space-y-2"><div className="h-4 w-40 rounded bg-slate-100" /><div className="h-3 w-56 max-w-full rounded bg-slate-100" /></div><div className="hidden h-5 w-24 rounded bg-slate-100 sm:block" /></div>)}</Surface>
    </div>
  );
}
