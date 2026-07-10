import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const fieldControlStyles = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export function Field({ label, htmlFor, hint, error, children, className }: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>
      {children}
      {(error || hint) && (
        <p className={cn("mt-2 text-xs leading-5", error ? "text-rose-600" : "text-slate-400")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
