"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrainCircuit, ChevronDown, LogOut, Settings, Tags, User, WalletCards, X } from "lucide-react";
import { primaryNavigation } from "@/lib/navigation";
import { supabase } from "@/infrastructure/supabase/browser-client";
import BrandLogo from "@/components/BrandLogo";

const profileItems = [
  { name: "Akun & saldo", href: "/accounts", icon: WalletCards },
  { name: "Kategori", href: "/categories", icon: Tags },
  { name: "Smart Insights", href: "/insights", icon: BrainCircuit },
  { name: "Pengaturan", href: "/settings", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUserEmail(data.session?.user.email ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const isActive = (href: string) => pathname === href;

  return <>
    <header className="sticky top-0 z-40 hidden w-full border-b border-emerald-100 bg-white/95 backdrop-blur-md md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="group flex items-center gap-2"><BrandLogo size={36} priority /><span className="text-xl font-bold tracking-tight text-[#1b2740] transition-colors group-hover:text-emerald-700">FinTrack</span></Link>
          <nav className="flex items-center gap-1">{primaryNavigation.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${isActive(item.href) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-transparent text-slate-500 hover:bg-emerald-50 hover:text-[#17233b]"}`}><Icon className="h-4 w-4" />{item.name}</Link>; })}</nav>
        </div>
        <div className="relative"><button onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"><User className="h-4 w-4 text-emerald-600" /><span className="max-w-[160px] truncate">{userEmail || "Profil"}</span><ChevronDown className="h-3.5 w-3.5" /></button>{profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} onLogout={handleLogout} />}</div>
      </div>
    </header>

    <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-emerald-100 bg-white/95 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-md md:hidden"><Link href="/dashboard" className="flex items-center gap-2"><BrandLogo size={32} priority /><span className="font-bold text-[#1b2740]">FinTrack</span></Link><button onClick={() => setProfileOpen((value) => !value)} aria-label="Buka profil" className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50"><User className="h-4 w-4" /></button>{profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} onLogout={handleLogout} mobile />}</header>

    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-900/[0.08] bg-white/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(23,35,59,0.045)] backdrop-blur-xl md:hidden"><div className="mx-auto grid max-w-md grid-cols-4">{primaryNavigation.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-[color,transform] duration-200 ease-out active:scale-95 ${active ? "text-emerald-700" : "text-slate-400 hover:text-slate-600"}`}>{active && <span className="absolute top-0 h-0.5 w-5 rounded-full bg-emerald-600" />}<Icon className={`h-[19px] w-[19px] transition-transform duration-200 ${active ? "scale-105 stroke-[2.5]" : "stroke-2"}`} /><span className="truncate px-1">{item.name}</span></Link>; })}</div></nav>
  </>;
}

function ProfileMenu({ onClose, onLogout, mobile = false }: { onClose: () => void; onLogout: () => void; mobile?: boolean }) {
  return <div className={`${mobile ? "fixed inset-x-4 top-16" : "absolute right-0 top-12"} z-50 w-64 rounded-xl border border-emerald-100 bg-white p-2 shadow-[0_14px_40px_rgba(15,23,42,0.12)]`}><div className="flex items-center justify-between border-b border-slate-100 px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-500"><span>Profil & lainnya</span>{mobile && <button onClick={onClose} aria-label="Tutup menu"><X className="h-4 w-4" /></button>}</div><div className="py-1">{profileItems.map((item) => { const Icon = item.icon; return <Link onClick={onClose} key={item.href} href={item.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"><Icon className="h-4 w-4 text-emerald-600" />{item.name}</Link>; })}</div><button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg border-t border-slate-100 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" />Keluar</button></div>;
}
