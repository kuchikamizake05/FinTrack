"use client";

import { useState } from "react";
import { Fingerprint, LogOut, ShieldCheck } from "lucide-react";
import BrandLockup from "@/components/BrandLockup";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getPasskeyErrorMessage } from "@/lib/passkeys";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/infrastructure/supabase/browser-client";
import styles from "@/app/login/login.module.css";

type PasskeyUnlockScreenProps = {
  emailHint: string;
  userId: string;
  onUnlock: () => void;
  onUseNormalLogin: () => Promise<void>;
};

export default function PasskeyUnlockScreen({ emailHint, userId, onUnlock, onUseNormalLogin }: PasskeyUnlockScreenProps) {
  const { t } = useLanguage();
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
    <div className={`${styles.page} fixed inset-0 min-h-[100svh] w-dvw overflow-x-hidden overflow-y-auto bg-[url('/auth/fintrack-login-hero.png')] bg-[position:center_top] bg-cover bg-no-repeat text-[var(--brand-ink)] sm:bg-[radial-gradient(circle_at_9%_36%,rgba(255,255,255,0.42)_0_2px,transparent_2.5px),linear-gradient(145deg,#eefaf2_0%,#ddf5e6_55%,#c6edd3_100%)] sm:bg-[length:24px_24px,auto]`}>
      <header className="relative z-10 mx-auto flex h-[76px] w-[calc(100%-2rem)] max-w-[1440px] items-center justify-between sm:h-[72px] sm:w-[calc(100%-3rem)] sm:border-b sm:border-[color:rgba(18,53,36,0.14)]"><BrandLockup href="/" priority ariaLabel="FinTrack" /><LanguageSwitcher compact className="sm:[&>svg]:block" /></header>
      <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-[calc(100svh-76px)] w-full items-start justify-center px-0 pb-0 pt-[148px] outline-none sm:min-h-[calc(100svh-72px)] sm:px-6 sm:pb-8 sm:pt-14 lg:items-center lg:py-8">
        <div className={`${styles.desktopShell} w-full lg:grid lg:max-w-[980px] lg:grid-cols-[0.82fr_1.18fr] lg:overflow-hidden lg:rounded-[30px] lg:bg-white lg:shadow-[0_30px_80px_rgba(18,53,36,0.18)] lg:ring-1 lg:ring-emerald-950/[0.08]`}>
          <aside className="relative hidden overflow-hidden bg-[url('/auth/fintrack-login-hero.png')] bg-cover bg-[position:center_top] lg:flex lg:min-h-[590px] lg:flex-col lg:justify-end lg:p-9"><div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,39,25,0.02)_24%,rgba(8,39,25,0.88)_100%)]" /><div className="relative text-white"><span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] backdrop-blur-sm">{t("Keuangan pribadi")}</span><h1 className="mt-4 max-w-xs text-4xl font-black leading-[0.98] tracking-[-0.06em] !text-white">{t("Uangmu, lebih jelas.")}</h1><p className="mt-4 max-w-[17rem] text-sm leading-6 text-white/80">{t("Catat, pahami, dan rencanakan keuanganmu dalam satu tempat yang privat.")}</p><div className="mt-7 flex items-center gap-2 text-xs font-bold text-white/75"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_5px_rgba(110,231,183,0.15)]" />{t("Data tetap milikmu")}</div></div></aside>
          <section aria-labelledby="passkey-unlock-title" className="min-h-[calc(100svh-148px)] w-dvw max-w-none rounded-t-[32px] bg-white px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-7 text-center shadow-[0_-16px_42px_rgba(18,53,36,0.18)] sm:mx-auto sm:min-h-0 sm:w-full sm:max-w-[420px] sm:rounded-[28px] sm:border sm:border-white/85 sm:bg-white/[0.97] sm:p-8 sm:shadow-[0_24px_65px_rgba(18,53,36,0.14)] sm:ring-1 sm:ring-emerald-950/[0.06] lg:max-w-none lg:rounded-none lg:border-0 lg:px-12 lg:py-10 lg:text-left lg:shadow-none lg:ring-0">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-inner lg:mx-0"><Fingerprint className="h-8 w-8" aria-hidden="true" /></span>
            <span className="mx-auto mt-5 flex w-fit items-center gap-1.5 rounded-full bg-[var(--brand-mint)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] lg:mx-0"><ShieldCheck className="h-3.5 w-3.5" /> {t("Perangkat dikenal")}</span>
            <h2 id="passkey-unlock-title" className="mt-4 text-[30px] font-black leading-[1.06] tracking-[-0.055em] text-[var(--brand-ink)]">{t("Buka FinTrack")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t("Gunakan sidik jari, wajah, atau kunci layar perangkatmu.")}</p>
            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{emailHint}</p>
            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-5 text-rose-700">{error}</p>}
            <Button className="mt-6 w-full" loading={checking} onClick={() => void unlock()}><Fingerprint className="h-4 w-4" /> {t("Buka dengan Passkey")}</Button>
            <button type="button" disabled={checking} onClick={() => void onUseNormalLogin()} className="mt-3 min-h-11 w-full text-sm font-bold text-slate-600 hover:text-emerald-700 disabled:opacity-60">{t("Gunakan login biasa")}</button>
            <div className="mt-5 border-t border-slate-100 pt-4"><button type="button" disabled={checking} onClick={() => void onUseNormalLogin()} className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-slate-500 hover:text-rose-700 disabled:opacity-60"><LogOut className="h-3.5 w-3.5" /> {t("Ganti akun")}</button></div>
          </section>
        </div>
      </main>
    </div>
  );
}
