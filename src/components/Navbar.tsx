"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrainCircuit, ChevronDown, LogOut, Settings, Tags, User, WalletCards, X } from "lucide-react";
import { primaryNavigation } from "@/lib/navigation";
import { supabase } from "@/infrastructure/supabase/browser-client";
import BrandLockup from "@/components/BrandLockup";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

const profileItems = [
  { name: "Akun & saldo", href: "/accounts", icon: WalletCards },
  { name: "Kategori", href: "/categories", icon: Tags },
  { name: "Smart Insights", href: "/insights", icon: BrainCircuit },
  { name: "Pengaturan", href: "/settings", icon: Settings },
];

export default function Navbar() {
  const { t } = useLanguage();
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

  return (
    <>
      <header className="sticky top-0 z-40 hidden w-full border-b border-[color:rgba(18,53,36,0.15)] bg-[color:rgba(233,248,238,0.92)] backdrop-blur-xl md:block">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-6 xl:px-8">
          <div className="flex h-full items-center gap-10 xl:gap-14">
            <BrandLockup href="/dashboard" priority ariaLabel="FinTrack dashboard" />
            <nav className="flex h-full items-center gap-7 xl:gap-9" aria-label={t("Navigasi utama")}>
              {primaryNavigation.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-full items-center text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-4 ${active ? "text-[var(--brand-ink)]" : "text-[color:rgba(18,53,36,0.66)] hover:text-[var(--brand-ink)]"}`}
                  >
                    {t(item.name)}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 bottom-0 h-[3px] origin-left rounded-t-full bg-[var(--brand-ink)] transition-transform duration-200 ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}
                    />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className="flex min-h-11 items-center gap-2.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-extrabold text-white shadow-[0_8px_0_rgba(18,53,36,0.10)] transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-[var(--brand-ink)] hover:shadow-[0_10px_0_rgba(18,53,36,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ink)] focus-visible:ring-offset-2"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-[170px] truncate">{userEmail || t("Profil")}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${profileOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} onLogout={handleLogout} />}
            </div>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-40 flex min-h-[74px] items-center justify-between border-b border-[color:rgba(18,53,36,0.15)] bg-[color:rgba(233,248,238,0.94)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
        <BrandLockup href="/dashboard" priority compact ariaLabel="FinTrack dashboard" />
        <div className="flex items-center gap-2">
        <LanguageSwitcher compact />
        <button
          type="button"
          onClick={() => setProfileOpen((value) => !value)}
          aria-label={profileOpen ? t("Tutup menu profil") : t("Buka menu profil")}
          aria-expanded={profileOpen}
          aria-haspopup="menu"
          className="grid h-[42px] w-[42px] place-items-center rounded-full bg-[var(--brand-ink)] text-[var(--brand-lime)] shadow-[0_6px_0_rgba(18,53,36,0.10)] transition-transform active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
        >
          <User className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        </div>
        {profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} onLogout={handleLogout} mobile />}
      </header>

      <nav
        aria-label={t("Navigasi utama")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:rgba(18,53,36,0.12)] bg-[color:rgba(244,251,246,0.96)] px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(18,53,36,0.08)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-extrabold transition-[color,transform] duration-200 active:scale-95 ${active ? "text-[var(--brand-ink)]" : "text-[color:rgba(18,53,36,0.48)] hover:text-[var(--brand-ink)]"}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${active ? "bg-[var(--brand-ink)] text-[var(--brand-lime)]" : "bg-transparent"}`}>
                  <Icon className={`h-[18px] w-[18px] ${active ? "stroke-[2.5]" : "stroke-2"}`} aria-hidden="true" />
                </span>
                <span className="truncate px-1">{t(item.name)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function ProfileMenu({ onClose, onLogout, mobile = false }: { onClose: () => void; onLogout: () => void; mobile?: boolean }) {
  const { t } = useLanguage();
  return (
    <div
      role="menu"
      className={`${mobile ? "fixed inset-x-4 top-[calc(4.75rem+env(safe-area-inset-top))] mx-auto" : "absolute right-0 top-14"} z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[color:rgba(18,53,36,0.14)] bg-white p-2.5 text-[var(--brand-ink)] shadow-[0_22px_55px_rgba(18,53,36,0.18)]`}
    >
      <div className="flex items-center justify-between border-b border-[color:rgba(18,53,36,0.10)] px-2.5 py-2.5 text-[11px] font-black uppercase tracking-[0.13em] text-[color:rgba(18,53,36,0.58)]">
        <span>{t("Profil & lainnya")}</span>
        {mobile && (
          <button type="button" onClick={onClose} aria-label={t("Tutup menu")} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--brand-mint)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="py-1.5">
        {profileItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              role="menuitem"
              onClick={onClose}
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[color:rgba(18,53,36,0.72)] transition-colors hover:bg-[var(--brand-mint)] hover:text-[var(--brand-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
            >
              <Icon className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden="true" />
              {t(item.name)}
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-xl border-t border-[color:rgba(18,53,36,0.08)] px-3 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {t("Keluar")}
      </button>
    </div>
  );
}
