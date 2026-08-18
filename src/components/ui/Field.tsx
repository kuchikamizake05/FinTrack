"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/LanguageProvider";

export const fieldControlStyles = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-[var(--shadow-control)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
  descriptionId?: string;
};

type FieldControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export function Field({ label, htmlFor, hint, error, children, className, required = false, descriptionId: suppliedDescriptionId }: FieldProps) {
  const { t } = useLanguage();
  const generatedId = useId();
  const descriptionId = suppliedDescriptionId ?? `${htmlFor}-description-${generatedId}`;
  const existingControl = isValidElement<FieldControlProps>(children) && typeof children.type === "string"
    && ["input", "select", "textarea"].includes(children.type);
  const existingDescribedBy = existingControl ? children.props["aria-describedby"] : undefined;
  const describedBy = [existingDescribedBy, (error || hint) ? descriptionId : undefined].filter(Boolean).join(" ") || undefined;
  const control = existingControl
    ? cloneElement(children as ReactElement<FieldControlProps>, {
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : children.props["aria-invalid"],
    })
    : children;

  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-slate-700">
        {t(label)}
        {required && <span aria-hidden="true" className="ml-1 text-rose-600">*</span>}
      </label>
      {control}
      {(error || hint) && (
        <p id={descriptionId} role={error ? "alert" : undefined} className={cn("mt-2 text-xs leading-5", error ? "text-rose-600" : "text-slate-500")}>
          {t(error || hint || "")}
        </p>
      )}
    </div>
  );
}
