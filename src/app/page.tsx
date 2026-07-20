"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApplicationLoading, ConfigurationRequired } from "@/components/AppBoundary";
import { reportHandledError } from "@/lib/errors";
import { isSupabaseConfigured, supabase } from "@/infrastructure/supabase/browser-client";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Pemeriksaan sesi terlalu lama.")), 5_000);
    });

    void Promise.race([sessionPromise, timeoutPromise])
      .then(({ data }) => {
        if (active) router.replace(data.session ? "/dashboard" : "/login");
      })
      .catch((error) => {
        reportHandledError("Root session check failed", error, "Sesi belum dapat diperiksa.");
        if (active) router.replace("/login");
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  if (!isSupabaseConfigured) return <ConfigurationRequired />;
  return <ApplicationLoading />;
}
