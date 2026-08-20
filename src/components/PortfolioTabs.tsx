"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

const tabs = [
  { name: "Investasi", href: "/investments", icon: ChartNoAxesCombined },
  { name: "Trading", href: "/trading", icon: TrendingUp },
] as const;

export function PortfolioTabs() {
  const { t } = useLanguage();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("Portofolio")}
      className="inline-flex rounded-2xl bg-[color:rgba(18,53,36,0.06)] p-1 backdrop-blur-sm"
    >
      <div className="flex items-center gap-1" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]",
                active
                  ? "bg-white text-[var(--brand-ink)] shadow-[0_2px_8px_rgba(18,53,36,0.08)]"
                  : "text-[color:rgba(18,53,36,0.64)] hover:bg-[color:rgba(255,255,255,0.6)] hover:text-[var(--brand-ink)]",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-[var(--brand-primary)]" : "text-current")} aria-hidden="true" />
              <span>{t(tab.name)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
