"use client";

import { useState } from "react";
import { Fingerprint, LogOut, ShieldCheck } from "lucide-react";
import BrandLockup from "@/components/BrandLockup";
import { Button } from "@/components/ui/Button";
import { getPasskeyErrorMessage } from "@/lib/passkeys";
import { supabase } from "@/infrastructure/supabase/browser-client";

type PasskeyUnlockScreenProps = {
  emailHint: string;
  userId: string;
  onUnlock: () => void;
  onUseNormalLogin: () => Promise<void>;
};

export default function PasskeyUnlockScreen({ emailHint, userId, onUnlock, onUseNormalLogin }: PasskeyUnlockScreenProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock() {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      if (!data.session || data.session.user.id !== userId) {
        await onUseNormalLogin();
        return;
      }
      onUnlock();
    } catch (error) {
      setError(getPasskeyErrorMessage(error));
    } finally {
      setChecking(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(145deg,#e9f8ee_0%,#dff5e7_55%,#c8efd5_100%)] px-4 py-8 outline-none">
      <section aria-labelledby="passkey-unlock-title" className="w-full max-w-sm rounded-3xl border border-emerald-900/15 bg-white/95 p-6 text-center shadow-[0_24px_70px_rgba(18,53,36,0.16)] sm:p-8">
        <div className="flex justify-center"><BrandLockup href="/" priority compact ariaLabel="FinTrack" /></div>
        <span className="mx-auto mt-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 shadow-inner"><Fingerprint className="h-10 w-10" aria-hidden="true" /></span>
        <span className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Perangkat dikenal</span>
        <h1 id="passkey-unlock-title" className="mt-4 text-2xl font-black tracking-tight text-[var(--brand-ink)]">Buka FinTrack</h1>
        <p className="mt-2 text-sm text-slate-500">{emailHint}</p>
        <p className="mt-5 text-sm leading-6 text-slate-600">Gunakan metode keamanan perangkatmu. Sistem memilih biometrik atau PIN perangkat secara otomatis.</p>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-5 text-rose-700">{error}</p>}
        <Button className="mt-6 w-full" loading={checking} onClick={() => void unlock()}><Fingerprint className="h-4 w-4" /> Buka dengan Passkey</Button>
        <button type="button" disabled={checking} onClick={() => void onUseNormalLogin()} className="mt-3 min-h-11 w-full text-sm font-bold text-slate-600 hover:text-emerald-700 disabled:opacity-60">Gunakan login biasa</button>
        <button type="button" disabled={checking} onClick={() => void onUseNormalLogin()} className="mt-1 inline-flex min-h-10 items-center gap-2 text-xs font-bold text-slate-500 hover:text-rose-700 disabled:opacity-60"><LogOut className="h-3.5 w-3.5" /> Ganti akun</button>
      </section>
    </main>
  );
}
