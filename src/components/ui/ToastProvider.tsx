"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { showToast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "border-emerald-200 bg-emerald-950 text-white" },
  error: { icon: AlertCircle, className: "border-rose-200 bg-rose-950 text-white" },
  info: { icon: Info, className: "border-slate-200 bg-slate-900 text-white" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4800);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5">
        {toasts.map((toast) => {
          const { icon: Icon, className } = toastStyles[toast.tone];
          return (
            <div key={toast.id} role={toast.tone === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-[0_18px_45px_rgba(15,23,42,0.22)] motion-safe:animate-[toast-in_220ms_ease-out] ${className}`}>
              <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1 text-sm font-semibold leading-5">{t(toast.message)}</p>
              <button type="button" onClick={() => dismiss(toast.id)} className="-mr-1 -mt-1 rounded-lg p-1 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={t("Tutup notifikasi")}>
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
