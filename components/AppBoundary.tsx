"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, CloudOff, Database, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getAuthGateState, sanitizeNextPath } from "@/lib/auth";
import { getNetworkSnapshot, getServerNetworkSnapshot, subscribeToNetworkStatus } from "@/lib/pwa";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

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
    <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_48%,#f8faf9_100%)] px-6">
      <div className="text-center" role="status" aria-live="polite">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-700 shadow-[0_10px_30px_rgba(22,101,52,0.1)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <p className="mt-4 text-sm font-bold text-slate-800">Membuka ruang keuanganmu</p>
        <p className="mt-1 text-xs text-slate-500">Memeriksa sesi dengan aman.</p>
      </div>
    </main>
  );
}

export function ConfigurationRequired() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_55%,#f8faf9_100%)] px-4 py-10">
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
    <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_55%,#f8faf9_100%)] px-4 py-10">
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
