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
import { id } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Smartphone,
  WalletCards,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import {
  filterAccounts,
  getAccountKindLabel,
  getMissingForeignAccounts,
  summarizeAccounts,
  validateAccountForm,
  validateBalanceForm,
  validateTransferForm,
  type AccountFilter,
  type AccountOverviewRecord,
} from "@/lib/accounts";
import type { FinancialAccountKind } from "@/lib/ledger";
import { supabase } from "@/lib/supabase";
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
  date: new Date().toISOString().slice(0, 10),
  kind: "transfer",
  note: "",
});

type AccountFormState = typeof emptyAccountForm;
type TransferFormState = ReturnType<typeof createTransferForm>;
type BalanceFormState = { currentBalance: string; reportingBalanceIdr: string };
type DialogKind = "account" | "transfer" | "balance" | null;

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
  const [accounts, setAccounts] = useState<AccountOverviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeDialog, setActiveDialog] = useState<DialogKind>(null);
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("all");
  const [balanceAccount, setBalanceAccount] = useState<AccountOverviewRecord | null>(null);
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
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, name, institution, kind, currency, current_balance, reporting_balance_idr, is_active, updated_at")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      setAccounts((data ?? []) as AccountOverviewRecord[]);
    } catch (error) {
      reportHandledError("Accounts unavailable", error, "Data akun belum berhasil dimuat.");
      setPageError("Data akun belum berhasil dimuat. Coba lagi beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccounts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  const closeDialog = useCallback(() => {
    if (saving) return;
    setActiveDialog(null);
    setFormError(null);
    setFormErrors({});
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }, [saving]);

  useEffect(() => {
    if (!activeDialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      if (activeDialog === "account") nameInputRef.current?.focus();
      if (activeDialog === "transfer") sourceInputRef.current?.focus();
      if (activeDialog === "balance") balanceInputRef.current?.focus();
    }, 80);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeDialog, closeDialog]);

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
    setAccountForm(emptyAccountForm);
    setFormError(null);
    setFormErrors({});
    setActiveDialog("account");
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

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      const { error } = await supabase.from("financial_accounts").insert({
        user_id: user.id,
        name: accountForm.name.trim(),
        institution: accountForm.institution.trim() || null,
        kind: accountForm.kind,
        currency: accountForm.currency,
        current_balance: Number(accountForm.currentBalance),
        reporting_balance_idr: accountForm.currency === "IDR" ? null : reportingBalanceIdr,
      });
      if (error) throw error;
      setActiveDialog(null);
      setAccountForm(emptyAccountForm);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Account save failed", error, "Akun belum berhasil disimpan.");
      setFormError("Akun belum berhasil disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setFormError("Transfer belum berhasil disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!balanceAccount) return;
    const validation = validateBalanceForm({ ...balanceForm, currency: balanceAccount.currency });
    if (!validation.valid) {
      setFormErrors(validation.errors as Record<string, string>);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const reportingBalanceIdr = balanceForm.reportingBalanceIdr.trim() ? Number(balanceForm.reportingBalanceIdr) : null;
      const { error } = await supabase
        .from("financial_accounts")
        .update({
          current_balance: Number(balanceForm.currentBalance),
          reporting_balance_idr: balanceAccount.currency === "IDR" ? null : reportingBalanceIdr,
        })
        .eq("id", balanceAccount.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setActiveDialog(null);
      setBalanceAccount(null);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Balance update failed", error, "Saldo belum berhasil diperbarui.");
      setFormError("Saldo belum berhasil diperbarui. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main className="app-page-content space-y-5 sm:space-y-6">
        <PageHeader
          eyebrow="Pusat akun"
          title="Akun & saldo"
          description="Lihat kekayaan bersih, cek kesegaran saldo, dan pindahkan dana tanpa kehilangan konteks."
          actions={
            <>
              <Button variant="secondary" onClick={openTransferDialog} disabled={activeAccounts.length < 2}>
                <ArrowLeftRight className="h-4 w-4" /> Transfer
              </Button>
              <Button onClick={openAccountDialog}>
                <Plus className="h-4 w-4" /> Tambah akun
              </Button>
            </>
          }
        />

        {pageError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{pageError}</span>
            <Button variant="secondary" size="compact" onClick={() => void loadAccounts()}>
              <RefreshCw className="h-4 w-4" /> Coba lagi
            </Button>
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
                    <p className="text-sm font-bold text-amber-900">{missingForeignAccounts.length} akun belum masuk total IDR</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">Isi nilai setara IDR agar net worth tidak kurang dari kondisi sebenarnya.</p>
                  </div>
                </div>
                <Button variant="secondary" size="compact" onClick={() => openBalanceDialog(missingForeignAccounts[0])}>
                  Lengkapi {missingForeignAccounts[0].name}
                </Button>
              </div>
            )}

            <Surface className="overflow-hidden">
              <div className="border-b border-emerald-100 px-4 py-4 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">Portofolio akun</h2>
                    <p className="mt-1 text-xs text-slate-500">{accounts.length} akun terhubung · {summary.activeCount} aktif</p>
                  </div>
                </div>
                <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filter jenis akun">
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
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {accounts.length === 0 ? (
                <EmptyState
                  icon={WalletCards}
                  title="Mulai dari akun pertamamu"
                  description="Tambahkan rekening bank, e-wallet, akun investasi, atau broker untuk membangun gambaran kekayaan yang utuh."
                  action={<Button onClick={openAccountDialog}><Plus className="h-4 w-4" /> Tambah akun</Button>}
                />
              ) : filteredAccounts.length === 0 ? (
                <EmptyState
                  icon={WalletCards}
                  title="Belum ada akun di kelompok ini"
                  description="Pilih kelompok lain atau kembali ke seluruh akun."
                  action={<Button variant="secondary" onClick={() => setActiveFilter("all")}>Lihat semua akun</Button>}
                />
              ) : (
                <AccountLedger accounts={filteredAccounts} onUpdateBalance={openBalanceDialog} />
              )}
            </Surface>
          </>
        )}
      </main>

      {activeDialog === "account" && (
        <AccountDialog
          form={accountForm}
          setForm={setAccountForm}
          errors={formErrors}
          error={formError}
          saving={saving}
          nameInputRef={nameInputRef}
          onClose={closeDialog}
          onSubmit={saveAccount}
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
  return (
    <Surface className="overflow-hidden">
      <div className="grid lg:grid-cols-[1.45fr_1fr]">
        <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white px-5 py-6 sm:px-7 sm:py-7 lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Kekayaan bersih</p>
          <p className="mt-3 break-words font-mono text-3xl font-bold tracking-[-0.05em] text-slate-950 sm:text-4xl">
            {idrFormatter.format(summary.netWorth)}
          </p>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">Aset aktif dikurangi kewajiban aktif, berdasarkan nilai laporan IDR terbaru.</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-emerald-100 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
          <OverviewMetric icon={<ArrowUpRight className="h-4 w-4" />} label="Total aset" value={idrFormatter.format(summary.assets)} tone="positive" />
          <OverviewMetric icon={<ArrowDownLeft className="h-4 w-4" />} label="Kewajiban" value={idrFormatter.format(summary.liabilities)} tone="negative" />
          <OverviewMetric icon={<WalletCards className="h-4 w-4" />} label="Akun aktif" value={String(summary.activeCount)} />
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

function AccountLedger({ accounts, onUpdateBalance }: { accounts: AccountOverviewRecord[]; onUpdateBalance: (account: AccountOverviewRecord) => void }) {
  return (
    <>
      <div className="hidden md:block">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1fr)_auto] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          <span>Akun</span><span>Jenis</span><span className="text-right">Saldo</span><span className="w-32 text-right">Aksi</span>
        </div>
        {accounts.map((account) => <AccountRow key={account.id} account={account} onUpdateBalance={onUpdateBalance} />)}
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {accounts.map((account) => <AccountCard key={account.id} account={account} onUpdateBalance={onUpdateBalance} />)}
      </div>
    </>
  );
}

function AccountIdentity({ account }: { account: AccountOverviewRecord }) {
  const Icon = kindIcon[account.kind];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", account.kind === "liability" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{account.name}</p>
          {!account.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Nonaktif</span>}
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{account.institution || "Akun pribadi"} · Diperbarui {format(parseISO(account.updated_at), "dd MMM yyyy", { locale: id })}</p>
      </div>
    </div>
  );
}

