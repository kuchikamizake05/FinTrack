"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, CloudOff, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getAuthGateState, sanitizeNextPath } from "@/lib/auth";
import { getNetworkSnapshot, getServerNetworkSnapshot, subscribeToNetworkStatus } from "@/lib/pwa";
import { isSupabaseConfigured, supabase } from "@/infrastructure/supabase/browser-client";

export default function AppBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);
  const [resolved, setResolved] = useState(!isSupabaseConfigured);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setResolved(true);
    }).catch(() => {
      if (!active) return;
      setHasSession(false);
      setResolved(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setResolved(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const gate = getAuthGateState({
    pathname,
    configured: isSupabaseConfigured,
    resolved,
    hasSession,
    online,
  });

  useEffect(() => {
    if (gate !== "redirect-login") return;
    const destination = sanitizeNextPath(`${pathname}${window.location.search}`);
    router.replace(`/login?next=${encodeURIComponent(destination)}`);
  }, [gate, pathname, router]);

  if (gate === "public" || gate === "authenticated") return children;
  if (gate === "configuration-error") return <ConfigurationRequired />;
  if (gate === "offline") return <OfflineRecovery />;
  return <ApplicationLoading />;
}

export function ApplicationLoading() {
  return (
    <div className="min-h-[100svh] overflow-hidden bg-[linear-gradient(180deg,#e9f8ee_0%,#f7fbf8_21rem,#f8faf9_100%)]">
      <div aria-hidden="true" className="sticky top-0 z-40 h-[74px] border-b border-emerald-900/[0.08] bg-[rgba(233,248,238,0.94)] px-4 md:h-[76px] md:px-6">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between">
          <div className="h-9 w-32 rounded-xl bg-emerald-900/10 animate-pulse motion-reduce:animate-none md:w-40" />
          <div className="flex items-center gap-3">
            <div className="hidden h-9 w-72 rounded-xl bg-emerald-900/[0.07] animate-pulse motion-reduce:animate-none md:block" />
            <div className="h-10 w-10 rounded-full bg-emerald-900/10 animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      </div>

      <main id="main-content" tabIndex={-1} role="status" aria-live="polite" aria-busy="true" className="mx-auto w-full max-w-7xl px-4 py-5 outline-none sm:px-6 sm:py-8 md:py-10">
        <span className="sr-only">Memuat aplikasi</span>
        <div aria-hidden="true" className="animate-pulse space-y-5 motion-reduce:animate-none sm:space-y-6">
          <div className="space-y-3">
            <div className="h-6 w-28 rounded-full bg-emerald-900/[0.08]" />
            <div className="h-9 w-52 rounded-xl bg-emerald-900/[0.14] sm:h-11 sm:w-72" />
            <div className="h-4 w-full max-w-md rounded-md bg-emerald-900/[0.07]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="h-28 rounded-2xl border border-emerald-100 bg-white/85 shadow-[0_10px_35px_rgba(22,101,52,0.05)]" />
            <div className="hidden h-28 rounded-2xl border border-emerald-100 bg-white/85 shadow-[0_10px_35px_rgba(22,101,52,0.05)] sm:block" />
            <div className="hidden h-28 rounded-2xl border border-emerald-100 bg-white/85 shadow-[0_10px_35px_rgba(22,101,52,0.05)] sm:block" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white/90 shadow-[0_10px_35px_rgba(22,101,52,0.05)]">
              <div className="h-36 bg-emerald-950/[0.09] sm:h-44" />
              <div className="space-y-3 p-5 sm:p-6">
                <div className="h-5 w-40 rounded-lg bg-emerald-900/[0.10]" />
                <div className="h-12 rounded-xl bg-slate-100/90" />
                <div className="h-12 rounded-xl bg-slate-100/90" />
              </div>
            </section>
            <aside className="hidden rounded-2xl border border-emerald-100 bg-white/90 p-6 shadow-[0_10px_35px_rgba(22,101,52,0.05)] lg:block">
              <div className="h-5 w-32 rounded-lg bg-emerald-900/[0.10]" />
              <div className="mt-5 space-y-4">
                <div className="h-16 rounded-xl bg-slate-100/90" />
                <div className="h-16 rounded-xl bg-slate-100/90" />
                <div className="h-16 rounded-xl bg-slate-100/90" />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export function ConfigurationRequired() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_55%,#f8faf9_100%)] px-4 py-10 outline-none">
      <section className="w-full max-w-lg rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Database className="h-6 w-6" /></span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Environment setup</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Supabase belum dikonfigurasi</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Tambahkan URL proyek dan anon key browser-safe ke <code className="font-bold text-slate-700">.env.local</code>. FinTrack menghentikan akses data sampai konfigurasi valid.</p>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700">
          <p>NEXT_PUBLIC_SUPABASE_URL=https://…</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=…</p>
        </div>
        <Button className="mt-5 w-full" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> Muat ulang konfigurasi</Button>
      </section>
    </main>
  );
}

function OfflineRecovery() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_55%,#f8faf9_100%)] px-4 py-10 outline-none">
      <section className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><CloudOff className="h-6 w-6" /></span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">Sesi belum tersedia offline</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sambungkan internet untuk memverifikasi sesi. Data privat tidak dibuka tanpa sesi lokal yang valid.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> Coba lagi</Button>
          <Link href="/offline" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"><AlertTriangle className="h-4 w-4" /> Bantuan offline</Link>
        </div>
      </section>
    </main>
  );
}
