"use client";

import { useId, type ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type PageHeaderProps = {
  eyebrow: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
  id?: string;
};

export function PageHeader({ eyebrow, title, description, actions, id }: PageHeaderProps) {
  const { t } = useLanguage();
  const generatedId = useId();
  const titleId = id ?? `page-title-${generatedId}`;
  const descriptionId = `${titleId}-description`;

  return (
    <header className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:pt-0">
      <div className="max-w-2xl">
        <p className="inline-flex min-h-7 items-center rounded-full border border-emerald-100 bg-white/75 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 shadow-[var(--shadow-control)] backdrop-blur sm:mb-2 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:text-xs sm:shadow-none">
          {typeof eyebrow === "string" ? t(eyebrow) : eyebrow}
        </p>
        <h1 id={titleId} className="mt-3 text-[1.75rem] font-bold leading-[1.06] tracking-[-0.045em] text-slate-900 sm:mt-0 sm:text-4xl">{t(title)}</h1>
        <p id={descriptionId} className="mt-2 max-w-xl text-[13px] leading-5 text-slate-500 sm:text-sm sm:leading-6">{t(description)}</p>
      </div>
      {actions && (
        <div role="group" aria-label={t("Aksi halaman")} className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
