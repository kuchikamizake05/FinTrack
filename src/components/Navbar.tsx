"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrainCircuit, CalendarClock, ChevronDown, LogOut, Plus, Settings, Tags, User, WalletCards, X } from "lucide-react";
import { isNavigationActive, primaryNavigation } from "@/lib/navigation";
import { reportHandledError } from "@/lib/errors";
import { supabase } from "@/infrastructure/supabase/browser-client";
import BrandLockup from "@/components/BrandLockup";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

const profileItems = [
  { name: "Akun & saldo", href: "/accounts", icon: WalletCards },
  { name: "Kategori", href: "/categories", icon: Tags },
  { name: "Smart Insights", href: "/insights", icon: BrainCircuit },
  { name: "Rencana & kontrol", href: "/planning", icon: CalendarClock },
  { name: "Pengaturan", href: "/settings", icon: Settings },
];

type ProfileOrigin = "desktop" | "mobile" | null;

export default function Navbar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const desktopProfileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileProfileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileOrigin, setProfileOrigin] = useState<ProfileOrigin>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const closeProfile = useCallback((restoreFocus = false) => {
    const origin = profileOrigin;
    setProfileOrigin(null);
    if (restoreFocus && origin) {
      window.setTimeout(() => (origin === "desktop" ? desktopProfileTriggerRef : mobileProfileTriggerRef).current?.focus(), 0);
    }
  }, [profileOrigin]);

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

  useEffect(() => {
    if (!profileOrigin) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const trigger = profileOrigin === "desktop" ? desktopProfileTriggerRef.current : mobileProfileTriggerRef.current;
      if (!profileMenuRef.current?.contains(target) && !trigger?.contains(target)) closeProfile();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeProfile(true);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeProfile, profileOrigin]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      closeProfile();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
    } catch (error) {
      reportHandledError("Navbar logout failed", error, "Sesi belum dapat ditutup. Coba lagi.");
      setLogoutError("Sesi belum dapat ditutup. Coba lagi.");
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (href: string) => isNavigationActive(href, pathname);
  const toggleProfile = (origin: Exclude<ProfileOrigin, null>) => {
    setProfileOrigin((current) => current === origin ? null : origin);
  };

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
                    prefetch={true}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-full items-center text-sm font-extrabold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-4 ${active ? "text-[var(--brand-ink)]" : "text-[color:rgba(18,53,36,0.66)] hover:text-[var(--brand-ink)]"}`}
                  >
                    {t(item.name)}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 bottom-0 h-[3px] origin-left rounded-t-full bg-[var(--brand-ink)] transition-transform duration-150 ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}
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
                ref={desktopProfileTriggerRef}
                type="button"
                onClick={() => toggleProfile("desktop")}
                aria-expanded={profileOrigin === "desktop"}
                aria-haspopup="menu"
                aria-controls="profile-menu"
                className="flex min-h-11 items-center gap-2.5 rounded-full bg-[var(--brand-primary)] px-4 text-xs font-extrabold text-white shadow-[0_8px_0_rgba(18,53,36,0.10)] transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-[var(--brand-ink)] hover:shadow-[0_10px_0_rgba(18,53,36,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ink)] focus-visible:ring-offset-2"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-[170px] truncate">{userEmail || t("Profil")}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${profileOrigin === "desktop" ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {profileOrigin === "desktop" && <ProfileMenu ref={profileMenuRef} onClose={() => closeProfile(true)} onLogout={handleLogout} loggingOut={loggingOut} error={logoutError} />}
            </div>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-40 flex min-h-[74px] items-center justify-between border-b border-[color:rgba(18,53,36,0.15)] bg-[color:rgba(233,248,238,0.94)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
        <BrandLockup href="/dashboard" priority compact ariaLabel="FinTrack dashboard" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <button
            ref={mobileProfileTriggerRef}
            type="button"
            onClick={() => toggleProfile("mobile")}
            aria-label={profileOrigin === "mobile" ? t("Tutup menu profil") : t("Buka menu profil")}
            aria-expanded={profileOrigin === "mobile"}
            aria-haspopup="menu"
            aria-controls="profile-menu"
            className="grid h-[42px] w-[42px] place-items-center rounded-full bg-[var(--brand-ink)] text-[var(--brand-lime)] shadow-[0_6px_0_rgba(18,53,36,0.10)] transition-transform active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
          >
            <User className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
        {profileOrigin === "mobile" && <ProfileMenu ref={profileMenuRef} onClose={() => closeProfile(true)} onLogout={handleLogout} mobile loggingOut={loggingOut} error={logoutError} />}
      </header>

      <nav
        aria-label={t("Navigasi utama")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:rgba(18,53,36,0.12)] bg-[color:rgba(244,251,246,0.96)] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(18,53,36,0.08)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center">
          {(() => {
            const item0 = primaryNavigation[0];
            const active0 = isActive(item0.href);
            const Icon0 = item0.icon;
            return (
              <Link
                key={item0.href}
                href={item0.href}
                prefetch={false}
                aria-current={active0 ? "page" : undefined}
                className={`relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-extrabold transition-colors duration-100 active:scale-95 ${active0 ? "text-[var(--brand-ink)]" : "text-[color:rgba(18,53,36,0.48)] hover:text-[var(--brand-ink)]"}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors duration-100 ${active0 ? "bg-[var(--brand-ink)] text-[var(--brand-lime)]" : "bg-transparent"}`}>
                  <Icon0 className={`h-[18px] w-[18px] ${active0 ? "stroke-[2.5]" : "stroke-2"}`} aria-hidden="true" />
                </span>
                <span className="truncate px-1">{t(item0.name)}</span>
              </Link>
            );
          })()}

          {(() => {
            const item1 = primaryNavigation[1];
            const active1 = isActive(item1.href);
            const Icon1 = item1.icon;
            return (
              <Link
                key={item1.href}
                href={item1.href}
                prefetch={false}
                aria-current={active1 ? "page" : undefined}
                className={`relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-extrabold transition-colors duration-100 active:scale-95 ${active1 ? "text-[var(--brand-ink)]" : "text-[color:rgba(18,53,36,0.48)] hover:text-[var(--brand-ink)]"}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors duration-100 ${active1 ? "bg-[var(--brand-ink)] text-[var(--brand-lime)]" : "bg-transparent"}`}>
                  <Icon1 className={`h-[18px] w-[18px] ${active1 ? "stroke-[2.5]" : "stroke-2"}`} aria-hidden="true" />
                </span>
                <span className="truncate px-1">{t(item1.name)}</span>
              </Link>
            );
          })()}

          <Link
            href="/transactions?new=1"
            prefetch={false}
            aria-label={t("Buka form catat")}
            className="group relative -mt-5 flex flex-col items-center justify-center gap-0.5 focus-visible:outline-none"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--brand-primary)] text-white shadow-[0_8px_16px_rgba(21,128,61,0.35)] transition-[transform,box-shadow,background-color] duration-100 group-hover:scale-105 group-hover:bg-[var(--brand-ink)] group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-[var(--brand-ink)] group-focus-visible:ring-offset-2">
              <Plus className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
            </span>
            <span className="text-[10px] font-extrabold text-[var(--brand-ink)]">{t("Catat")}</span>
          </Link>

          {(() => {
            const item2 = primaryNavigation[2];
            const active2 = isActive(item2.href);
            const Icon2 = item2.icon;
            return (
              <Link
                key={item2.href}
                href={item2.href}
                prefetch={false}
                aria-current={active2 ? "page" : undefined}
                className={`relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-extrabold transition-colors duration-100 active:scale-95 ${active2 ? "text-[var(--brand-ink)]" : "text-[color:rgba(18,53,36,0.48)] hover:text-[var(--brand-ink)]"}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors duration-100 ${active2 ? "bg-[var(--brand-ink)] text-[var(--brand-lime)]" : "bg-transparent"}`}>
                  <Icon2 className={`h-[18px] w-[18px] ${active2 ? "stroke-[2.5]" : "stroke-2"}`} aria-hidden="true" />
                </span>
                <span className="truncate px-1">{t(item2.name)}</span>
              </Link>
            );
          })()}

          {(() => {
            const item3 = primaryNavigation[3];
            const active3 = isActive(item3.href);
            const Icon3 = item3.icon;
            return (
              <Link
                key={item3.href}
                href={item3.href}
                prefetch={false}
                aria-current={active3 ? "page" : undefined}
                className={`relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-extrabold transition-colors duration-100 active:scale-95 ${active3 ? "text-[var(--brand-ink)]" : "text-[color:rgba(18,53,36,0.48)] hover:text-[var(--brand-ink)]"}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors duration-100 ${active3 ? "bg-[var(--brand-ink)] text-[var(--brand-lime)]" : "bg-transparent"}`}>
                  <Icon3 className={`h-[18px] w-[18px] ${active3 ? "stroke-[2.5]" : "stroke-2"}`} aria-hidden="true" />
                </span>
                <span className="truncate px-1">{t(item3.name)}</span>
              </Link>
            );
          })()}
        </div>
      </nav>
    </>
  );
}

type ProfileMenuProps = {
  onClose: () => void;
  onLogout: () => void;
  mobile?: boolean;
  loggingOut: boolean;
  error: string | null;
};

const ProfileMenu = ({ onClose, onLogout, mobile = false, loggingOut, error, ref }: ProfileMenuProps & { ref: Ref<HTMLDivElement> }) => {
  const { t } = useLanguage();
  return (
    <div
      ref={ref}
      id="profile-menu"
      role="menu"
      aria-label={t("Profil dan navigasi lainnya")}
      className={`${mobile ? "fixed inset-x-4 top-[calc(4.75rem+env(safe-area-inset-top))] mx-auto" : "absolute right-0 top-14"} z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[color:rgba(18,53,36,0.14)] bg-white p-2.5 text-[var(--brand-ink)] shadow-[var(--shadow-elevated)]`}
    >
      <div className="flex items-center justify-between border-b border-[color:rgba(18,53,36,0.10)] px-2.5 py-2.5 text-[11px] font-black uppercase tracking-[0.13em] text-[color:rgba(18,53,36,0.58)]">
        <span>{t("Profil & lainnya")}</span>
        {mobile && (
          <button type="button" onClick={onClose} aria-label={t("Tutup menu")} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--brand-mint)]">
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
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[color:rgba(18,53,36,0.72)] transition-colors hover:bg-[var(--brand-mint)] hover:text-[var(--brand-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
            >
              <Icon className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden="true" />
              {t(item.name)}
            </Link>
          );
        })}
      </div>
      {error && <p role="alert" className="border-t border-rose-100 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p>}
      <button
        type="button"
        role="menuitem"
        onClick={onLogout}
        disabled={loggingOut}
        aria-busy={loggingOut || undefined}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border-t border-[color:rgba(18,53,36,0.08)] px-3 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {loggingOut ? t("Menutup sesi...") : t("Keluar")}
      </button>
    </div>
  );
};