function AccountBalance({ account, align = "right" }: { account: AccountOverviewRecord; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="font-mono text-sm font-bold text-slate-900">{formatMoney(Number(account.current_balance), account.currency)}</p>
      {account.currency !== "IDR" && (
        <p className={cn("mt-1 text-xs", account.reporting_balance_idr === null ? "font-semibold text-amber-700" : "text-slate-500")}>
          {account.reporting_balance_idr === null ? "Nilai IDR belum diisi" : `Setara ${idrFormatter.format(Number(account.reporting_balance_idr))}`}
        </p>
      )}
    </div>
  );
}

function AccountRow({ account, onUpdateBalance }: { account: AccountOverviewRecord; onUpdateBalance: (account: AccountOverviewRecord) => void }) {
  return (
    <article className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-emerald-50/35">
      <AccountIdentity account={account} />
      <div><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{getAccountKindLabel(account.kind)} · {account.currency}</span></div>
      <AccountBalance account={account} />
      <Button variant="ghost" size="compact" onClick={() => onUpdateBalance(account)} className="w-32">Perbarui saldo</Button>
    </article>
  );
}

function AccountCard({ account, onUpdateBalance }: { account: AccountOverviewRecord; onUpdateBalance: (account: AccountOverviewRecord) => void }) {
  return (
    <article className="p-4">
      <AccountIdentity account={account} />
      <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
        <AccountBalance account={account} align="left" />
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{getAccountKindLabel(account.kind)}</span>
      </div>
      <Button variant="secondary" onClick={() => onUpdateBalance(account)} className="mt-3 w-full">Perbarui saldo</Button>
    </article>
  );
}

