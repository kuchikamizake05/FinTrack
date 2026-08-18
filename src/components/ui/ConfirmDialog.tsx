"use client";

import { useRef, type ReactNode } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  titleId: string;
  title: string;
  descriptionId: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
  contentClassName?: string;
};

export function ConfirmDialog({
  titleId,
  title,
  descriptionId,
  description,
  confirmLabel,
  cancelLabel = "Batal",
  onClose,
  onConfirm,
  loading = false,
  error = null,
  className,
  contentClassName,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame
      role="alertdialog"
      titleId={titleId}
      descriptionId={descriptionId}
      initialFocusRef={cancelRef}
      onClose={onClose}
      closeDisabled={loading}
      className={cn("z-[70]", className)}
      contentClassName={cn("max-w-md border-rose-100 p-5 sm:p-6", contentClassName)}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 id={titleId} className="mt-4 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div aria-live="polite" aria-atomic="true">
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-700">{error}</p>}
      </div>
      <div className="mt-6 flex gap-2 pb-[env(safe-area-inset-bottom)] sm:justify-end">
        <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={loading} className="flex-1 sm:flex-none">{cancelLabel}</Button>
        <Button variant="destructive" onClick={onConfirm} loading={loading} className="flex-1 sm:flex-none">
          <Check className="h-4 w-4" /> {confirmLabel}
        </Button>
      </div>
      {loading && <span className="sr-only">Memproses...</span>}
    </DialogFrame>
  );
}
