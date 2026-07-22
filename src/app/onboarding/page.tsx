"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  Loader2,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useOnboarding } from "@/components/OnboardingBoundary";
import BrandLogo from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { reportHandledError } from "@/lib/errors";
import type { FinancialAccountKind } from "@/lib/ledger";
import {
  buildOnboardingSummary,
  createOnboardingDeferral,
  getOnboardingProgressInfo,
  validateOnboardingAccount,
  validateOnboardingTransaction,
  type OnboardingIntent,
  type OnboardingProgress,
} from "@/lib/onboarding";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { cn } from "@/lib/utils";

const intentOptions = [
  { value: "cash-flow" as const, label: "Rapikan arus kas", description: "Mulai melihat pemasukan dan pengeluaran dengan lebih jernih.", icon: CircleDollarSign },
  { value: "balance" as const, label: "Pantau saldo", description: "Satukan posisi rekening penting dalam satu ringkasan.", icon: WalletCards },
  { value: "habit" as const, label: "Bangun kebiasaan", description: "Mulai dari satu pencatatan sederhana yang bisa diulang.", icon: PiggyBank },
];

const accountKinds: Array<{ value: FinancialAccountKind; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "E-wallet" },
  { value: "investment", label: "Investasi" },
  { value: "trading", label: "Trading" },
  { value: "liability", label: "Kewajiban" },
];

const emptyAccountForm = {
  name: "",
  institution: "",
  kind: "bank" as FinancialAccountKind,
  currency: "IDR",
  currentBalance: "0",
  reportingBalanceIdr: "",
};

const emptyTransactionForm = {
  type: "expense" as "income" | "expense",
  amount: "",
  merchant: "",
  date: "",
  category: "Lainnya",
  note: "",
};

type SavedAccount = {
  id: string;
  name: string;
  currency: string;
  current_balance: number;
};

type SavedTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  merchant: string | null;
  category: string;
  date: string;
  account_id: string;
};

function createProgress(userId: string): OnboardingProgress {
  return {
    version: 1,
    userId,
    step: "welcome",
    intent: null,
    accountId: null,
    accountName: null,
    transactionId: null,
    completedAt: null,
    deferredUntil: null,
  };
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value);
}

