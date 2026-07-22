import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { buttonStyles } from "@/components/ui/button-styles";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0px,#f7fbf8_55%,#ffffff_100%)] px-5 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-[28px] border border-emerald-100 bg-white p-6 text-center shadow-[0_20px_65px_rgba(22,101,52,0.10)] sm:p-8">
        <BrandLogo size={56} alt="FinTrack" priority className="mx-auto" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Mode offline</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Koneksi sedang terputus</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">FinTrack belum bisa memuat halaman baru. Halaman yang sudah terbuka tetap dapat dilihat selama tersedia di perangkat ini.</p>
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-left"><p className="flex items-center gap-2 text-sm font-bold text-emerald-900"><WifiOff className="h-4 w-4" /> Yang bisa dilakukan</p><p className="mt-1 text-xs leading-5 text-emerald-800/75">Periksa Wi-Fi atau data seluler, lalu coba lagi. Tidak ada data yang dihapus saat koneksi terputus.</p></div>
        <Link href="/dashboard" className={buttonStyles({ className: "mt-6 w-full" })}><RefreshCw className="h-4 w-4" /> Coba sambungkan lagi</Link>
      </section>
    </main>
  );
}
