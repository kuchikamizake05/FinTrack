"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Clipboard, Database, Eye, EyeOff, Globe2, LogOut, ShieldCheck, Smartphone, User, WalletCards, Wifi, WifiOff } from "lucide-react";
import Navbar from "@/components/Navbar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { maskUserIdentifier } from "@/lib/settings";
import { getNetworkSnapshot, getServerNetworkSnapshot, subscribeToNetworkStatus } from "@/lib/pwa";
import { supabase } from "@/infrastructure/supabase/browser-client";

export default function SettingsPage() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);
  const [standalone, setStandalone] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        if (navigator.onLine) router.push("/login");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setUserId(session.user.id);
      setLoading(false);
    };
    void fetchUser();
  }, [router]);

  useEffect(() => {
    const displayQuery = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => setStandalone(displayQuery.matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
    updateStandalone();
    displayQuery.addEventListener("change", updateStandalone);
    return () => {
      displayQuery.removeEventListener("change", updateStandalone);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function copyUserId() {
    if (!userId) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopyError(t("Identitas belum dapat disalin. Pilih tampilkan lalu salin manual."));
    }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main className="app-page-content max-w-6xl space-y-5 sm:space-y-6">
        <PageHeader
          eyebrow={t("Workspace settings")}
          title={t("Pengaturan")}
          description={t("Kelola sesi, periksa lingkungan aplikasi, dan hubungkan workflow Telegram dengan aman.")}
        />

        <Surface className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-sm font-bold">{t("Bahasa tampilan")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("Pilih bahasa yang digunakan di seluruh aplikasi.")}</p>
          </div>
          <LanguageSwitcher />
        </Surface>

        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-6">
            <Surface className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><User className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{loading ? t("Memuat akun...") : userEmail || t("Email tidak tersedia")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t("Pemilik workspace pribadi")}</p>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-2 text-xs font-bold text-slate-700"><ShieldCheck className="h-4 w-4 text-emerald-700" /> {t("Sesi privat")}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{t("Data keuangan hanya dibuka lewat akun terautentikasi ini.")}</p>
              </div>
              <Button variant="destructive" onClick={() => void handleLogout()} className="mt-5 w-full"><LogOut className="h-4 w-4" /> {t("Keluar dari sesi")}</Button>
            </Surface>

            <Surface className="overflow-hidden">
              <div className="border-b border-emerald-100 px-5 py-4"><h2 className="text-sm font-bold">{t("Lingkungan aplikasi")}</h2><p className="mt-1 text-xs text-slate-500">{t("Konfigurasi aktif pada perangkat ini.")}</p></div>
              <dl className="divide-y divide-slate-100 px-5">
                <SystemRow icon={WalletCards} label={t("Mata uang utama")} value={t("IDR · Rupiah")} />
                <SystemRow icon={Globe2} label={t("Zona waktu")} value="Asia/Jakarta" />
                <SystemRow icon={Smartphone} label={t("Mode tampilan")} value={standalone ? t("Aplikasi terpasang") : t("Browser")} />
                <SystemRow icon={online ? Wifi : WifiOff} label={t("Koneksi")} value={online ? t("Online") : t("Offline")} tone={online ? "text-emerald-700" : "text-amber-700"} />
              </dl>
            </Surface>
          </div>

          <div className="space-y-6">
            <Surface className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Database className="h-5 w-5" /></span>
                <div><h2 className="text-base font-bold">{t("Identitas integrasi")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("Gunakan Supabase User ID ini untuk mengikat workflow n8n ke pemilik data yang benar.")}</p></div>
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="min-w-0 truncate text-xs font-semibold text-slate-700">{revealed ? userId || t("Memuat identitas...") : maskUserIdentifier(userId)}</code>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9" onClick={() => setRevealed((value) => !value)} aria-label={revealed ? t("Sembunyikan User ID") : t("Tampilkan User ID")}>{revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                    <Button variant="secondary" size="compact" onClick={() => void copyUserId()} disabled={!userId}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Clipboard className="h-3.5 w-3.5" />} {copied ? t("Tersalin") : t("Salin")}</Button>
                  </div>
                </div>
              </div>
              {copyError && <p role="alert" className="mt-2 text-xs text-rose-700">{copyError}</p>}
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-xs font-bold text-amber-900">{t("Jaga batas kredensial")}</p><p className="mt-1 text-xs leading-5 text-amber-800/80">{t("Anon key boleh dipakai client dengan RLS aktif. Jangan pernah menaruh service-role key di browser, Telegram, atau workflow yang dapat dibaca publik.")}</p></div>
            </Surface>

            <Surface className="overflow-hidden">
              <div className="border-b border-emerald-100 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Bot className="h-5 w-5" /></span><div><h2 className="text-base font-bold">{t("Hubungkan bot Telegram")}</h2><p className="mt-1 text-xs text-slate-500">{t("Empat langkah dari bot baru sampai workflow aktif.")}</p></div></div></div>
              <div className="divide-y divide-slate-100 px-5">
                <SetupStep number="1" title={t("Buat bot melalui BotFather")}>{language === "en" ? <>Open the official <code className="font-bold text-emerald-700">@BotFather</code> account, run <code>/newbot</code>, then store the token in n8n credentials—not in source code.</> : <>Buka akun resmi <code className="font-bold text-emerald-700">@BotFather</code>, jalankan <code>/newbot</code>, lalu simpan token di credential n8n—bukan di source code.</>}</SetupStep>
                <SetupStep number="2" title={t("Batasi pengguna Telegram")}>{t("Ambil Telegram User ID Anda melalui bot informasi akun, lalu gunakan sebagai allowlist agar bot pribadi tidak dapat dipakai orang lain.")}</SetupStep>
                <SetupStep number="3" title={t("Atur environment n8n")}><VariableList items={["TELEGRAM_ALLOWED_USER_ID", "GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_USER_ID"]} /></SetupStep>
                <SetupStep number="4" title={t("Import dan aktifkan workflow")}>{language === "en" ? <>Import the workflow from the <code className="font-bold text-emerald-700">n8n/</code> folder, connect the Telegram credential, test one transaction, then activate the workflow.</> : <>Import workflow dari folder <code className="font-bold text-emerald-700">n8n/</code>, hubungkan Telegram credential, uji satu transaksi, lalu aktifkan workflow.</>}</SetupStep>
              </div>
            </Surface>
          </div>
        </div>
      </main>
    </div>
  );
}

function SystemRow({ icon: Icon, label, value, tone = "text-slate-700" }: { icon: typeof WalletCards; label: string; value: string; tone?: string }) {
  return <div className="flex items-center justify-between gap-3 py-3.5"><dt className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Icon className="h-4 w-4 text-emerald-700" /> {label}</dt><dd className={`text-right text-xs font-bold ${tone}`}>{value}</dd></div>;
}

function SetupStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <article className="flex gap-3 py-5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700">{number}</span><div><h3 className="text-sm font-bold">{title}</h3><div className="mt-1 text-xs leading-5 text-slate-500">{children}</div></div></article>;
}

function VariableList({ items }: { items: string[] }) {
  return <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">{items.map((item) => <li key={item}><code className="block rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700">{item}</code></li>)}</ul>;
}
