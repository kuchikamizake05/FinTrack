"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChartNoAxesCombined,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { getMagicLinkErrorMessage, MAGIC_LINK_SUCCESS_MESSAGE } from "@/lib/login";
import { sanitizeNextPath } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/infrastructure/supabase/browser-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session) return;
      const destination = sanitizeNextPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(destination);
    });
    return () => { active = false; };
  }, [router]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !isSupabaseConfigured) return;

    setLoading(true);
    setMessage(null);

    try {
      const destination = sanitizeNextPath(new URLSearchParams(window.location.search).get("next"));
      const redirectToUrl = `${window.location.origin}${destination}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectToUrl },
      });

      if (error) throw error;
      setMessage({ type: "success", text: MAGIC_LINK_SUCCESS_MESSAGE });
    } catch (error) {
      setMessage({ type: "error", text: getMagicLinkErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

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
          <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Keuangan pribadi, lebih jernih
          </p>
          <h1 id="login-benefit-title" className="max-w-xl text-5xl font-bold leading-[1.08] tracking-[-0.05em] text-slate-900 xl:text-[3.5rem]">
            Kembali ke angka yang benar-benar penting.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-500">
            Pantau arus kas, tinjau transaksi, dan jaga tujuan keuanganmu tetap bergerak—tanpa dashboard yang terasa ramai.
          </p>

          <div className="mt-10 grid max-w-xl gap-5 border-y border-emerald-100 py-7 sm:grid-cols-3">
            <Benefit icon={ChartNoAxesCombined} title="Arus kas jelas" description="Lihat ritme bulan ini dalam sekali pandang." />
            <Benefit icon={ReceiptText} title="Review cepat" description="Temukan transaksi yang perlu perhatian." />
            <Benefit icon={LockKeyhole} title="Akses privat" description="Masuk tanpa perlu mengingat kata sandi." />
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_18px_55px_rgba(22,101,52,0.09)] sm:p-8" aria-labelledby="login-title">
          <div className="mb-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Akses aman
            </span>
            <h2 id="login-title" className="mt-5 text-3xl font-bold tracking-[-0.035em] text-slate-900">
              Selamat datang kembali
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Masukkan email terdaftar. Kami akan mengirim tautan masuk yang aman.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {!isSupabaseConfigured && (
              <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                Konfigurasi Supabase belum valid. Lengkapi <code className="font-bold">.env.local</code> sebelum masuk.
              </p>
            )}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                Alamat email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={loading}
                  aria-describedby="email-help"
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <p id="email-help" className="mt-2 text-xs leading-5 text-slate-400">Tidak perlu kata sandi.</p>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !isSupabaseConfigured}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(21,128,61,0.18)] transition hover:bg-emerald-800 active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {loading ? (
                <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Mengirim tautan...</>
              ) : (
                <>Kirim tautan masuk <ArrowRight className="h-4.5 w-4.5" /></>
              )}
            </button>
          </form>

          <div aria-live="polite" aria-atomic="true">
            {message && (
              <div className={`mt-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-6 ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}>
                {message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" /> : <Mail className="mt-0.5 h-4.5 w-4.5 shrink-0" />}
                <p>{message.text}</p>
              </div>
            )}
          </div>

          <div className="mt-7 flex items-start gap-3 border-t border-slate-100 pt-5">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-5 text-slate-500">
              Hanya email yang terdaftar sebagai admin yang dapat mengakses data keuangan ini.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Benefit({ icon: Icon, title, description }: {
  icon: typeof ChartNoAxesCombined;
  title: string;
  description: string;
}) {
  return (
    <div>
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-[0_2px_10px_rgba(22,101,52,0.08)]">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
