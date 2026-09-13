"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import FinancialJourney, { useFinancialJourney } from "@/components/FinancialJourney";
import { useLanguage } from "@/components/LanguageProvider";

export default function JourneyPage() {
  const journey = useFinancialJourney();
  const { language } = useLanguage();
  const en = language === "en";
  return <div className="min-h-screen bg-[#f7fbf8] text-slate-900">
    <Navbar />
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-5 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none md:py-8">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"><ArrowLeft aria-hidden="true" className="h-4 w-4" />{en ? "Back to dashboard" : "Kembali ke dashboard"}</Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{en ? "Your financial journey" : "Perjalanan keuanganmu"}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">{en ? "Build your habits, finish weekly missions, and celebrate each milestone." : "Bangun kebiasaan, selesaikan misi mingguan, dan rayakan setiap pencapaian."}</p>
      <FinancialJourney journey={journey} />
    </main>
  </div>;
}
