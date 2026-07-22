"use client";

import { Globe2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { Language } from "@/lib/i18n";

export function LanguageSwitcher({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  const choices: { code: Language; label: string }[] = [
    { code: "id", label: "ID" },
    { code: "en", label: "EN" },
  ];

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-[color:rgba(18,53,36,0.14)] bg-white/85 p-1 shadow-sm ${className}`}
      role="group"
      aria-label={t("Pilih bahasa")}
    >
      {!compact && <Globe2 className="ml-1.5 h-4 w-4 text-[var(--brand-primary)]" aria-hidden="true" />}
      {choices.map((choice) => {
        const active = language === choice.code;
        return (
          <button
            key={choice.code}
            type="button"
            onClick={() => setLanguage(choice.code)}
            aria-pressed={active}
            aria-label={choice.code === "id" ? t("Indonesia") : t("Inggris")}
            className={`min-h-8 rounded-full px-2.5 text-[11px] font-black tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] ${
              active
                ? "bg-[var(--brand-ink)] text-[var(--brand-lime)]"
                : "text-[color:rgba(18,53,36,0.58)] hover:bg-[var(--brand-mint)] hover:text-[var(--brand-ink)]"
            }`}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
