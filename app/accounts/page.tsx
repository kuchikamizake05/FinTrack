"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { calculateNetWorth, type FinancialAccountKind } from "@/lib/ledger";
import { supabase } from "@/lib/supabase";
import { ArrowLeftRight, Building2, ChartNoAxesCombined, Landmark, Loader2, Plus, Smartphone, WalletCards, X } from "lucide-react";

type FinancialAccount = {
  id: string;
  name: string;
  institution: string | null;
  kind: FinancialAccountKind;
  currency: string;
  current_balance: number;
  is_active: boolean;
};

const accountKinds: Array<{ value: FinancialAccountKind; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "E-wallet" },
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

const emptyAccountForm = { name: "", institution: "", kind: "bank" as FinancialAccountKind, currency: "IDR", currentBalance: "0" };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [transferForm, setTransferForm] = useState({ sourceAccountId: "", destinationAccountId: "", amount: "", date: new Date().toISOString().slice(0, 10), kind: "transfer", note: "" });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: queryError } = await supabase
        .from("financial_accounts")
        .select("id, name, institution, kind, currency, current_balance, is_active")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (queryError) throw queryError;
      setAccounts((data ?? []) as FinancialAccount[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat akun. Jalankan migrasi Supabase terlebih dahulu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccounts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  const netWorth = useMemo(
    () => calculateNetWorth(accounts.map((account) => ({ id: account.id, kind: account.kind, balance: Number(account.current_balance), isActive: account.is_active }))),
    [accounts],
  );

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(accountForm.currentBalance);
    if (!accountForm.name.trim() || !Number.isFinite(amount)) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const { error: insertError } = await supabase.from("financial_accounts").insert({
        user_id: user.id,
        name: accountForm.name.trim(),
        institution: accountForm.institution.trim() || null,
        kind: accountForm.kind,
        currency: accountForm.currency.toUpperCase(),
        current_balance: amount,
      });
      if (insertError) throw insertError;
      setAccountModalOpen(false);
      setAccountForm(emptyAccountForm);
      await loadAccounts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan akun.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTransfer(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(transferForm.amount);
    if (!transferForm.sourceAccountId || !transferForm.destinationAccountId || transferForm.sourceAccountId === transferForm.destinationAccountId || !Number.isFinite(amount) || amount <= 0) {
      setError("Pilih dua akun berbeda dan masukkan nominal positif.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const { error: insertError } = await supabase.from("account_transfers").insert({
        user_id: user.id,
        source_account_id: transferForm.sourceAccountId,
        destination_account_id: transferForm.destinationAccountId,
        amount,
        date: transferForm.date,
        kind: transferForm.kind,
        note: transferForm.note.trim() || null,
      });
      if (insertError) throw insertError;
      setTransferModalOpen(false);
      setTransferForm({ sourceAccountId: "", destinationAccountId: "", amount: "", date: new Date().toISOString().slice(0, 10), kind: "transfer", note: "" });
      await loadAccounts();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "Gagal menyimpan transfer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] pb-24 text-[#f7f8f8] md:pb-6">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Financial operating system</p>
            <h1 className="mt-1 text-2xl font-semibold">Akun & Saldo</h1>
            <p className="mt-1 text-sm text-[#8a8f98]">Pantau kas, e-wallet, broker investasi, dan akun trading dari satu tempat.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTransferModalOpen(true)} disabled={accounts.length < 2} className="inline-flex items-center justify-center gap-2 rounded bg-[#1a1a1e] px-3 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">
              <ArrowLeftRight className="h-4 w-4" /> Transfer
            </button>
            <button onClick={() => setAccountModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500">
              <Plus className="h-4 w-4" /> Tambah akun
            </button>
          </div>
        </section>

        {error && <div className="rounded border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="linear-panel rounded-lg p-5 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98]">Net worth</p>
            <p className="mt-2 text-3xl font-bold font-mono">Rp{netWorth.toLocaleString("id-ID")}</p>
            <p className="mt-2 text-xs text-[#8a8f98]">Aset aktif dikurangi akun kewajiban.</p>
          </div>
          <div className="linear-panel rounded-lg p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98]">Akun aktif</p>
            <p className="mt-2 text-3xl font-bold font-mono">{accounts.filter((account) => account.is_active).length}</p>
            <p className="mt-2 text-xs text-[#8a8f98]">Bank, e-wallet, investasi, dan trading.</p>
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-violet-400" /></div>
        ) : accounts.length === 0 ? (
          <section className="linear-panel rounded-lg p-10 text-center">
            <WalletCards className="mx-auto h-10 w-10 text-violet-400" />
            <h2 className="mt-4 font-semibold">Mulai dari akun pertama</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#8a8f98]">Tambahkan Jago, BRI, Mandiri, Stockbit, HFM, atau Exness untuk membangun snapshot net worth kamu.</p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => {
              const Icon = kindIcon[account.kind];
              return <article key={account.id} className="linear-panel rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded bg-violet-600/10 p-2 text-violet-400"><Icon className="h-5 w-5" /></div>
                  <span className="rounded border border-neutral-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8a8f98]">{account.kind}</span>
                </div>
                <h2 className="mt-4 font-semibold text-white">{account.name}</h2>
                <p className="mt-1 text-xs text-[#8a8f98]">{account.institution || "Akun pribadi"}</p>
                <p className="mt-5 text-xl font-bold font-mono">{account.currency} {Number(account.current_balance).toLocaleString("id-ID")}</p>
              </article>;
            })}
          </section>
        )}
      </main>

      {accountModalOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
        <form onSubmit={saveAccount} className="linear-panel w-full max-w-md space-y-4 rounded-lg p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Tambah akun</h2><button type="button" onClick={() => setAccountModalOpen(false)}><X className="h-5 w-5" /></button></div>
          <input required value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} placeholder="Nama akun, mis. Jago Utama" className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" />
          <input value={accountForm.institution} onChange={(event) => setAccountForm({ ...accountForm, institution: event.target.value })} placeholder="Institusi, mis. Bank Jago" className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select value={accountForm.kind} onChange={(event) => setAccountForm({ ...accountForm, kind: event.target.value as FinancialAccountKind })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm">{accountKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select>
            <select value={accountForm.currency} onChange={(event) => setAccountForm({ ...accountForm, currency: event.target.value })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option>IDR</option><option>USD</option></select>
          </div>
          <input required type="number" step="0.01" value={accountForm.currentBalance} onChange={(event) => setAccountForm({ ...accountForm, currentBalance: event.target.value })} placeholder="Saldo awal" className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" />
          <button disabled={saving} className="w-full rounded bg-violet-600 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan akun"}</button>
        </form>
      </div>}

      {transferModalOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
        <form onSubmit={saveTransfer} className="linear-panel w-full max-w-md space-y-4 rounded-lg p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Transfer antar akun</h2><button type="button" onClick={() => setTransferModalOpen(false)}><X className="h-5 w-5" /></button></div>
          <select required value={transferForm.sourceAccountId} onChange={(event) => setTransferForm({ ...transferForm, sourceAccountId: event.target.value })} className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="">Dari akun...</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
          <select required value={transferForm.destinationAccountId} onChange={(event) => setTransferForm({ ...transferForm, destinationAccountId: event.target.value })} className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="">Ke akun...</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-3"><input required type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })} placeholder="Nominal" className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /><input required type="date" value={transferForm.date} onChange={(event) => setTransferForm({ ...transferForm, date: event.target.value })} className="rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" /></div>
          <select value={transferForm.kind} onChange={(event) => setTransferForm({ ...transferForm, kind: event.target.value })} className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm"><option value="transfer">Transfer biasa</option><option value="broker_deposit">Deposit ke broker</option><option value="broker_withdrawal">Withdraw dari broker</option></select>
          <input value={transferForm.note} onChange={(event) => setTransferForm({ ...transferForm, note: event.target.value })} placeholder="Catatan (opsional)" className="w-full rounded border border-neutral-800 bg-[#050507] px-3 py-2 text-sm" />
          <button disabled={saving} className="w-full rounded bg-violet-600 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan transfer"}</button>
        </form>
      </div>}
    </div>
  );
}
