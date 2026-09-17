"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
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
    <div className={`${styles.page} fixed inset-0 min-h-[100svh] w-dvw overflow-x-hidden overflow-y-auto bg-[url('/auth/fintrack-login-hero.png')] bg-[position:center_top] bg-cover bg-no-repeat text-[var(--brand-ink)] sm:bg-[radial-gradient(circle_at_9%_36%,rgba(255,255,255,0.42)_0_2px,transparent_2.5px),linear-gradient(145deg,#eefaf2_0%,#ddf5e6_55%,#c6edd3_100%)] sm:bg-[length:24px_24px,auto]`}>
      <header className="relative z-10 mx-auto flex h-[76px] w-[calc(100%-2rem)] max-w-[1440px] items-center justify-between sm:h-[72px] sm:w-[calc(100%-3rem)] sm:border-b sm:border-[color:rgba(18,53,36,0.14)]">
        <BrandLockup href="/" priority ariaLabel="FinTrack beranda" />
        <LanguageSwitcher compact className="sm:[&>svg]:block" />
      </header>

      <main id="main-content" tabIndex={-1} className={`${styles.main} mx-auto flex h-[calc(100svh-76px)] w-full items-start justify-center px-0 pb-0 pt-[148px] sm:min-h-[calc(100svh-72px)] sm:px-6 sm:pb-8 sm:pt-14 lg:items-center lg:py-8`}>
        <div className={`${styles.desktopShell} w-full lg:grid lg:max-w-[980px] lg:grid-cols-[0.82fr_1.18fr] lg:overflow-hidden lg:rounded-[30px] lg:bg-white lg:shadow-[0_30px_80px_rgba(18,53,36,0.18)] lg:ring-1 lg:ring-emerald-950/[0.08]`}>
          <aside className="relative hidden overflow-hidden bg-[url('/auth/fintrack-login-hero.png')] bg-cover bg-[position:center_top] lg:flex lg:min-h-[590px] lg:flex-col lg:justify-end lg:p-9">
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,39,25,0.02)_24%,rgba(8,39,25,0.88)_100%)]" />
            <div className="relative text-white">
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] backdrop-blur-sm">{t("Keuangan pribadi")}</span>
              <h1 className="mt-4 max-w-xs text-4xl font-black leading-[0.98] tracking-[-0.06em] !text-white">{t("Uangmu, lebih jelas.")}</h1>
              <p className="mt-4 max-w-[17rem] text-sm leading-6 text-white/80">{t("Catat, pahami, dan rencanakan keuanganmu dalam satu tempat yang privat.")}</p>
              <div className="mt-7 flex items-center gap-2 text-xs font-bold text-white/75"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_5px_rgba(110,231,183,0.15)]" />{t("Data tetap milikmu")}</div>
            </div>
          </aside>
        <section className={`${styles.card} min-h-[calc(100svh-224px)] w-dvw max-w-none rounded-t-[32px] bg-white px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-7 shadow-[0_-16px_42px_rgba(18,53,36,0.18)] sm:mx-auto sm:min-h-0 sm:w-full sm:max-w-[420px] sm:rounded-[28px] sm:border sm:border-white/85 sm:bg-white/[0.97] sm:p-6 sm:shadow-[0_24px_65px_rgba(18,53,36,0.14)] sm:ring-1 sm:ring-emerald-950/[0.06] sm:backdrop-blur-sm lg:max-w-none lg:rounded-none lg:border-0 lg:px-12 lg:py-10 lg:shadow-none lg:ring-0`} aria-labelledby="login-title">
          <div className={`${styles.cardHeader} mb-6 text-center sm:mb-5 sm:text-left`}>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-mint)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"><ShieldCheck className="h-3.5 w-3.5" /> {t("Akses aman")}</span>
            <h2 id="login-title" className={`${styles.cardTitle} mt-4 text-[30px] font-black leading-[1.06] tracking-[-0.055em] text-[var(--brand-ink)] sm:mt-3 sm:text-[30px]`}>{title}</h2>
            <p className="mt-2.5 text-[14px] leading-5 text-slate-500 sm:mt-2 sm:text-[13px]">{t(description)}</p>
          </div>

          <form onSubmit={isUpdate ? handlePasswordUpdate : handleCredentials} className="space-y-2">
            {!isSupabaseConfigured && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">Konfigurasi Supabase belum valid. Lengkapi <code className="font-bold">.env.local</code> sebelum masuk.</p>}

            {!isUpdate && <EmailField value={email} onChange={setEmail} disabled={busy} />}
            {mode !== "reset" && <PasswordField id="password" label="Kata sandi" value={password} onChange={setPassword} disabled={busy} autoComplete={mode === "login" ? "current-password" : "new-password"} onForgotPassword={mode === "login" ? () => changeMode("reset") : undefined} />}
            {(mode === "signup" || isUpdate) && <PasswordField id="password-confirmation" label="Konfirmasi kata sandi" value={confirmation} onChange={setConfirmation} disabled={busy} autoComplete="new-password" />}

            <button type="submit" disabled={busy || !isSupabaseConfigured || (!isUpdate && !email)} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-ink)] px-4 py-2.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(18,53,36,0.18)] transition hover:bg-[var(--brand-primary)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
              {busy && loading !== "oauth" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : isUpdate ? <KeyRound className="h-4.5 w-4.5" /> : null}
              {loading && loading !== "oauth" ? t("Memproses...") : isUpdate ? t("Simpan kata sandi baru") : mode === "reset" ? t("Kirim tautan pemulihan") : mode === "signup" ? t("Buat akun") : <><span>{t("Masuk ke FinTrack")}</span><ArrowRight className="h-4.5 w-4.5" /></>}
            </button>
          </form>

          {!isUpdate && mode !== "reset" && (
            <>
              <div className={`${styles.divider} my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400`}><span className="h-px flex-1 bg-slate-100" /><span>{t("atau lanjut dengan")}</span><span className="h-px flex-1 bg-slate-100" /></div>
              <button type="button" onClick={handleGoogle} disabled={busy || !isSupabaseConfigured} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-emerald-200 hover:bg-[var(--brand-mint)] disabled:cursor-not-allowed disabled:opacity-50">
                <GoogleMark /> {t(loading === "oauth" ? "Menghubungkan..." : mode === "signup" ? "Daftar dengan Google" : "Masuk dengan Google")}
              </button>
            </>
          )}

          {!isUpdate && mode !== "reset" && (
            <p className="mt-6 text-center text-xs text-slate-500">
              {t(mode === "signup" ? "Sudah punya akun?" : "Belum punya akun?")} {" "}
              <button type="button" onClick={() => changeMode(mode === "signup" ? "login" : "signup")} disabled={busy} className="font-extrabold text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                {t(mode === "signup" ? "Masuk" : "Daftar")}
              </button>
            </p>
          )}

          {(mode === "reset" || isUpdate) && <button type="button" onClick={() => changeMode("login")} disabled={busy} className="mt-3 min-h-10 w-full text-sm font-bold text-slate-500 hover:text-emerald-700">{t("Kembali ke halaman masuk")}</button>}

          <div aria-live="polite" aria-atomic="true">
            {message && <div role={message.type === "error" ? "alert" : "status"} className={`mt-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-6 ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" /> : <Mail className="mt-0.5 h-4.5 w-4.5 shrink-0" />}<p>{t(message.text)}</p></div>}
          </div>

          <div className={`${styles.privacyNote} mt-5 flex items-start gap-2.5 border-t border-slate-100 pt-4`}><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><p className="text-[11px] leading-[17px] text-slate-500">{t("Setiap akun hanya dapat mengakses data miliknya melalui kebijakan RLS.")}</p></div>
        </section>
        </div>
      </main>
    </div>
  );
}

const inputStyles = "min-h-12 w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-10 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function EmailField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { t } = useLanguage();
  return (
    <div>
      <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-700">{t("Alamat email")}</label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="nama@email.com" value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={`${inputStyles} pr-3.5`} />
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  autoComplete: "current-password" | "new-password";
  onForgotPassword?: () => void;
};

function PasswordField({ id, label, value, onChange, disabled, autoComplete, onForgotPassword }: PasswordFieldProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-bold text-slate-700">{t(label)}</label>
        {onForgotPassword && (
          <button type="button" onClick={onForgotPassword} disabled={disabled} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            {t("Lupa kata sandi?")}
          </button>
        )}
      </div>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={8} value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={`${inputStyles} pr-11`} />
        <button type="button" onClick={() => setVisible((current) => !current)} disabled={disabled} aria-label={t(visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi")} aria-pressed={visible} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z" /><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" /><path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6 12 6.01Z" /></svg>;
}
