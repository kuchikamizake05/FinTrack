"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import BrandLogo from "@/components/BrandLogo";
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

type Feedback = { type: "success" | "error"; text: string };

function getLocationState() {
  const params = new URLSearchParams(window.location.search);
  return {
    destination: sanitizeNextPath(params.get("next")),
    updatePassword: params.get("mode") === "update-password",
  };
}

export default function LoginPage() {
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
  const title = isUpdate ? "Buat kata sandi baru" : mode === "reset" ? "Pulihkan kata sandi" : mode === "signup" ? "Buat akun FinTrack" : "Selamat datang kembali";
  const description = isUpdate
    ? "Gunakan minimal 8 karakter untuk melindungi akunmu."
    : mode === "reset"
      ? "Kami akan mengirim tautan pemulihan ke emailmu."
      : mode === "signup"
        ? "Daftar dengan email atau gunakan akun Google."
        : "Masuk menggunakan email dan kata sandi atau akun Google.";

  return (
    <div className="min-h-[100svh] bg-[#f3faf5] text-slate-900">
      <header className="mx-auto flex w-full max-w-7xl items-center px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl pr-3 font-bold tracking-tight text-slate-900 focus-visible:outline-offset-4">
          <BrandLogo size={40} priority />
          <span className="text-xl">FinTrack</span>
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-10 pt-4 sm:px-8 lg:min-h-[calc(100svh-96px)] lg:grid-cols-[minmax(0,1fr)_460px] lg:px-10 lg:pb-20 lg:pt-6">
        <section className="hidden max-w-2xl lg:block" aria-labelledby="login-benefit-title">
          <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><ShieldCheck className="h-4 w-4" /> Keuangan pribadi, lebih jernih</p>
          <h1 id="login-benefit-title" className="max-w-xl text-5xl font-bold leading-[1.08] tracking-[-0.05em] text-slate-900 xl:text-[3.5rem]">Kembali ke angka yang benar-benar penting.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-500">Pantau arus kas, tinjau transaksi, dan jaga tujuan keuanganmu tetap bergerak—tanpa dashboard yang terasa ramai.</p>
          <div className="mt-10 grid max-w-xl gap-5 border-y border-emerald-100 py-7 sm:grid-cols-3">
            <Benefit icon={ChartNoAxesCombined} title="Arus kas jelas" description="Lihat ritme bulan ini dalam sekali pandang." />
            <Benefit icon={ReceiptText} title="Review cepat" description="Temukan transaksi yang perlu perhatian." />
            <Benefit icon={LockKeyhole} title="Akses privat" description="Email/password dan Google, dilindungi Supabase Auth." />
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_18px_55px_rgba(22,101,52,0.09)] sm:p-8" aria-labelledby="login-title">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Akses aman</span>
            <h2 id="login-title" className="mt-5 text-3xl font-bold tracking-[-0.035em] text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>

          {!isUpdate && mode !== "reset" && (
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label="Pilih mode autentikasi">
              {(["login", "signup"] as const).map((item) => (
                <button key={item} type="button" onClick={() => changeMode(item)} disabled={busy} className={`min-h-10 rounded-lg px-3 text-sm font-bold transition ${mode === item ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500"}`}>
                  {item === "login" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>
          )}

          {!isUpdate && mode !== "reset" && (
            <>
              <button type="button" onClick={handleGoogle} disabled={busy || !isSupabaseConfigured} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                <GoogleMark /> {loading === "oauth" ? "Menghubungkan..." : "Masuk dengan Google"}
              </button>
              <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-400"><span className="h-px flex-1 bg-slate-100" /><span>atau dengan email</span><span className="h-px flex-1 bg-slate-100" /></div>
            </>
          )}

          <form onSubmit={isUpdate ? handlePasswordUpdate : handleCredentials} className="space-y-4">
            {!isSupabaseConfigured && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">Konfigurasi Supabase belum valid. Lengkapi <code className="font-bold">.env.local</code> sebelum masuk.</p>}

            {!isUpdate && <EmailField value={email} onChange={setEmail} disabled={busy} />}
            {mode !== "reset" && <PasswordField id="password" label="Kata sandi" value={password} onChange={setPassword} disabled={busy} autoComplete={mode === "login" ? "current-password" : "new-password"} />}
            {(mode === "signup" || isUpdate) && <PasswordField id="password-confirmation" label="Konfirmasi kata sandi" value={confirmation} onChange={setConfirmation} disabled={busy} autoComplete="new-password" />}

            {mode === "login" && <div className="text-right"><button type="button" onClick={() => changeMode("reset")} className="min-h-10 text-sm font-bold text-emerald-700 hover:text-emerald-800">Lupa kata sandi?</button></div>}

            <button type="submit" disabled={busy || !isSupabaseConfigured || (!isUpdate && !email)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(21,128,61,0.18)] transition hover:bg-emerald-800 active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
              {busy && loading !== "oauth" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : isUpdate ? <KeyRound className="h-4.5 w-4.5" /> : null}
              {loading && loading !== "oauth" ? "Memproses..." : isUpdate ? "Simpan kata sandi baru" : mode === "reset" ? "Kirim tautan pemulihan" : mode === "signup" ? "Buat akun" : <><span>Masuk ke FinTrack</span><ArrowRight className="h-4.5 w-4.5" /></>}
            </button>
          </form>

          {(mode === "reset" || isUpdate) && <button type="button" onClick={() => changeMode("login")} disabled={busy} className="mt-3 min-h-10 w-full text-sm font-bold text-slate-500 hover:text-emerald-700">Kembali ke halaman masuk</button>}

          <div aria-live="polite" aria-atomic="true">
            {message && <div role={message.type === "error" ? "alert" : "status"} className={`mt-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-6 ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" /> : <Mail className="mt-0.5 h-4.5 w-4.5 shrink-0" />}<p>{message.text}</p></div>}
          </div>

          <div className="mt-7 flex items-start gap-3 border-t border-slate-100 pt-5"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><p className="text-xs leading-5 text-slate-500">Setiap akun hanya dapat mengakses data miliknya melalui kebijakan RLS.</p></div>
        </section>
      </main>
    </div>
  );
}

const inputStyles = "min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function EmailField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Alamat email</label><div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" /><input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="nama@email.com" value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={inputStyles} /></div></div>;
}

function PasswordField({ id, label, value, onChange, disabled, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean; autoComplete: "current-password" | "new-password" }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700">{label}</label><div className="relative"><KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" /><input id={id} name={id} type="password" autoComplete={autoComplete} minLength={8} value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={inputStyles} /></div></div>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z" /><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" /><path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6 12 6.01Z" /></svg>;
}

function Benefit({ icon: Icon, title, description }: { icon: typeof ChartNoAxesCombined; title: string; description: string }) {
  return <div><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-[0_2px_10px_rgba(22,101,52,0.08)]"><Icon className="h-4.5 w-4.5" /></span><h2 className="text-sm font-bold text-slate-800">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>;
}