function DialogFrame({ title, eyebrow, description, saving, error, onClose, onSubmit, children, submitLabel, submitDisabled = false }: {
  title: string;
  eyebrow: string;
  description: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  children: ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <form onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" className="max-h-[calc(100svh-0.75rem)] w-full overflow-y-auto rounded-t-[28px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:max-w-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p>
            <h2 id="account-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={`Tutup ${title.toLowerCase()}`}><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          {children}
          <div aria-live="polite" aria-atomic="true">{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p>}</div>
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
          <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">Batal</Button>
          <Button type="submit" disabled={saving || submitDisabled} className="flex-[1.4] sm:flex-none">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AccountDialog({ form, setForm, errors, error, saving, nameInputRef, onClose, onSubmit }: {
  form: AccountFormState;
  setForm: Dispatch<SetStateAction<AccountFormState>>;
  errors: Record<string, string>;
  error: string | null;
  saving: boolean;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const validation = validateAccountForm(form);
  return (
    <DialogFrame title="Tambah akun" eyebrow="Akun baru" description="Hubungkan satu sumber dana atau kewajiban ke overview FinTrack." saving={saving} error={error} onClose={onClose} onSubmit={onSubmit} submitLabel="Simpan akun" submitDisabled={!validation.valid}>
      <Field label="Nama akun" htmlFor="account-name" error={errors.name} hint="Contoh: Jago Utama atau Stockbit.">
        <input ref={nameInputRef} id="account-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nama yang mudah dikenali" className={fieldControlStyles} />
      </Field>
      <Field label="Institusi" htmlFor="account-institution" hint="Opsional—misalnya Bank Jago, BCA, atau HFM.">
        <input id="account-institution" value={form.institution} onChange={(event) => setForm((current) => ({ ...current, institution: event.target.value }))} placeholder="Nama bank atau platform" className={fieldControlStyles} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jenis akun" htmlFor="account-kind">
          <select id="account-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as FinancialAccountKind }))} className={fieldControlStyles}>
            {accountKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </select>
        </Field>
        <Field label="Mata uang" htmlFor="account-currency" error={errors.currency}>
          <select id="account-currency" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} className={fieldControlStyles}><option value="IDR">IDR</option><option value="USD">USD</option></select>
        </Field>
      </div>
      <Field label="Saldo awal" htmlFor="account-balance" error={errors.currentBalance} hint="Masukkan angka tanpa pemisah ribuan.">
        <input id="account-balance" type="number" step="any" inputMode="decimal" value={form.currentBalance} onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))} className={cn(fieldControlStyles, "font-mono text-base font-bold")} />
      </Field>
      {form.currency !== "IDR" && (
        <Field label="Nilai setara IDR" htmlFor="account-reporting-balance" error={errors.reportingBalanceIdr} hint="Opsional, tetapi diperlukan agar akun masuk ke net worth IDR.">
          <input id="account-reporting-balance" type="number" min="0" step="any" inputMode="decimal" value={form.reportingBalanceIdr} onChange={(event) => setForm((current) => ({ ...current, reportingBalanceIdr: event.target.value }))} placeholder="0" className={fieldControlStyles} />
        </Field>
      )}
    </DialogFrame>
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
  const validation = validateTransferForm({ sourceAccountId: form.sourceAccountId, destinationAccountId: form.destinationAccountId, sourceAmount: form.amount, destinationAmount: form.destinationAmount, sourceCurrency: sourceAccount?.currency ?? "", destinationCurrency: destinationAccount?.currency ?? "", date: form.date });
  return (
    <DialogFrame title="Transfer antar akun" eyebrow="Pindahkan dana" description="Saldo akun akan diperbarui otomatis setelah transfer tersimpan." saving={saving} error={error} onClose={onClose} onSubmit={onSubmit} submitLabel="Simpan transfer" submitDisabled={!validation.valid}>
      <Field label="Dari akun" htmlFor="transfer-source" error={errors.sourceAccountId}>
        <select ref={sourceInputRef} id="transfer-source" value={form.sourceAccountId} onChange={(event) => setForm((current) => ({ ...current, sourceAccountId: event.target.value }))} className={fieldControlStyles}>
          <option value="">Pilih akun asal</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
        </select>
      </Field>
      <Field label="Ke akun" htmlFor="transfer-destination" error={errors.destinationAccountId}>
        <select id="transfer-destination" value={form.destinationAccountId} onChange={(event) => setForm((current) => ({ ...current, destinationAccountId: event.target.value }))} className={fieldControlStyles}>
          <option value="">Pilih akun tujuan</option>{accounts.map((account) => <option key={account.id} value={account.id} disabled={account.id === form.sourceAccountId}>{account.name} · {account.currency}</option>)}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Nominal dikirim${sourceAccount ? ` (${sourceAccount.currency})` : ""}`} htmlFor="transfer-amount" error={errors.sourceAmount}>
          <input id="transfer-amount" type="number" min="0.000001" step="any" inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "font-mono font-bold")} />
        </Field>
        <Field label="Tanggal" htmlFor="transfer-date" error={errors.date}>
          <input id="transfer-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className={fieldControlStyles} />
        </Field>
      </div>
      {crossCurrency ? (
        <Field label={`Nominal diterima (${destinationAccount?.currency})`} htmlFor="transfer-destination-amount" error={errors.destinationAmount} hint="Masukkan hasil konversi yang benar-benar diterima.">
          <input id="transfer-destination-amount" type="number" min="0.000001" step="any" inputMode="decimal" value={form.destinationAmount} onChange={(event) => setForm((current) => ({ ...current, destinationAmount: event.target.value }))} placeholder="0" className={cn(fieldControlStyles, "font-mono font-bold")} />
        </Field>
      ) : sourceAccount && destinationAccount ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">Nominal diterima sama dengan nominal dikirim karena kedua akun memakai {sourceAccount.currency}.</p>
      ) : null}
      <Field label="Jenis transfer" htmlFor="transfer-kind">
        <select id="transfer-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))} className={fieldControlStyles}><option value="transfer">Transfer biasa</option><option value="broker_deposit">Deposit ke broker</option><option value="broker_withdrawal">Withdraw dari broker</option></select>
      </Field>
      <Field label="Catatan" htmlFor="transfer-note" hint="Opsional—tambahkan konteks untuk peninjauan berikutnya.">
        <textarea id="transfer-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Catatan singkat" className={cn(fieldControlStyles, "resize-none")} />
      </Field>
    </DialogFrame>
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
  const validation = validateBalanceForm({ ...form, currency: account.currency });
  return (
    <DialogFrame title={`Perbarui ${account.name}`} eyebrow="Snapshot saldo" description="Gunakan angka terbaru dari bank atau platform. Riwayat transaksi tetap tercatat terpisah." saving={saving} error={error} onClose={onClose} onSubmit={onSubmit} submitLabel="Simpan saldo" submitDisabled={!validation.valid}>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">Saldo saat ini</p>
        <p className="mt-2 font-mono text-xl font-bold text-slate-900">{formatMoney(Number(account.current_balance), account.currency)}</p>
      </div>
      <Field label={`Saldo terbaru (${account.currency})`} htmlFor="balance-current" error={errors.currentBalance}>
        <input ref={balanceInputRef} id="balance-current" type="number" step="any" inputMode="decimal" value={form.currentBalance} onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))} className={cn(fieldControlStyles, "font-mono text-base font-bold")} />
      </Field>
      {account.currency !== "IDR" && (
        <Field label="Nilai setara IDR" htmlFor="balance-reporting" error={errors.reportingBalanceIdr} hint="Kosongkan jika belum ingin memasukkan akun ini ke total IDR.">
          <input id="balance-reporting" type="number" min="0" step="any" inputMode="decimal" value={form.reportingBalanceIdr} onChange={(event) => setForm((current) => ({ ...current, reportingBalanceIdr: event.target.value }))} placeholder="0" className={fieldControlStyles} />
        </Field>
      )}
    </DialogFrame>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Memuat akun">
      <Surface className="animate-pulse overflow-hidden"><div className="grid lg:grid-cols-[1.45fr_1fr]"><div className="space-y-4 px-6 py-8"><div className="h-3 w-28 rounded bg-emerald-100" /><div className="h-10 w-64 max-w-full rounded bg-slate-100" /><div className="h-4 w-80 max-w-full rounded bg-slate-100" /></div><div className="grid grid-cols-3 border-t border-emerald-100 lg:grid-cols-1 lg:border-l lg:border-t-0">{[1, 2, 3].map((item) => <div key={item} className="space-y-2 border-r border-emerald-100 px-4 py-5 last:border-r-0 lg:border-b lg:border-r-0"><div className="h-3 rounded bg-slate-100" /><div className="h-4 rounded bg-slate-100" /></div>)}</div></div></Surface>
      <Surface className="animate-pulse overflow-hidden"><div className="border-b border-slate-100 px-5 py-5"><div className="h-5 w-36 rounded bg-slate-100" /><div className="mt-4 h-10 w-full rounded bg-slate-100" /></div>{[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4 border-b border-slate-100 px-5 py-5 last:border-b-0"><div className="h-10 w-10 rounded-xl bg-emerald-100" /><div className="flex-1 space-y-2"><div className="h-4 w-40 rounded bg-slate-100" /><div className="h-3 w-56 max-w-full rounded bg-slate-100" /></div><div className="hidden h-5 w-24 rounded bg-slate-100 sm:block" /></div>)}</Surface>
    </div>
  );
}
