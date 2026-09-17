import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CardHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  className?: string;
  action?: { label: string; href: string };
};

export function CardHeader({ title, subtitle, titleId, className, action }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={titleId} className="text-base font-bold leading-6 tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold leading-5 text-emerald-700 transition-colors hover:text-emerald-900">
          {action.label}<ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
