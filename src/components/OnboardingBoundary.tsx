"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ApplicationLoading } from "@/components/AppBoundary";
import { Button } from "@/components/ui/Button";
import { isProtectedRoute } from "@/lib/auth";
import { reportHandledError } from "@/lib/errors";
import {
  buildOnboardingStorageKey,
  parseOnboardingProgress,
  resolveOnboardingDestination,
  resolveOnboardingEligibility,
  resolveOnboardingStep,
  type OnboardingEligibility,
  type OnboardingProgress,
} from "@/lib/onboarding";
import { supabase } from "@/infrastructure/supabase/browser-client";

type OnboardingContextValue = {
  userId: string;
  eligibility: OnboardingEligibility;
  progress: OnboardingProgress | null;
  hasAccount: boolean;
  hasTransaction: boolean;
  saveProgress: (progress: OnboardingProgress) => void;
  refresh: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("useOnboarding must be used inside OnboardingBoundary.");
  return value;
}

export default function OnboardingBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Omit<OnboardingContextValue, "saveProgress" | "refresh"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const protectedRoute = isProtectedRoute(pathname);

  const loadEligibility = useCallback(async () => {
    if (!protectedRoute) return;
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      const stored = parseOnboardingProgress(
        window.localStorage.getItem(buildOnboardingStorageKey(user.id)),
        user.id,
      );
      const [accountResult, transactionResult] = await Promise.all([
        supabase.from("financial_accounts").select("id").eq("user_id", user.id).limit(1),
        supabase.from("transactions").select("id").eq("user_id", user.id).neq("status", "deleted").limit(1),
      ]);

      if (accountResult.error) throw accountResult.error;
      if (transactionResult.error) throw transactionResult.error;

      const hasAccount = Boolean(accountResult.data?.length);
      const hasTransaction = Boolean(transactionResult.data?.length);
      let progress = stored;

      if (stored && !stored.completedAt) {
        const [storedAccountResult, storedTransactionResult] = await Promise.all([
          stored.accountId
            ? supabase.from("financial_accounts").select("id").eq("user_id", user.id).eq("id", stored.accountId).limit(1)
            : Promise.resolve({ data: [], error: null }),
          stored.transactionId
            ? supabase.from("transactions").select("id").eq("user_id", user.id).eq("id", stored.transactionId).eq("status", "confirmed").limit(1)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (storedAccountResult.error) throw storedAccountResult.error;
        if (storedTransactionResult.error) throw storedTransactionResult.error;
        const recoveredStep = resolveOnboardingStep(stored, {
          accountExists: Boolean(storedAccountResult.data?.length),
          transactionExists: Boolean(storedTransactionResult.data?.length),
        });
        if (recoveredStep !== stored.step) {
          progress = {
            ...stored,
            step: recoveredStep,
            accountId: recoveredStep === "account" ? null : stored.accountId,
            accountName: recoveredStep === "account" ? null : stored.accountName,
            transactionId: recoveredStep === "summary" ? stored.transactionId : null,
          };
          window.localStorage.setItem(buildOnboardingStorageKey(user.id), JSON.stringify(progress));
        }
      }

      const eligibility = resolveOnboardingEligibility({ hasAccount, hasTransaction, progress, now: new Date() });
      setSnapshot({ userId: user.id, eligibility, progress, hasAccount, hasTransaction });
    } catch (loadError) {
      reportHandledError("Onboarding eligibility unavailable", loadError, "Status penyiapan belum bisa diperiksa.");
      setError("Status penyiapan belum bisa diperiksa. Coba lagi.");
    }
  }, [protectedRoute]);

  useEffect(() => {
    if (!protectedRoute) return;
    const timer = window.setTimeout(() => void loadEligibility(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEligibility, protectedRoute]);

  const saveProgress = useCallback((progress: OnboardingProgress) => {
    window.localStorage.setItem(buildOnboardingStorageKey(progress.userId), JSON.stringify(progress));
    setSnapshot((current) => current ? {
      ...current,
      progress,
      eligibility: resolveOnboardingEligibility({
        hasAccount: current.hasAccount,
        hasTransaction: current.hasTransaction,
        progress,
        now: new Date(),
      }),
    } : current);
  }, []);

  const contextValue = useMemo<OnboardingContextValue | null>(() => snapshot ? {
    ...snapshot,
    saveProgress,
    refresh: loadEligibility,
  } : null, [loadEligibility, saveProgress, snapshot]);

  const destination = snapshot
    ? resolveOnboardingDestination({ pathname, eligibility: snapshot.eligibility })
    : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (!protectedRoute) return children;
  if (error) return <OnboardingGateError message={error} onRetry={() => void loadEligibility()} />;
  if (!contextValue || destination) return <ApplicationLoading />;

  return <OnboardingContext.Provider value={contextValue}>{children}</OnboardingContext.Provider>;
}

function OnboardingGateError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_55%,#f8faf9_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><AlertCircle className="h-6 w-6" /></span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">Penyiapan belum bisa diperiksa</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        <Button className="mt-5 w-full" onClick={onRetry}><RefreshCw className="h-4 w-4" /> Coba lagi</Button>
      </section>
    </main>
  );
}
