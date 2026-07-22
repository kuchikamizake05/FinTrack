"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChartNoAxesCombined,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import BrandLockup from "@/components/BrandLockup";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { sanitizeNextPath } from "@/lib/auth";
import {
  AUTH_SUCCESS_MESSAGES,
  buildAuthRedirectUrl,
  getAuthErrorMessage,
  type AuthAction,
  type AuthMode,
  validatePassword,
} from "@/lib/login";
import { isSupabaseConfigured, supabase } from "@/infrastructure/supabase/browser-client";
import styles from "./login.module.css";

type Feedback = { type: "success" | "error"; text: string };

function getLocationState() {
  const params = new URLSearchParams(window.location.search);
  return {
    destination: sanitizeNextPath(params.get("next")),
    updatePassword: params.get("mode") === "update-password",
  };
}

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState<AuthAction | null>(null);
  const [message, setMessage] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const location = getLocationState();
    const oauthError = new URLSearchParams(window.location.hash.slice(1)).get("error_description");
    if (oauthError) {
      queueMicrotask(() => {
        if (active) setMessage({ type: "error", text: getAuthErrorMessage("oauth", new Error(oauthError)) });
      });
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (location.updatePassword) {
        setMode("update-password");
        return;
      }
      if (!data.session) return;
      router.replace(location.destination);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
        setMessage(null);
        return;
      }
      if (session && !getLocationState().updatePassword) router.replace(getLocationState().destination);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setConfirmation("");
    setMessage(null);
  };

  const handleCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured || !email) return;

    if (mode === "reset") {
      setLoading("reset");
      setMessage(null);
      try {
        const location = getLocationState();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: buildAuthRedirectUrl(window.location.origin, location.destination, "update-password"),
        });
        if (error) throw error;
        setMessage({ type: "success", text: AUTH_SUCCESS_MESSAGES.reset });
      } catch (error) {
        setMessage({ type: "error", text: getAuthErrorMessage("reset", error) });
      } finally {
        setLoading(null);
      }
      return;
    }

    const passwordError = validatePassword(password, mode === "signup" ? confirmation : undefined);
    if (passwordError) {
      setMessage({ type: "error", text: passwordError });
      return;
    }

    const action: AuthAction = mode === "signup" ? "signup" : "login";
    setLoading(action);
    setMessage(null);
    try {
      const location = getLocationState();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: buildAuthRedirectUrl(window.location.origin, location.destination) },
        });
        if (error) throw error;
        if (data.session) router.replace(location.destination);
        else setMessage({ type: "success", text: AUTH_SUCCESS_MESSAGES.signUp });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(location.destination);
      }
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(action, error) });
    } finally {
      setLoading(null);
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    const passwordError = validatePassword(password, confirmation);
    if (passwordError) {
      setMessage({ type: "error", text: passwordError });
      return;
    }

    setLoading("update-password");
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: "success", text: AUTH_SUCCESS_MESSAGES.passwordUpdated });
      router.replace(getLocationState().destination);
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage("update-password", error) });
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) return;
    setLoading("oauth");
    setMessage(null);
    try {
      const location = getLocationState();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: buildAuthRedirectUrl(window.location.origin, location.destination) },
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage("oauth", error) });
      setLoading(null);
    }
  };

  const busy = loading !== null;
  const isUpdate = mode === "update-password";
  const title = t(isUpdate ? "Buat kata sandi baru" : mode === "reset" ? "Pulihkan kata sandi" : mode === "signup" ? "Buat akun FinTrack" : "Selamat datang kembali");
  const description = isUpdate
    ? "Gunakan minimal 8 karakter untuk melindungi akunmu."
    : mode === "reset"
      ? "Kami akan mengirim tautan pemulihan ke emailmu."
      : mode === "signup"
        ? "Daftar dengan email atau gunakan akun Google."
        : "Masuk menggunakan email dan kata sandi atau akun Google.";

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[radial-gradient(circle_at_9%_36%,rgba(255,255,255,0.42)_0_2px,transparent_2.5px),linear-gradient(145deg,#e9f8ee_0%,#dff5e7_55%,#c8efd5_100%)] bg-[length:24px_24px,auto] text-[var(--brand-ink)]">
      <header className="mx-auto flex h-[68px] w-[calc(100%-2rem)] max-w-[1440px] items-center justify-between border-b border-[color:rgba(18,53,36,0.14)] sm:h-[72px] sm:w-[calc(100%-3rem)]">
        <BrandLockup href="/" priority ariaLabel="FinTrack beranda" />
        <LanguageSwitcher compact className="sm:[&>svg]:block" />
      </header>

      <main className={`${styles.main} mx-auto grid min-h-[calc(100svh-68px)] w-full max-w-7xl items-center gap-8 px-4 py-3 sm:min-h-[calc(100svh-72px)] sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14 lg:px-10 xl:gap-20`}>
        <section className="hidden max-w-2xl lg:block" aria-labelledby="login-benefit-title">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/70"><ShieldCheck className="h-4 w-4" /></span> {t("Keuangan pribadi, lebih jernih")}</p>
          <h1 id="login-benefit-title" className="max-w-2xl font-[family-name:var(--font-archivo-black)] text-[clamp(3.2rem,4.5vw,5.25rem)] font-normal uppercase leading-[0.9] tracking-[-0.07em] text-[var(--brand-ink)]">{t("Kembali ke angka yang benar-benar penting.")}</h1>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-[color:rgba(18,53,36,0.62)]">{t("Pantau arus kas, tinjau transaksi, dan jaga tujuan keuanganmu tetap bergerak—tanpa dashboard yang terasa ramai.")}</p>
          <div className="mt-6 grid max-w-xl gap-4 border-y border-[color:rgba(18,53,36,0.14)] py-5 sm:grid-cols-3">
            <Benefit icon={ChartNoAxesCombined} title="Arus kas jelas" description="Lihat ritme bulan ini dalam sekali pandang." />
            <Benefit icon={ReceiptText} title="Review cepat" description="Temukan transaksi yang perlu perhatian." />
            <Benefit icon={LockKeyhole} title="Akses privat" description="Email/password dan Google, dilindungi Supabase Auth." />
          </div>
        </section>

        <section className={`${styles.card} mx-auto w-full max-w-[420px] rounded-[24px] border border-[color:rgba(18,53,36,0.14)] bg-white/95 p-4 shadow-[0_24px_70px_rgba(18,53,36,0.12)] backdrop-blur-sm sm:p-6`} aria-labelledby="login-title">
          <div className={`${styles.cardHeader} mb-4`}>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-mint)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]"><ShieldCheck className="h-3.5 w-3.5" /> {t("Akses aman")}</span>
            <h2 id="login-title" className={`${styles.cardTitle} mt-3 text-2xl font-black tracking-[-0.045em] text-[var(--brand-ink)] sm:text-[28px]`}>{title}</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{t(description)}</p>
          </div>

          {!isUpdate && mode !== "reset" && (
            <div className={`${styles.modeTabs} mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1`} aria-label="Pilih mode autentikasi">
              {(["login", "signup"] as const).map((item) => (
                <button key={item} type="button" onClick={() => changeMode(item)} disabled={busy} className={`min-h-9 rounded-lg px-3 text-sm font-bold transition ${mode === item ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500"}`}>
                  {t(item === "login" ? "Masuk" : "Daftar")}
                </button>
              ))}
            </div>
          )}

          {!isUpdate && mode !== "reset" && (
            <>
              <button type="button" onClick={handleGoogle} disabled={busy || !isSupabaseConfigured} className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-[var(--brand-mint)] disabled:cursor-not-allowed disabled:opacity-50">
                <GoogleMark /> {t(loading === "oauth" ? "Menghubungkan..." : "Masuk dengan Google")}
              </button>
              <div className={`${styles.divider} my-3 flex items-center gap-3 text-[11px] font-bold text-slate-400`}><span className="h-px flex-1 bg-slate-100" /><span>{t("atau dengan email")}</span><span className="h-px flex-1 bg-slate-100" /></div>
            </>
          )}

          <form onSubmit={isUpdate ? handlePasswordUpdate : handleCredentials} className="space-y-2">
            {!isSupabaseConfigured && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">Konfigurasi Supabase belum valid. Lengkapi <code className="font-bold">.env.local</code> sebelum masuk.</p>}

            {!isUpdate && <EmailField value={email} onChange={setEmail} disabled={busy} />}
            {mode !== "reset" && <PasswordField id="password" label="Kata sandi" value={password} onChange={setPassword} disabled={busy} autoComplete={mode === "login" ? "current-password" : "new-password"} />}
            {(mode === "signup" || isUpdate) && <PasswordField id="password-confirmation" label="Konfirmasi kata sandi" value={confirmation} onChange={setConfirmation} disabled={busy} autoComplete="new-password" />}

            {mode === "login" && <div className="-mt-1 text-right"><button type="button" onClick={() => changeMode("reset")} className="min-h-8 text-xs font-bold text-emerald-700 hover:text-emerald-800">{t("Lupa kata sandi?")}</button></div>}

            <button type="submit" disabled={busy || !isSupabaseConfigured || (!isUpdate && !email)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-black text-white shadow-[0_8px_20px_rgba(21,128,61,0.18)] transition hover:bg-[var(--brand-ink)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
              {busy && loading !== "oauth" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : isUpdate ? <KeyRound className="h-4.5 w-4.5" /> : null}
              {loading && loading !== "oauth" ? t("Memproses...") : isUpdate ? t("Simpan kata sandi baru") : mode === "reset" ? t("Kirim tautan pemulihan") : mode === "signup" ? t("Buat akun") : <><span>{t("Masuk ke FinTrack")}</span><ArrowRight className="h-4.5 w-4.5" /></>}
            </button>
          </form>

          {(mode === "reset" || isUpdate) && <button type="button" onClick={() => changeMode("login")} disabled={busy} className="mt-3 min-h-10 w-full text-sm font-bold text-slate-500 hover:text-emerald-700">{t("Kembali ke halaman masuk")}</button>}

          <div aria-live="polite" aria-atomic="true">
            {message && <div role={message.type === "error" ? "alert" : "status"} className={`mt-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-6 ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" /> : <Mail className="mt-0.5 h-4.5 w-4.5 shrink-0" />}<p>{t(message.text)}</p></div>}
          </div>

          <div className={`${styles.privacyNote} mt-4 flex items-start gap-2.5 border-t border-slate-100 pt-3.5`}><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><p className="text-[11px] leading-[17px] text-slate-500">{t("Setiap akun hanya dapat mengakses data miliknya melalui kebijakan RLS.")}</p></div>
        </section>
      </main>
    </div>
  );
}

const inputStyles = "min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function EmailField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { t } = useLanguage();
  return <div><label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-700">{t("Alamat email")}</label><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="nama@email.com" value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={inputStyles} /></div></div>;
}

function PasswordField({ id, label, value, onChange, disabled, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean; autoComplete: "current-password" | "new-password" }) {
  const { t } = useLanguage();
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-bold text-slate-700">{t(label)}</label><div className="relative"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id={id} name={id} type="password" autoComplete={autoComplete} minLength={8} value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={inputStyles} /></div></div>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z" /><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" /><path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6 12 6.01Z" /></svg>;
}

function Benefit({ icon: Icon, title, description }: { icon: typeof ChartNoAxesCombined; title: string; description: string }) {
  const { t } = useLanguage();
  return <div><span className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--brand-primary)] shadow-[0_5px_18px_rgba(22,101,52,0.08)]"><Icon className="h-4.5 w-4.5" /></span><h2 className="text-sm font-black text-[var(--brand-ink)]">{t(title)}</h2><p className="mt-1 text-[11px] leading-[17px] text-[color:rgba(18,53,36,0.58)]">{t(description)}</p></div>;
}
