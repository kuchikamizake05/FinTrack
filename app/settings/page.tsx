"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { 
  User, 
  Bot, 
  Database, 
  Settings as SettingsIcon, 
  LogOut, 
  Clipboard,
  Check
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        setUserId(user.id || null);
      } else {
        router.push("/login");
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const copyUserId = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#f7f8f8] flex flex-col pb-24 md:pb-6 font-sans antialiased">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f7f8f8]">
            Pengaturan
          </h1>
          <p className="text-xs text-[#8a8f98] mt-0.5">
            Konfigurasi profil akun Anda dan petunjuk koneksi bot Telegram
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Left Panel: Profile Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="linear-panel p-5 rounded flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                <User className="w-6 h-6 text-violet-400" />
              </div>

              <div className="space-y-0.5 w-full">
                <h4 className="font-bold text-white text-sm truncate">{userEmail || "Memuat..."}</h4>
                <p className="text-[9px] text-[#8a8f98] font-bold uppercase tracking-wider">Pemilik Akun</p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-900/30 text-rose-400 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 click-active"
              >
                <LogOut className="w-4 h-4" />
                Keluar Sesi
              </button>
            </div>

            {/* Quick config stats */}
            <div className="linear-panel p-4.5 rounded space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8a8f98] flex items-center gap-1.5 border-b border-neutral-900 pb-1.5">
                <SettingsIcon className="w-3.5 h-3.5 text-[#5e6ad2]" />
                Sistem FinTrack
              </h4>
              <div className="text-[11px] space-y-2 text-[#d0d6e0] font-medium">
                <div className="flex justify-between">
                  <span className="text-[#8a8f98]">Mata Uang:</span>
                  <span>IDR (Rupiah - Rp)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8a8f98]">Mode:</span>
                  <span className="text-emerald-400">Pribadi (Single User)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8a8f98]">Versi:</span>
                  <span>v1.0.0 (MVP)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Telegram Bot Integration Guide */}
          <div className="md:col-span-2 space-y-4">
            
            {/* User ID Card for n8n */}
            <div className="linear-panel p-5 rounded space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <Database className="w-4.5 h-4.5 text-[#5e6ad2]" />
                Kredensial Integrasi n8n
              </h3>
              
              <p className="text-xs text-[#8a8f98] leading-relaxed">
                Untuk menghubungkan bot Telegram di n8n dengan database Supabase, gunakan **Supabase User ID** Anda di bawah ini pada konfigurasi variabel lingkungan n8n Anda (`SUPABASE_USER_ID`).
              </p>

              <div className="space-y-1">
                <label className="text-[9px] text-[#8a8f98] font-bold ml-0.5 uppercase tracking-wider">Supabase User ID Anda</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={userId || "Memuat..."}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-[#050507] border border-[#202024] rounded text-neutral-300 text-xs font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={copyUserId}
                    disabled={!userId}
                    className="absolute right-2 top-2 p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step-by-Step Guide */}
            <div className="linear-panel p-5 rounded space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <Bot className="w-4.5 h-4.5 text-[#5e6ad2]" />
                Panduan Integrasi Bot Telegram
              </h3>

              <div className="space-y-4 text-xs leading-relaxed text-[#d0d6e0]">
                <div className="flex gap-3">
                  <div className="w-5.5 h-5.5 rounded bg-violet-600/10 border border-violet-500/25 flex items-center justify-center text-violet-400 font-bold shrink-0 text-xs">
                    1
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-white">Buat Bot Telegram di @BotFather</h5>
                    <p className="text-[#8a8f98]">
                      Cari user <span className="text-[#5e6ad2] font-semibold">@BotFather</span> di Telegram, ketik `/newbot`, ikuti petunjuknya, lalu salin **Telegram Bot Token** yang diberikan.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5.5 h-5.5 rounded bg-violet-600/10 border border-violet-500/25 flex items-center justify-center text-violet-400 font-bold shrink-0 text-xs">
                    2
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-white">Dapatkan Chat/User ID Telegram Anda</h5>
                    <p className="text-[#8a8f98]">
                      Cari user <span className="text-[#5e6ad2] font-semibold">@userinfobot</span> di Telegram, kirim pesan apa saja, lalu salin User ID Anda. User ID ini digunakan untuk whitelist agar orang lain tidak bisa memakai bot Anda.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5.5 h-5.5 rounded bg-violet-600/10 border border-violet-500/25 flex items-center justify-center text-violet-400 font-bold shrink-0 text-xs">
                    3
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-white">Konfigurasi Environment Variables di n8n</h5>
                    <p className="text-[#8a8f98]">
                      Pasang variabel berikut pada file `.env` di VPS/Docker n8n Anda atau di Credentials n8n:
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-1 font-mono text-[10px] text-violet-400">
                      <li>TELEGRAM_ALLOWED_USER_ID = (User ID Langkah 2)</li>
                      <li>GEMINI_API_KEY = (Kunci API gratis dari Google AI Studio)</li>
                      <li>SUPABASE_URL = (URL Proyek Supabase Anda)</li>
                      <li>SUPABASE_ANON_KEY = (Kunci Anon Supabase Anda)</li>
                      <li>SUPABASE_USER_ID = (User ID Langkah 1 di atas)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5.5 h-5.5 rounded bg-violet-600/10 border border-violet-500/25 flex items-center justify-center text-violet-400 font-bold shrink-0 text-xs">
                    4
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-white">Import Workflow & Aktifkan</h5>
                    <p className="text-[#8a8f98]">
                      Import file JSON di folder `n8n/` proyek Anda ke n8n. Hubungkan Telegram credential Anda di node pemicu, lalu aktifkan workflow. Sekarang bot Anda siap digunakan!
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
