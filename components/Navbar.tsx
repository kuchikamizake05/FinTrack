"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  LayoutDashboard, 
  Receipt, 
  Tags, 
  Settings as SettingsIcon, 
  LogOut, 
  TrendingUp,
  ChartNoAxesCombined,
  BrainCircuit,
  User,
  WalletCards,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
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

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Akun", href: "/accounts", icon: WalletCards },
    { name: "Transaksi", href: "/transactions", icon: Receipt },
    { name: "Investasi", href: "/investments", icon: ChartNoAxesCombined },
    { name: "Trading", href: "/trading", icon: TrendingUp },
    { name: "Insights", href: "/insights", icon: BrainCircuit },
    { name: "Kategori", href: "/categories", icon: Tags },
    { name: "Pengaturan", href: "/settings", icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Top Navbar */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-neutral-900 hidden md:block">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/25">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-neutral-200 transition-colors">
                FinTrack
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-violet-600/10 text-violet-400 border border-violet-500/20"
                        : "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f1b] border border-neutral-800 rounded-xl">
                <User className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-neutral-300 font-medium max-w-[150px] truncate">
                  {userEmail}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#07070f]/85 backdrop-blur-lg border-t border-neutral-900 md:hidden pb-safe">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${
                  isActive ? "text-violet-400 font-bold" : "text-neutral-500"
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive ? "bg-violet-600/10 border border-violet-500/20" : ""
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold tracking-wide">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
