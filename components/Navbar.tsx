"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, Tags, TrendingUp, User, WalletCards, X } from "lucide-react";
import { primaryNavigation } from "@/lib/navigation";
import { supabase } from "@/lib/supabase";

const profileItems = [
  { name: "Akun & saldo", href: "/accounts", icon: WalletCards },
  { name: "Kategori", href: "/categories", icon: Tags },
  { name: "Pengaturan", href: "/settings", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email || null);
      else router.push("/login");
    };
    void fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => pathname === href || (href === "/trading" && pathname === "/insights");

  return <>
    <header className="sticky top-0 z-40 hidden w-full border-b border-neutral-900 bg-[#07070f] md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2 group"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md shadow-violet-500/25"><TrendingUp className="h-5 w-5 text-white" /></div><span className="text-xl font-bold tracking-tight text-[#1b2740] transition-colors group-hover:text-violet-600">FinTrack</span></Link>
          <nav className="flex items-center gap-1">{primaryNavigation.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${isActive(item.href) ? "border-violet-500/20 bg-violet-600/10 text-violet-400" : "border-transparent text-neutral-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{item.name}</Link>; })}</nav>
        </div>
        <div className="relative"><button onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#0f0f1b] px-3 py-2 text-xs font-medium text-neutral-300 hover:border-violet-500/30 hover:text-white"><User className="h-4 w-4 text-violet-400" /><span className="max-w-[160px] truncate">{userEmail || "Profil"}</span><ChevronDown className="h-3.5 w-3.5" /></button>{profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} onLogout={handleLogout} />}</div>
      </div>
    </header>

    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-neutral-900 bg-[#07070f] px-4 md:hidden"><Link href="/dashboard" className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600"><TrendingUp className="h-4 w-4 text-white" /></div><span className="font-bold text-[#1b2740]">FinTrack</span></Link><button onClick={() => setProfileOpen((value) => !value)} aria-label="Buka profil" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-violet-300"><User className="h-4 w-4" /></button>{profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} onLogout={handleLogout} mobile />}</header>

    <nav className="fixed inset-x-4 bottom-3 z-40 rounded-[28px] border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(29,48,86,0.18)] md:hidden"><div className="mx-auto flex h-14 max-w-lg items-center justify-around gap-1">{primaryNavigation.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} href={item.href} className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] transition-all ${active ? "bg-[#e9eeff] font-bold text-[#3558d3]" : "text-slate-500 active:scale-95"}`}><Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-2"}`} /><span className="truncate px-1 text-[10px] font-semibold tracking-tight">{item.name}</span></Link>; })}</div></nav>
  </>;
}

function ProfileMenu({ onClose, onLogout, mobile = false }: { onClose: () => void; onLogout: () => void; mobile?: boolean }) {
  return <div className={`${mobile ? "fixed inset-x-4 top-16" : "absolute right-0 top-12"} z-50 w-64 rounded-xl border border-neutral-800 bg-[#111116] p-2 shadow-2xl`}><div className="flex items-center justify-between border-b border-neutral-800 px-2 py-2 text-xs font-bold uppercase tracking-wider text-neutral-500"><span>Profil & lainnya</span>{mobile && <button onClick={onClose} aria-label="Tutup menu"><X className="h-4 w-4" /></button>}</div><div className="py-1">{profileItems.map((item) => { const Icon = item.icon; return <Link onClick={onClose} key={item.href} href={item.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"><Icon className="h-4 w-4 text-violet-300" />{item.name}</Link>; })}</div><button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg border-t border-neutral-800 px-3 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10"><LogOut className="h-4 w-4" />Keluar</button></div>;
}
