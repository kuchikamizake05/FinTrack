"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, FileUp, Goal, Loader2, PiggyBank, RefreshCw, Scale, Upload, WifiOff } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { reportHandledError } from "@/lib/errors";
import { buildBudgetProgress, buildFinancialAlerts, buildImportMatchPreview, buildReconciliation, buildReconciliationReviewSummary, getIdrBudgetScope, parseTransactionCsv, serializeTransactionsCsv, type ImportedTransaction } from "@/lib/financial-control";
import { buildEmergencyFundRunwayByCurrency } from "@/lib/finance";
import { calculateGoalProgress } from "@/lib/home";
import { getNetworkSnapshot, getServerNetworkSnapshot, offlineWriteMessage, subscribeToNetworkStatus } from "@/lib/pwa";
import { formatLocalDate, getPlanningDateContext } from "@/lib/planning";
import { supabase } from "@/infrastructure/supabase/browser-client";

type Account = { id: string; name: string; currency: string; current_balance: number; updated_at: string; is_active: boolean; kind: "bank" | "ewallet" | "investment" | "trading" | "liability" };
type Transaction = { id: string; date: string; type: "income" | "expense"; merchant: string | null; category: string; amount: number; note: string | null; status: "confirmed" | "pending_approval" | "needs_review" | "deleted"; account_id: string | null };
type Budget = { id: string; category: string; month: string; limit_amount: number };
type FinancialGoal = { id: string; name: string; target_amount: number; current_amount: number; currency: string; color: string | null; due_date: string | null; is_active: boolean };
type Recurring = { id: string; merchant: string; category: string; amount: number; type: "income" | "expense"; interval: "weekly" | "monthly" | "yearly"; next_run_date: string; is_active: boolean; account_id: string };
type Reconciliation = { id: string; account_id: string; statement_balance: number; ledger_balance: number; reconciled_at: string; note: string | null };
type SavingAction = "budget" | "goal" | "recurring" | "reconcile" | "import" | `run:${string}` | `pause:${string}` | `delete:${string}` | null;

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function PlanningPage() {
  const { t } = useLanguage();
  const [dateContext, setDateContext] = useState(() => getPlanningDateContext(new Date()));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [goalForm, setGoalForm] = useState({ name: "", targetAmount: "", currentAmount: "0", currency: "IDR", dueDate: "" });
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<SavingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState({ category: "", month: "", limitAmount: "" });
  const [recurringForm, setRecurringForm] = useState<{ accountId: string; merchant: string; category: string; amount: string; type: "income" | "expense"; interval: "weekly" | "monthly" | "yearly"; nextRunDate: string }>({ accountId: "", merchant: "", category: "", amount: "", type: "expense", interval: "monthly", nextRunDate: "" });
  const [reconcileForm, setReconcileForm] = useState({ accountId: "", statementBalance: "", note: "" });
  const [importAccountId, setImportAccountId] = useState("");
  const [importPreview, setImportPreview] = useState<ImportedTransaction[] | null>(null);
  const [selectedImportRows, setSelectedImportRows] = useState<Set<number>>(() => new Set());
  const importRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = getPlanningDateContext(new Date());
      setDateContext(next);
      setBudgetForm((current) => current.month ? current : { ...current, month: next.month });
      setRecurringForm((current) => current.nextRunDate ? current : { ...current, nextRunDate: next.today });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        if (requestId === requestIdRef.current) setLoading(false);
        return;
      }
      const [accountsResult, txResult, budgetsResult, goalsResult, recurringResult, reconciliationsResult] = await Promise.all([
        supabase.from("financial_accounts").select("id,name,currency,current_balance,updated_at,is_active,kind").eq("user_id", user.id).order("is_active", { ascending: false }).order("name"),
        supabase.from("transactions").select("id,date,type,merchant,category,amount,note,status,account_id").eq("user_id", user.id).gte("date", dateContext.month).lt("date", dateContext.nextMonth).order("date", { ascending: false }),
        supabase.from("financial_budgets").select("id,category,month,limit_amount").eq("user_id", user.id).eq("month", dateContext.month),
        supabase.from("financial_goals").select("id,name,target_amount,current_amount,currency,color,due_date,is_active").eq("user_id", user.id).eq("is_active", true).order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("recurring_transactions").select("id,merchant,category,amount,type,interval,next_run_date,is_active,account_id").eq("user_id", user.id).order("is_active", { ascending: false }).order("next_run_date"),
        supabase.from("account_reconciliations").select("id,account_id,statement_balance,ledger_balance,reconciled_at,note").eq("user_id", user.id).order("reconciled_at", { ascending: false }).limit(12),
      ]);
      const error = accountsResult.error || txResult.error || budgetsResult.error || goalsResult.error || recurringResult.error || reconciliationsResult.error;
      if (error) throw error;
      if (requestId !== requestIdRef.current) return;
      setAccounts((accountsResult.data ?? []) as Account[]);
      setTransactions((txResult.data ?? []) as Transaction[]);
      setBudgets((budgetsResult.data ?? []) as Budget[]);
      setGoals((goalsResult.data ?? []) as FinancialGoal[]);
      setRecurring((recurringResult.data ?? []) as Recurring[]);
      setReconciliations((reconciliationsResult.data ?? []) as Reconciliation[]);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      reportHandledError("Planning data unavailable", error, "Data planning belum berhasil dimuat. Coba lagi saat koneksi tersedia.");
      setLoadError(t("Data planning belum berhasil dimuat. Coba lagi saat koneksi tersedia."));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [dateContext.month, dateContext.nextMonth, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [load]);

  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);
  const accountCurrencies = useMemo(() => new Map(accounts.map((account) => [account.id, account.currency])), [accounts]);
  const idrBudgetScope = useMemo(() => getIdrBudgetScope(transactions, accountCurrencies), [accountCurrencies, transactions]);
  const alerts = useMemo(() => buildFinancialAlerts({ budgets: budgets.map((b) => ({ category: b.category, limitAmount: Number(b.limit_amount), month: b.month.slice(0, 7) })), transactions: idrBudgetScope.idrTransactions, accountFreshness: accounts.map((a) => ({ accountName: a.name, lastUpdatedAt: a.updated_at })), today: dateContext.today }), [accounts, budgets, idrBudgetScope.idrTransactions, dateContext.today]);
  const categories = useMemo(() => [...new Set(idrBudgetScope.idrTransactions.filter((tx) => tx.type === "expense").map((tx) => tx.category))], [idrBudgetScope.idrTransactions]);
  const runwayByCurrency = useMemo(() => buildEmergencyFundRunwayByCurrency(accounts, transactions), [accounts, transactions]);
  const importMatches = useMemo(() => importPreview ? buildImportMatchPreview(
    importPreview,
    transactions.filter((transaction) => transaction.account_id === importAccountId),
  ) : [], [importAccountId, importPreview, transactions]);
  const reconciliationReview = useMemo(() => reconcileForm.accountId
    ? buildReconciliationReviewSummary(transactions.filter((transaction) => transaction.account_id === reconcileForm.accountId))
    : null, [reconcileForm.accountId, transactions]);
  const writeDisabled = !online || saving !== null;
  const guardWrite = () => {
    if (online) return true;
    setMessage(offlineWriteMessage);
    return false;
  };

  async function saveBudget(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    setSaving("budget"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("financial_budgets").upsert({ user_id: user.id, category: budgetForm.category.trim(), month: `${budgetForm.month.slice(0, 7)}-01`, limit_amount: Number(budgetForm.limitAmount) }, { onConflict: "user_id,category,month" });
      if (error) throw error;
      setBudgetForm({ category: "", month: dateContext.month, limitAmount: "" }); setMessage(t("Budget tersimpan.")); await load();
    } catch (error) { reportHandledError("Planning budget save failed", error, "Budget belum tersimpan."); setMessage(t("Budget belum tersimpan. Inputmu tetap aman, coba lagi.")); }
    finally { setSaving(null); }
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    const targetAmount = Number(goalForm.targetAmount);
    const currentAmount = Number(goalForm.currentAmount);
    if (!goalForm.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(currentAmount) || currentAmount < 0 || !/^[A-Z]{3}$/.test(goalForm.currency)) {
      setMessage(t("Isi target keuangan dengan nominal dan mata uang yang valid."));
      return;
    }
    setSaving("goal"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("financial_goals").insert({
        user_id: user.id,
        name: goalForm.name.trim(),
        target_amount: targetAmount,
        current_amount: currentAmount,
        currency: goalForm.currency,
        due_date: goalForm.dueDate || null,
      });
      if (error) throw error;
      setGoalForm({ name: "", targetAmount: "", currentAmount: "0", currency: "IDR", dueDate: "" });
      setMessage(t("Target keuangan tersimpan.")); await load();
    } catch (error) { reportHandledError("Planning goal save failed", error, "Target keuangan belum tersimpan."); setMessage(t("Target keuangan belum tersimpan. Coba lagi.")); }
    finally { setSaving(null); }
  }

  async function archiveGoal(goal: FinancialGoal) {
    if (!guardWrite()) return;
    setSaving(`delete:${goal.id}`); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("financial_goals").update({ is_active: false }).eq("id", goal.id).eq("user_id", user.id);
      if (error) throw error;
      setMessage(t("Target diarsipkan.")); await load();
    } catch (error) { reportHandledError("Planning goal archive failed", error, "Target belum diarsipkan."); setMessage(t("Target belum diarsipkan. Coba lagi.")); }
    finally { setSaving(null); }
  }

  async function saveRecurring(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    setSaving("recurring"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const record = { account_id: recurringForm.accountId, merchant: recurringForm.merchant.trim(), category: recurringForm.category.trim(), amount: Number(recurringForm.amount), type: recurringForm.type, interval: recurringForm.interval, next_run_date: recurringForm.nextRunDate };
      const { error } = editingRecurringId
        ? await supabase.from("recurring_transactions").update(record).eq("id", editingRecurringId).eq("user_id", user.id)
        : await supabase.from("recurring_transactions").insert({ user_id: user.id, ...record });
      if (error) throw error;
      const wasEditing = Boolean(editingRecurringId);
      setEditingRecurringId(null); setRecurringForm({ accountId: "", merchant: "", category: "", amount: "", type: "expense", interval: "monthly", nextRunDate: dateContext.today }); setMessage(t(wasEditing ? "Jadwal transaksi diperbarui." : "Jadwal transaksi tersimpan.")); await load();
    } catch (error) { reportHandledError("Planning recurring save failed", error, "Jadwal transaksi belum tersimpan."); setMessage(t("Jadwal transaksi belum tersimpan. Inputmu tetap aman, coba lagi.")); }
    finally { setSaving(null); }
  }

  function editRecurring(rule: Recurring) {
    setEditingRecurringId(rule.id);
    setRecurringForm({ accountId: rule.account_id, merchant: rule.merchant, category: rule.category, amount: String(rule.amount), type: rule.type, interval: rule.interval, nextRunDate: rule.next_run_date });
  }

  async function setRecurringActive(rule: Recurring, isActive: boolean) {
    if (!guardWrite()) return;
    setSaving(`pause:${rule.id}`); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("recurring_transactions").update({ is_active: isActive }).eq("id", rule.id).eq("user_id", user.id);
      if (error) throw error;
      setMessage(t(isActive ? "Jadwal diaktifkan kembali." : "Jadwal dijeda. Transaksi lama tetap utuh.")); await load();
    } catch (error) { reportHandledError("Planning recurring state update failed", error, "Status jadwal belum diperbarui."); setMessage(t("Status jadwal belum diperbarui. Coba lagi.")); }
    finally { setSaving(null); }
  }

  async function deleteBudget() {
    if (!budgetToDelete || !guardWrite()) return;
    setSaving(`delete:${budgetToDelete.id}`); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("financial_budgets").delete().eq("id", budgetToDelete.id).eq("user_id", user.id);
      if (error) throw error;
      setBudgetToDelete(null); setMessage(t("Budget dihapus. Transaksi tetap utuh.")); await load();
    } catch (error) { reportHandledError("Planning budget delete failed", error, "Budget belum dihapus."); setMessage(t("Budget belum dihapus. Coba lagi.")); }
    finally { setSaving(null); }
  }

  async function reconcile(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    const account = accounts.find((item) => item.id === reconcileForm.accountId); if (!account) return;
    setSaving("reconcile"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("account_reconciliations").insert({ user_id: user.id, account_id: account.id, statement_balance: Number(reconcileForm.statementBalance), ledger_balance: Number(account.current_balance), reconciled_at: dateContext.today, note: reconcileForm.note.trim() || null });
      if (error) throw error;
      setReconcileForm({ accountId: "", statementBalance: "", note: "" }); setMessage(t("Rekonsiliasi tersimpan. Selisihnya tercatat untuk ditindaklanjuti.")); await load();
    } catch (error) { reportHandledError("Planning reconciliation failed", error, "Rekonsiliasi belum tersimpan."); setMessage(t("Rekonsiliasi belum tersimpan. Inputmu tetap aman, coba lagi.")); }
    finally { setSaving(null); }
  }

  async function runRecurring(ruleId: string) {
    if (!guardWrite()) return;
    setSaving(`run:${ruleId}`); setMessage(null);
    try {
      const { error } = await supabase.rpc("run_recurring_transaction", { rule_id: ruleId });
      if (error) throw error;
      setMessage(t("Transaksi berulang sudah masuk ke ledger dan jadwal berikutnya diperbarui.")); await load();
    } catch (error) { reportHandledError("Planning recurring run failed", error, "Jadwal belum dapat dijalankan. Pastikan tanggalnya sudah jatuh tempo."); setMessage(t("Jadwal belum dapat dijalankan. Pastikan tanggalnya sudah jatuh tempo.")); }
    finally { setSaving(null); }
  }

  function downloadCsv() {
    const blob = new Blob([serializeTransactionsCsv(transactions)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `fintrack-${formatLocalDate(new Date())}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function previewImportCsv(file: File) {
    if (!guardWrite()) return;
    if (!importAccountId) { setMessage(t("Pilih akun tujuan sebelum impor CSV.")); return; }
    try {
      const records = parseTransactionCsv(await file.text());
      setImportPreview(records);
      setSelectedImportRows(new Set(records.map((_, index) => index)));
      setMessage(null);
    } catch (error) { reportHandledError("Planning CSV preview failed", error, "CSV tidak dapat dibaca."); setMessage(t("CSV tidak dapat dibaca. Gunakan format ekspor FinTrack.")); }
  }

  async function confirmImportCsv() {
    if (!guardWrite() || !importPreview) return;
    const records = importPreview.filter((_, index) => selectedImportRows.has(index));
    if (!records.length) { setMessage(t("Pilih minimal satu transaksi untuk diimpor.")); return; }
    setSaving("import"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("transactions").insert(records.map((row) => ({ ...row, user_id: user.id, account_id: importAccountId, source: "manual", status: "needs_review" })));
      if (error) throw error;
      setImportPreview(null); setSelectedImportRows(new Set());
      setMessage(t("{count} transaksi diimpor sebagai Perlu ditinjau.", { count: records.length })); await load();
    } catch (error) { reportHandledError("Planning CSV import failed", error, "CSV tidak dapat diimpor."); setMessage(t("CSV tidak dapat diimpor. Coba lagi.")); }
    finally { setSaving(null); }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content max-w-6xl space-y-6 outline-none">
        <PageHeader
          eyebrow={t("Financial control")}
          title={t("Rencana & kontrol")}
          description={t("Atur budget, jadwal transaksi, cocokkan saldo, dan pindahkan data dengan aman.")}
          actions={<Button variant="secondary" onClick={downloadCsv}><Download className="h-4 w-4" /> {t("Ekspor CSV")}</Button>}
        />
        {!online && <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>{t("Mode offline.")}</strong> {offlineWriteMessage} {t("Ekspor CSV tetap tersedia di perangkat.")}</span></div>}
        {message && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}
        {loading ? <PlanningSkeleton /> : loadError ? <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{loadError}</span><Button variant="secondary" size="compact" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> {t("Coba lagi")}</Button></div> : <>
          {alerts.length > 0 && <Surface className="p-5"><h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 text-amber-600" /> {t("Perlu perhatian")}</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{alerts.map((alert, index) => <li key={`${alert.kind}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">{alert.message}</li>)}</ul></Surface>}
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface className="p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold"><PiggyBank className="h-5 w-5 text-emerald-700" /> {t("Budget kategori")}</h2>
              <form onSubmit={saveBudget} className="mt-4 grid gap-3 sm:grid-cols-3">
                <select aria-label={t("Kategori budget")} required value={budgetForm.category} onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })} className={fieldControlStyles}>
                  <option value="">{t("Kategori")}</option>
                  {categories.map((category) => <option key={category} value={category}>{t(category)}</option>)}
                </select>
                <input aria-label={t("Bulan budget")} required type="month" value={budgetForm.month.slice(0, 7)} onChange={(e) => setBudgetForm({ ...budgetForm, month: `${e.target.value}-01` })} className={fieldControlStyles} />
                <input aria-label={t("Batas budget dalam Rupiah")} required min="1" inputMode="numeric" type="number" placeholder={t("Batas IDR")} value={budgetForm.limitAmount} onChange={(e) => setBudgetForm({ ...budgetForm, limitAmount: e.target.value })} className={fieldControlStyles} />
                <Button disabled={writeDisabled} loading={saving === "budget"} className="sm:col-span-3">{t("Simpan budget")}</Button>
              </form>
              {idrBudgetScope.excludedExpenseCount > 0 && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("Budget hanya menghitung pengeluaran terkonfirmasi berakun IDR. {count} pengeluaran mata uang lain tidak dijumlahkan.", { count: idrBudgetScope.excludedExpenseCount })}</p>}
              <div className="mt-5 space-y-3">
                {budgets.map((budget) => {
                  const progress = buildBudgetProgress({ category: budget.category, limitAmount: Number(budget.limit_amount), month: budget.month.slice(0, 7) }, idrBudgetScope.idrTransactions);
                  return (
                    <div key={budget.id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold">{t(budget.category)}</span>
                        <span className="flex items-center gap-1 text-right">{idr.format(progress.spentAmount)} / {idr.format(progress.limitAmount)}<Button size="compact" variant="ghost" disabled={writeDisabled} onClick={() => setBudgetToDelete(budget)}>{t("Hapus")}</Button></span>
                      </div>
                      <div
                        className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label={t("Penggunaan budget {category}", { category: t(budget.category) })}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(progress.percentage, 100)}
                        aria-valuetext={t("{percentage}% terpakai, {spent} dari {limit}", { percentage: progress.percentage.toFixed(0), spent: idr.format(progress.spentAmount), limit: idr.format(progress.limitAmount) })}
                      >
                        <div className={progress.state === "over" ? "h-full bg-rose-500" : progress.state === "warning" ? "h-full bg-amber-500" : "h-full bg-emerald-500"} style={{ width: `${Math.min(progress.percentage, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Surface>
            <Surface className="p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock className="h-5 w-5 text-emerald-700" /> {t("Transaksi berulang")}</h2>
              <form onSubmit={saveRecurring} className="mt-4 grid gap-3 sm:grid-cols-2">
                <select aria-label={t("Akun transaksi berulang")} required value={recurringForm.accountId} onChange={(e) => setRecurringForm({ ...recurringForm, accountId: e.target.value })} className={fieldControlStyles}>
                  <option value="">{t("Akun")}</option>
                  {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input aria-label={t("Merchant atau nama transaksi berulang")} required placeholder={t("Merchant / nama")} value={recurringForm.merchant} onChange={(e) => setRecurringForm({ ...recurringForm, merchant: e.target.value })} className={fieldControlStyles} />
                <input aria-label={t("Kategori transaksi berulang")} required placeholder={t("Kategori")} value={recurringForm.category} onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })} className={fieldControlStyles} />
                <input aria-label={t("Nominal transaksi berulang")} required type="number" min="1" placeholder={t("Nominal")} value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} className={fieldControlStyles} />
                <select aria-label={t("Frekuensi transaksi berulang")} value={recurringForm.interval} onChange={(e) => setRecurringForm({ ...recurringForm, interval: e.target.value as Recurring["interval"] })} className={fieldControlStyles}>
                  <option value="weekly">{t("Mingguan")}</option>
                  <option value="monthly">{t("Bulanan")}</option>
                  <option value="yearly">{t("Tahunan")}</option>
                </select>
                <input aria-label={t("Tanggal transaksi berulang berikutnya")} required type="date" value={recurringForm.nextRunDate} onChange={(e) => setRecurringForm({ ...recurringForm, nextRunDate: e.target.value })} className={fieldControlStyles} />
                <div className="flex gap-2 sm:col-span-2">
                  {editingRecurringId && <Button variant="secondary" disabled={writeDisabled} onClick={() => { setEditingRecurringId(null); setRecurringForm({ accountId: "", merchant: "", category: "", amount: "", type: "expense", interval: "monthly", nextRunDate: dateContext.today }); }}>{t("Batal")}</Button>}
                  <Button type="submit" disabled={writeDisabled} loading={saving === "recurring"}>{t(editingRecurringId ? "Simpan perubahan" : "Tambah jadwal")}</Button>
                </div>
              </form>
              <div className="mt-5 space-y-2">
                {recurring.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-bold">{rule.merchant} · {t(rule.category)} {!rule.is_active && <span className="font-normal text-slate-500">· {t("Dijeda")}</span>}</span>
                    <span className="flex flex-wrap items-center justify-end gap-1 text-right">{rule.next_run_date} · {idr.format(Number(rule.amount))}<Button size="compact" variant="ghost" disabled={writeDisabled} onClick={() => editRecurring(rule)}>{t("Edit")}</Button><Button size="compact" variant="ghost" disabled={writeDisabled} loading={saving === `pause:${rule.id}`} onClick={() => void setRecurringActive(rule, !rule.is_active)}>{t(rule.is_active ? "Jeda" : "Aktifkan kembali")}</Button>{rule.is_active && <Button size="compact" variant="ghost" disabled={writeDisabled || rule.next_run_date > dateContext.today} loading={saving === `run:${rule.id}`} onClick={() => void runRecurring(rule.id)}>{t("Jalankan")}</Button>}</span>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface className="p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Goal className="h-5 w-5 text-emerald-700" /> {t("Target keuangan")}</h2>
              <form onSubmit={saveGoal} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input aria-label={t("Nama target keuangan")} required maxLength={120} placeholder={t("Contoh: Dana darurat")} value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} className={fieldControlStyles} />
                <input aria-label={t("Nominal target")} required min="1" inputMode="decimal" type="number" placeholder={t("Target")} value={goalForm.targetAmount} onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })} className={fieldControlStyles} />
                <input aria-label={t("Nominal terkumpul")} required min="0" inputMode="decimal" type="number" placeholder={t("Terkumpul")} value={goalForm.currentAmount} onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })} className={fieldControlStyles} />
                <input aria-label={t("Mata uang target")} required pattern="[A-Z]{3}" maxLength={3} placeholder="IDR" value={goalForm.currency} onChange={(e) => setGoalForm({ ...goalForm, currency: e.target.value.toUpperCase() })} className={fieldControlStyles} />
                <input aria-label={t("Target selesai")} type="date" value={goalForm.dueDate} onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} className={fieldControlStyles} />
                <Button disabled={writeDisabled} loading={saving === "goal"}>{t("Simpan target")}</Button>
              </form>
              <div className="mt-5 space-y-3">
                {goals.length === 0 ? <p className="text-sm text-slate-500">{t("Belum ada target aktif.")}</p> : goals.map((goal) => {
                  const progress = calculateGoalProgress(Number(goal.current_amount), Number(goal.target_amount));
                  return <div key={goal.id} className="rounded-xl bg-slate-50 px-3 py-3 text-sm"><div className="flex items-start justify-between gap-3"><span><strong>{goal.name}</strong><span className="block text-xs text-slate-500">{formatMoney(Number(goal.current_amount), goal.currency)} / {formatMoney(Number(goal.target_amount), goal.currency)}{goal.due_date ? ` · ${goal.due_date}` : ""}</span></span><Button size="compact" variant="ghost" disabled={writeDisabled} loading={saving === `delete:${goal.id}`} onClick={() => void archiveGoal(goal)}>{t("Arsipkan")}</Button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100" role="progressbar" aria-label={goal.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.percentage}%`, backgroundColor: goal.color ?? undefined }} /></div><p className="mt-1 text-xs text-slate-500">{progress.percentage}% · {t("Sisa")} {formatMoney(progress.remaining, goal.currency)}</p></div>;
                })}
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="font-bold">{t("Cadangan dana")}</h3><p className="mt-1 text-sm text-slate-500">{t("Saldo bank dan e-wallet dibanding pengeluaran terkonfirmasi bulan ini. Tidak ada konversi mata uang.")}</p><div className="mt-3 space-y-2 text-sm">{runwayByCurrency.length === 0 ? <p className="text-slate-500">{t("Belum ada saldo likuid aktif.")}</p> : runwayByCurrency.map((runway) => <p key={runway.currency} className="rounded-lg bg-slate-50 px-3 py-2"><strong>{runway.currency}</strong> · {runway.runwayMonths === null ? t("Belum ada pengeluaran terkonfirmasi untuk menghitung durasi.") : t("{months} bulan cadangan", { months: runway.runwayMonths.toFixed(1) })}</p>)}</div></div>
            </Surface>
            <Surface className="p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Scale className="h-5 w-5 text-emerald-700" /> {t("Rekonsiliasi saldo")}</h2>
              <form onSubmit={reconcile} className="mt-4 space-y-3">
                <select aria-label={t("Akun untuk rekonsiliasi saldo")} required value={reconcileForm.accountId} onChange={(e) => setReconcileForm({ ...reconcileForm, accountId: e.target.value })} className={fieldControlStyles}>
                  <option value="">{t("Pilih akun")}</option>
                  {activeAccounts.map((a) => <option key={a.id} value={a.id}>{t("{name} · catatan {balance}", { name: a.name, balance: formatMoney(Number(a.current_balance), a.currency) })}</option>)}
                </select>
                <Field label={t("Saldo menurut mutasi / statement")} htmlFor="statement-balance">
                  <input id="statement-balance" required type="number" value={reconcileForm.statementBalance} onChange={(e) => setReconcileForm({ ...reconcileForm, statementBalance: e.target.value })} className={fieldControlStyles} />
                </Field>
                <Field label={t("Catatan")} htmlFor="reconciliation-note">
                  <input id="reconciliation-note" maxLength={500} value={reconcileForm.note} onChange={(e) => setReconcileForm({ ...reconcileForm, note: e.target.value })} className={fieldControlStyles} />
                </Field>
                {reconcileForm.accountId && reconcileForm.statementBalance && (
                  <p className="text-sm text-slate-600">
                    {buildReconciliation({ expectedBalance: Number(accounts.find((a) => a.id === reconcileForm.accountId)?.current_balance), statementBalance: Number(reconcileForm.statementBalance) }).isMatched ? t("Saldo cocok.") : t("Ada selisih yang perlu dicek.")}
                  </p>
                )}
                {reconciliationReview && reconciliationReview.count > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("{count} transaksi review belum masuk saldo: pemasukan {income}, pengeluaran {expense}.", { count: reconciliationReview.count, income: formatMoney(reconciliationReview.incomeAmount, accounts.find((a) => a.id === reconcileForm.accountId)?.currency ?? "IDR"), expense: formatMoney(reconciliationReview.expenseAmount, accounts.find((a) => a.id === reconcileForm.accountId)?.currency ?? "IDR") })}</p>}
                <Button disabled={writeDisabled} loading={saving === "reconcile"}><CheckCircle2 className="h-4 w-4" /> {t("Simpan rekonsiliasi")}</Button>
              </form>
              {reconciliations.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="font-bold">{t("Riwayat rekonsiliasi")}</h3><ul className="mt-2 space-y-2 text-sm text-slate-600">{reconciliations.map((item) => { const account = accounts.find((candidate) => candidate.id === item.account_id); const money = (value: number) => formatMoney(Number(value), account?.currency ?? "IDR"); return <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold text-slate-800">{account?.name ?? t("Akun tidak tersedia")}</span> · {item.reconciled_at}<br />{t("Statement {statement}; ledger {ledger}; selisih {difference}", { statement: money(item.statement_balance), ledger: money(item.ledger_balance), difference: money(Number(item.statement_balance) - Number(item.ledger_balance)) })}{item.note && <><br />{item.note}</>}</li>; })}</ul></div>}
            </Surface>
            <Surface className="p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold"><FileUp className="h-5 w-5 text-emerald-700" /> {t("Impor CSV")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("Pilih CSV hasil ekspor FinTrack. Semua data masuk sebagai “Perlu ditinjau” agar aman.")}</p>
              <select aria-label={t("Akun tujuan impor CSV")} value={importAccountId} onChange={(e) => setImportAccountId(e.target.value)} className={`mt-4 w-full ${fieldControlStyles}`}>
                <option value="">{t("Akun tujuan")}</option>
                {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input ref={importRef} aria-label={t("Pilih file CSV untuk diimpor")} className="hidden" type="file" accept=".csv,text/csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void previewImportCsv(file); e.currentTarget.value = ""; }} />
              <Button variant="secondary" className="mt-3" disabled={writeDisabled} loading={saving === "import"} onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> {t("Pilih file CSV")}</Button>
              {importPreview && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3"><p className="text-sm font-bold">{t("Tinjau impor")}</p><p className="text-xs text-slate-500">{t("Duplikat dicocokkan dari tanggal, jenis, nominal, merchant, dan kategori. Pilih baris sebelum impor.")}</p><ul className="max-h-56 space-y-2 overflow-y-auto text-sm">{importMatches.map((item) => <li key={item.index} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2 py-2"><input aria-label={t("Impor transaksi {index}", { index: item.index + 1 })} type="checkbox" checked={selectedImportRows.has(item.index)} onChange={() => setSelectedImportRows((current) => { const next = new Set(current); if (next.has(item.index)) next.delete(item.index); else next.add(item.index); return next; })} /><span className="min-w-0 flex-1">{item.record.date} · {item.record.merchant || item.record.category} · {formatMoney(item.record.amount, accounts.find((account) => account.id === importAccountId)?.currency ?? "IDR")}{item.isDuplicate && <span className="ml-1 font-semibold text-amber-700">· {t(item.duplicateOfExisting ? "Kemungkinan sudah ada" : "Duplikat di file")}</span>}</span></li>)}</ul><div className="flex flex-wrap gap-2"><Button disabled={writeDisabled} loading={saving === "import"} onClick={() => void confirmImportCsv()}>{t("Impor {count} transaksi", { count: selectedImportRows.size })}</Button><Button variant="ghost" disabled={saving === "import"} onClick={() => { setImportPreview(null); setSelectedImportRows(new Set()); }}>{t("Batal")}</Button></div></div>}
            </Surface>
          </div>
          {!loading && accounts.length === 0 && <Surface><EmptyState icon={RefreshCw} title={t("Buat akun dulu")} description={t("Budget dan transaksi berulang membutuhkan akun tujuan untuk menjaga saldo tetap akurat.")} /></Surface>}
        </>}
      </main>
      {budgetToDelete && <ConfirmDialog titleId="delete-budget-title" descriptionId="delete-budget-description" title={t("Hapus budget {category}?", { category: t(budgetToDelete.category) })} description={t("Budget akan dihapus. Transaksi dan riwayat kategori tetap utuh.")} confirmLabel={t("Hapus budget")} cancelLabel={t("Batal")} onClose={() => setBudgetToDelete(null)} onConfirm={() => void deleteBudget()} loading={saving === `delete:${budgetToDelete.id}`} />}
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value);
}

function PlanningSkeleton() {
  const { t } = useLanguage();
  return <div className="grid animate-pulse gap-6 lg:grid-cols-2" aria-label={t("Memuat planning")}><div className="h-80 rounded-2xl border border-emerald-100 bg-white/80" /><div className="h-80 rounded-2xl border border-emerald-100 bg-white/80" /><div className="h-72 rounded-2xl border border-emerald-100 bg-white/80" /><div className="h-72 rounded-2xl border border-emerald-100 bg-white/80" /><span className="sr-only"><Loader2 className="h-4 w-4" /> {t("Memuat planning...")}</span></div>;
}
