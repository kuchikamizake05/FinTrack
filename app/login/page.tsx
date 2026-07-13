"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, Loader2, Sparkles, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);

    try {
      const redirectToUrl = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "";
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectToUrl,
        },
      });

      if (error) throw error;

      setMessage({
        type: "success",
        text: "Tautan login (Magic Link) telah dikirim ke email Anda! Silakan periksa kotak masuk atau spam.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Terjadi kesalahan saat mengirim tautan login.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-[#020205]">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] h-[350px] rounded-full bg-emerald-600/10 blur-[100px] pointer-events-none" />

      {/* Main Glassmorphism Form Card */}
      <div className="w-full max-w-md p-8 rounded-2xl glass-card glow-primary relative z-10">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 mb-4 animate-pulse">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
            FinTrack
          </h1>
          <p className="text-sm text-neutral-400 mt-2 font-medium">
            Personal Finance Assistant
          </p>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">Selamat Datang</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Masukkan email Anda untuk menerima tautan masuk instan
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-semibold text-neutral-300 ml-1">
                Alamat Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d18] border border-neutral-800 rounded-xl text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-neutral-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:from-violet-700 active:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-violet-600/15 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer hover:shadow-violet-600/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  Mengirimkan Tautan...
                </>
              ) : (
                <>
                  <Sparkles className="w-4.5 h-4.5" />
                  Kirim Magic Link
                </>
              )}
            </button>
          </form>

          {message && (
            <div
              className={`p-4 rounded-xl text-xs font-medium border animate-fadeIn ${
                message.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-900 text-center">
          <p className="text-xs text-neutral-500">
            Hanya email yang terdaftar sebagai admin yang dapat mengelola data keuangan ini.
          </p>
        </div>
      </div>
    </div>
  );
}
