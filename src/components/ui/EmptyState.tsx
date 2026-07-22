"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="px-5 py-12 text-center sm:px-6 sm:py-20">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-[0_8px_22px_rgba(22,101,52,0.08)]">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-[17px] font-bold tracking-[-0.025em] text-slate-900 sm:text-lg">{t(title)}</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 sm:text-sm sm:leading-6">{t(description)}</p>
      {action && <div className="mt-5 flex justify-center [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  );
}