export default function OnboardingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, progress, saveProgress, refresh } = useOnboarding();
  const [localProgress, setLocalProgress] = useState<OnboardingProgress>(() => progress ?? createProgress(userId));
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [transactionForm, setTransactionForm] = useState(emptyTransactionForm);
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});
  const [transactionErrors, setTransactionErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAccount, setSavedAccount] = useState<SavedAccount | null>(null);
  const [savedTransaction, setSavedTransaction] = useState<SavedTransaction | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = localProgress.step;
  const progressInfo = getOnboardingProgressInfo(step);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTransactionForm((current) => current.date ? current : {
        ...current,
        date: new Date().toISOString().slice(0, 10),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!localProgress.accountId) return;
    let active = true;
    void (async () => {
      const [accountResult, transactionResult] = await Promise.all([
        supabase
          .from("financial_accounts")
          .select("id, name, currency, current_balance")
          .eq("user_id", userId)
          .eq("id", localProgress.accountId)
          .single(),
        localProgress.transactionId
          ? supabase
            .from("transactions")
            .select("id, type, amount, merchant, category, date, account_id")
            .eq("user_id", userId)
            .eq("id", localProgress.transactionId)
            .single()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (!active) return;
      if (accountResult.data) setSavedAccount(accountResult.data as SavedAccount);
      if (transactionResult.data) setSavedTransaction(transactionResult.data as SavedTransaction);
    })().catch((loadError) => {
      reportHandledError("Onboarding saved data unavailable", loadError, "Data penyiapan belum bisa dimuat.");
    });
    return () => { active = false; };
  }, [localProgress.accountId, localProgress.transactionId, userId]);

  const updateProgress = (updates: Partial<OnboardingProgress>) => {
    const next = { ...localProgress, ...updates };
    setLocalProgress(next);
    saveProgress(next);
    setFormError(null);
  };

  const selectIntent = (intent: OnboardingIntent) => updateProgress({ intent });

  const continueFromWelcome = () => {
    if (!localProgress.intent) {
      setFormError("Pilih fokus utama agar penyiapan terasa lebih relevan.");
      return;
    }
    updateProgress({ step: "account", deferredUntil: null });
  };

  const saveAccount = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateOnboardingAccount(accountForm);
    if (!validation.valid) {
      setAccountErrors(validation.errors as Record<string, string>);
      return;
    }

    setSaving(true);
    setFormError(null);
    setAccountErrors({});
    try {
      const { data, error } = await supabase
        .from("financial_accounts")
        .insert({
          user_id: userId,
          name: accountForm.name.trim(),
          institution: accountForm.institution.trim() || null,
          kind: accountForm.kind,
          currency: accountForm.currency,
          current_balance: Number(accountForm.currentBalance),
          reporting_balance_idr: accountForm.currency === "IDR" || !accountForm.reportingBalanceIdr.trim()
            ? null
            : Number(accountForm.reportingBalanceIdr),
        })
        .select("id, name, currency, current_balance")
        .single();
      if (error) throw error;
      const account = data as SavedAccount;
      setSavedAccount(account);
      updateProgress({
        step: "transaction",
        accountId: account.id,
        accountName: account.name,
        transactionId: null,
        deferredUntil: null,
      });
      await refresh();
    } catch (saveError) {
      reportHandledError("Onboarding account save failed", saveError, "Akun pertama belum berhasil disimpan.");
      setFormError("Akun pertama belum berhasil disimpan. Inputmu tetap aman, coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const saveTransaction = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateOnboardingTransaction({
      ...transactionForm,
      accountId: localProgress.accountId ?? "",
    });
    if (!validation.valid) {
      setTransactionErrors(validation.errors as Record<string, string>);
      return;
    }

    setSaving(true);
    setFormError(null);
    setTransactionErrors({});
    try {
      const { data, error } = await supabase
        .from("transactions")
        .insert([{
          user_id: userId,
          date: transactionForm.date,
          type: transactionForm.type,
          merchant: transactionForm.merchant.trim(),
          category: transactionForm.category.trim(),
          amount: Number(transactionForm.amount),
          note: transactionForm.note.trim() || null,
          source: "manual",
          status: "confirmed",
          account_id: localProgress.accountId,
        }])
        .select("id, type, amount, merchant, category, date, account_id")
        .single();
      if (error) throw error;
      const transaction = data as SavedTransaction;
      setSavedTransaction(transaction);
      updateProgress({ step: "summary", transactionId: transaction.id, deferredUntil: null });
      await refresh();
    } catch (saveError) {
      reportHandledError("Onboarding transaction save failed", saveError, "Transaksi pertama belum berhasil disimpan.");
      setFormError("Transaksi pertama belum berhasil disimpan. Inputmu tetap aman, coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const deferSetup = () => {
    const deferred = createOnboardingDeferral(localProgress, new Date());
    setLocalProgress(deferred);
    saveProgress(deferred);
    router.replace("/dashboard");
  };

  const finish = () => {
    const completed = { ...localProgress, completedAt: new Date().toISOString(), deferredUntil: null };
    setLocalProgress(completed);
    saveProgress(completed);
    router.replace("/dashboard");
  };

  const summary = useMemo(() => {
    if (!savedAccount || !savedTransaction) return null;
    const impact = savedTransaction.type === "income" ? Number(savedTransaction.amount) : -Number(savedTransaction.amount);
    return buildOnboardingSummary({
      accountName: savedAccount.name,
      currency: savedAccount.currency,
      openingBalance: Number(savedAccount.current_balance) - impact,
      transactionType: savedTransaction.type,
      transactionAmount: Number(savedTransaction.amount),
    });
  }, [savedAccount, savedTransaction]);

  return (
    <div className="min-h-[100svh] bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_48%,#f8faf9_100%)] text-slate-900">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl pr-3 font-bold tracking-tight text-slate-900">
          <BrandLogo size={40} priority />
          <span className="text-xl">FinTrack</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          {step !== "welcome" && step !== "summary" && (
            <button onClick={deferSetup} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-white hover:text-emerald-800">{t("Lanjutkan nanti")}</button>
          )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-8 px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-8 lg:min-h-[calc(100svh-96px)] lg:grid-cols-[340px_minmax(0,1fr)] lg:items-center lg:gap-16 lg:px-10 lg:pb-16">
        <aside className="lg:self-stretch lg:border-r lg:border-emerald-100 lg:py-14 lg:pr-12">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700"><ShieldCheck className="h-4 w-4" /> {t("Penyiapan privat")}</p>
          <h2 className="mt-4 text-2xl font-bold tracking-[-0.035em] text-slate-900 lg:text-3xl">{t("Mulai dari angka yang paling berguna.")}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{t("Satu akun dan satu transaksi sudah cukup untuk membuka ringkasan pertamamu.")}</p>
          <div className="mt-6" aria-label={t("Langkah {current} dari {total}", { current: progressInfo.current, total: progressInfo.total })}>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>{t("Langkah {current} dari {total}", { current: progressInfo.current, total: progressInfo.total })}</span><span>{progressInfo.percentage}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-600 transition-[width] motion-reduce:transition-none" style={{ width: `${progressInfo.percentage}%` }} /></div>
          </div>
          <ol className="mt-7 hidden space-y-4 lg:block">
            <ProgressItem label="Pilih fokus" complete={step !== "welcome"} active={step === "welcome"} />
            <ProgressItem label="Tambahkan akun" complete={step === "transaction" || step === "summary"} active={step === "account"} />
            <ProgressItem label="Catat transaksi" complete={step === "summary"} active={step === "transaction" || step === "summary"} />
          </ol>
        </aside>

        <section className="mx-auto w-full max-w-2xl rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
          {step === "welcome" && (
            <WelcomeStep
              headingRef={headingRef}
              selected={localProgress.intent}
              error={formError}
              onSelect={selectIntent}
              onContinue={continueFromWelcome}
            />
          )}
          {step === "account" && (
            <AccountStep
              headingRef={headingRef}
              form={accountForm}
              setForm={setAccountForm}
              errors={accountErrors}
              error={formError}
              saving={saving}
              onBack={() => updateProgress({ step: "welcome" })}
              onSubmit={saveAccount}
            />
          )}
          {step === "transaction" && (
            <TransactionStep
              headingRef={headingRef}
              accountName={localProgress.accountName ?? savedAccount?.name ?? "Akun pertama"}
              form={transactionForm}
              setForm={setTransactionForm}
              errors={transactionErrors}
              error={formError}
              saving={saving}
              onSubmit={saveTransaction}
            />
          )}
          {step === "summary" && (
            <SummaryStep
              headingRef={headingRef}
              summary={summary}
              transaction={savedTransaction}
              onFinish={finish}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function WelcomeStep({ headingRef, selected, error, onSelect, onContinue }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  selected: OnboardingIntent | null;
  error: string | null;
  onSelect: (intent: OnboardingIntent) => void;
  onContinue: () => void;
}) {
  return <>
    <p className="text-sm font-bold text-emerald-700">Selamat datang</p>
    <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-bold tracking-[-0.04em] outline-none sm:text-4xl">Apa yang ingin kamu rapikan dulu?</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">Pilihan ini hanya membantu FinTrack memberi konteks yang lebih pas. Kamu tetap mendapat semua fitur.</p>
    <div className="mt-7 grid gap-3">
      {intentOptions.map(({ value, label, description, icon: Icon }) => {
        const active = selected === value;
        return <button key={value} type="button" aria-pressed={active} onClick={() => onSelect(value)} className={cn("grid min-h-20 grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100", active ? "border-emerald-500 bg-emerald-50/70" : "border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30")}>
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", active ? "bg-emerald-700 text-white" : "bg-slate-50 text-slate-500")}><Icon className="h-5 w-5" /></span>
          <span><span className="block text-sm font-bold text-slate-800">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
          <Check className={cn("h-5 w-5", active ? "text-emerald-700" : "text-slate-200")} />
        </button>;
      })}
    </div>
    <FormMessage message={error} />
    <Button className="mt-7 w-full sm:w-auto sm:min-w-44" onClick={onContinue}>Lanjutkan <ArrowRight className="h-4 w-4" /></Button>
  </>;
}

function AccountStep({ headingRef, form, setForm, errors, error, saving, onBack, onSubmit }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  form: typeof emptyAccountForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyAccountForm>>;
  errors: Record<string, string>;
  error: string | null;
  saving: boolean;
  onBack: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return <form onSubmit={onSubmit} noValidate>
    <p className="text-sm font-bold text-emerald-700">Akun pertama</p>
    <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-bold tracking-[-0.04em] outline-none sm:text-4xl">Di mana uangmu paling sering bergerak?</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">Mulai dari rekening atau e-wallet utama. Akun lain bisa ditambahkan kapan saja.</p>
    <div className="mt-7 grid gap-5 sm:grid-cols-2">
      <Field label="Nama akun" htmlFor="onboarding-account-name" error={errors.name}><input id="onboarding-account-name" autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: BCA Utama" className={fieldControlStyles} /></Field>
      <Field label="Institusi (opsional)" htmlFor="onboarding-institution"><input id="onboarding-institution" value={form.institution} onChange={(event) => setForm((current) => ({ ...current, institution: event.target.value }))} placeholder="Nama bank atau penyedia" className={fieldControlStyles} /></Field>
      <Field label="Jenis akun" htmlFor="onboarding-account-kind"><select id="onboarding-account-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as FinancialAccountKind }))} className={fieldControlStyles}>{accountKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <Field label="Mata uang" htmlFor="onboarding-currency" error={errors.currency}><select id="onboarding-currency" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} className={fieldControlStyles}><option value="IDR">IDR — Rupiah</option><option value="USD">USD — Dolar AS</option></select></Field>
      <Field label="Saldo awal" htmlFor="onboarding-opening-balance" error={errors.currentBalance} hint="Masukkan 0 jika ingin mulai mencatat dari hari ini."><input id="onboarding-opening-balance" type="number" inputMode="decimal" value={form.currentBalance} onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))} className={fieldControlStyles} /></Field>
      {form.currency !== "IDR" && <Field label="Nilai setara IDR (opsional)" htmlFor="onboarding-reporting-balance" error={errors.reportingBalanceIdr}><input id="onboarding-reporting-balance" type="number" inputMode="decimal" value={form.reportingBalanceIdr} onChange={(event) => setForm((current) => ({ ...current, reportingBalanceIdr: event.target.value }))} className={fieldControlStyles} /></Field>}
    </div>
    <FormMessage message={error} />
    <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Kembali</Button><Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan akun...</> : <>Simpan akun <ArrowRight className="h-4 w-4" /></>}</Button></div>
  </form>;
}

function TransactionStep({ headingRef, accountName, form, setForm, errors, error, saving, onSubmit }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  accountName: string;
  form: typeof emptyTransactionForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyTransactionForm>>;
  errors: Record<string, string>;
  error: string | null;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return <form onSubmit={onSubmit} noValidate>
    <p className="text-sm font-bold text-emerald-700">Transaksi pertama</p>
    <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-bold tracking-[-0.04em] outline-none sm:text-4xl">Catat satu aktivitas nyata.</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">Transaksi ini langsung masuk ke <strong className="font-semibold text-slate-700">{accountName}</strong> dan membentuk ringkasan pertamamu.</p>
    <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" aria-label="Jenis transaksi">
      {(["expense", "income"] as const).map((type) => <button key={type} type="button" aria-pressed={form.type === type} onClick={() => setForm((current) => ({ ...current, type, category: type === "income" ? "Pemasukan lainnya" : "Lainnya" }))} className={cn("min-h-11 rounded-lg px-3 text-sm font-bold transition", form.type === type ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500")}>{type === "expense" ? "Pengeluaran" : "Pemasukan"}</button>)}
    </div>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <Field label="Nominal" htmlFor="onboarding-amount" error={errors.amount}><input id="onboarding-amount" autoFocus type="number" inputMode="decimal" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" className={fieldControlStyles} /></Field>
      <Field label={form.type === "income" ? "Sumber pemasukan" : "Merchant atau tujuan"} htmlFor="onboarding-merchant" error={errors.merchant}><input id="onboarding-merchant" value={form.merchant} onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))} placeholder={form.type === "income" ? "Contoh: Gaji" : "Contoh: Supermarket"} className={fieldControlStyles} /></Field>
      <Field label="Tanggal" htmlFor="onboarding-date" error={errors.date}><input id="onboarding-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className={fieldControlStyles} /></Field>
      <Field label="Kategori" htmlFor="onboarding-category" error={errors.category}><input id="onboarding-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={fieldControlStyles} /></Field>
      <Field className="sm:col-span-2" label="Catatan (opsional)" htmlFor="onboarding-note"><textarea id="onboarding-note" rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Tambahkan konteks bila perlu" className={fieldControlStyles} /></Field>
    </div>
    <FormMessage message={error} />
    <div className="mt-7 flex justify-end"><Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan transaksi...</> : <>Simpan transaksi <ArrowRight className="h-4 w-4" /></>}</Button></div>
  </form>;
}

function SummaryStep({ headingRef, summary, transaction, onFinish }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  summary: ReturnType<typeof buildOnboardingSummary> | null;
  transaction: SavedTransaction | null;
  onFinish: () => void;
}) {
  if (!summary || !transaction) return <div className="flex min-h-80 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /><span className="sr-only">Memuat ringkasan pertama</span></div>;
  return <>
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></span>
    <p className="mt-6 text-sm font-bold text-emerald-700">Ringkasan pertama siap</p>
    <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-bold tracking-[-0.04em] outline-none sm:text-4xl">Sekarang angkamu punya konteks.</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">Akun dan transaksi pertamamu sudah tersimpan aman. Dashboard akan memakai data nyata ini.</p>
    <dl className="mt-8 divide-y divide-slate-100 border-y border-slate-100">
      <SummaryRow icon={Landmark} label="Akun" value={summary.accountName} />
      <SummaryRow icon={ReceiptText} label={transaction.type === "income" ? "Pemasukan" : "Pengeluaran"} value={`${transaction.type === "income" ? "+" : "−"}${formatMoney(Math.abs(summary.cashFlowImpact), summary.currency)}`} />
      <SummaryRow icon={WalletCards} label="Saldo saat ini" value={formatMoney(summary.currentBalance, summary.currency)} emphasized />
    </dl>
    <Button className="mt-8 w-full sm:w-auto" onClick={onFinish}>Buka dashboard <ArrowRight className="h-4 w-4" /></Button>
  </>;
}

function ProgressItem({ label, complete, active }: { label: string; complete: boolean; active: boolean }) {
  return <li className={cn("flex items-center gap-3 text-sm font-semibold", active ? "text-slate-900" : complete ? "text-emerald-700" : "text-slate-400")}><span className={cn("flex h-7 w-7 items-center justify-center rounded-full border text-xs", complete ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-emerald-600 bg-white text-emerald-700" : "border-slate-200 bg-white")}>{complete ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>{label}</li>;
}

function SummaryRow({ icon: Icon, label, value, emphasized = false }: { icon: typeof Landmark; label: string; value: string; emphasized?: boolean }) {
  return <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 py-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span><div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className={cn("mt-1 font-bold", emphasized ? "text-xl text-emerald-800" : "text-sm text-slate-800")}>{value}</dd></div></div>;
}

function FormMessage({ message }: { message: string | null }) {
  return <div aria-live="polite" aria-atomic="true">{message && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{message}</p>}</div>;
}
