"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Loader2, Database, AlertCircle, Copy, Check } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const configured = isSupabaseConfigured;

  useEffect(() => {
    if (!configured) return;

    const checkUser = async () => {
      try {
        // Implement a timeout fallback of 5 seconds to prevent network hang
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );
        const { data } = await Promise.race([supabase.auth.getSession(), timeoutPromise]);
        const session = data.session;

        if (session) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      } catch (err) {
        console.error("Auth check failed or timed out:", err);
        router.replace("/login");
      }
    };

    checkUser();
  }, [configured, router]);

  const copyEnvTemplate = () => {
    const template = `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here`;
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Supabase is not configured
  if (!configured) {
    return (
      <div className="min-h-screen bg-[#030604] flex flex-col items-center justify-center p-6 text-[#f6f8f6] font-sans">
        <div className="max-w-md w-full bg-[#080d0a]/60 border border-[#202b24] rounded-xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          {/* Accent glow top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00c278]/50 to-transparent" />
          
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#00c278]/10 text-[#00c278] rounded-lg border border-[#00c278]/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">FinTrack Setup</h1>
              <p className="text-xs text-neutral-400">Konfigurasi database diperlukan</p>
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3 mb-6 text-amber-200 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              Berkas <code className="font-mono text-amber-300 bg-amber-950/40 px-1 rounded">.env.local</code> tidak ditemukan atau belum diisi dengan kredensial Supabase Anda di lokal.
            </div>
          </div>

          <h2 className="text-sm font-semibold mb-3 text-neutral-200">Cara Penyelesaian:</h2>
          <ol className="text-xs text-neutral-400 space-y-3 mb-6 list-decimal pl-4">
            <li>
              Buat berkas bernama <code className="font-mono text-[#00c278]">.env.local</code> di direktori utama proyek Anda (<code className="font-mono">FinTrack/</code>).
            </li>
            <li>
              Salin dan isi template konfigurasi di bawah ini dengan detail dari dasbor Supabase Anda (Settings &gt; API):
            </li>
          </ol>

          <div className="relative font-mono text-xs bg-[#030604] border border-[#202b24] rounded-lg p-4 mb-6">
            <button
              onClick={copyEnvTemplate}
              className="absolute top-2 right-2 p-1.5 rounded-md border border-[#202b24] bg-[#080d0a] hover:bg-[#101a14] hover:text-white transition-colors"
              title="Salin template"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00c278]" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
            </button>
            <div className="text-neutral-500">{`// .env.local template`}</div>
            <div className="text-[#00c278]">NEXT_PUBLIC_SUPABASE_URL<span className="text-neutral-400">=</span><span className="text-neutral-300">https://your-project.supabase.co</span></div>
            <div className="text-[#00c278]">NEXT_PUBLIC_SUPABASE_ANON_KEY<span className="text-neutral-400">=</span><span className="text-neutral-300">your-anon-key-here</span></div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-[#00c278] hover:bg-[#00a666] text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-[#00c278]/20 transition-all click-active flex items-center justify-center gap-2 cursor-pointer"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading State
  return (
    <div className="min-h-screen bg-[#030604] flex flex-col items-center justify-center text-[#f6f8f6] font-sans">
      <Loader2 className="w-8 h-8 animate-spin text-[#00c278]" />
      <span className="mt-4 text-sm font-medium text-neutral-400">Loading FinTrack...</span>
    </div>
  );
}
