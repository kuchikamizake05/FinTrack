"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Download, FileText, LockKeyhole, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { reportHandledError } from "@/lib/errors";
import { formatLocalDate } from "@/lib/planning";

type RateMetadata = {
  rate: number | null;
  providerDate: string | null;
  retrievedAt: string | null;
  state: "fresh" | "missing";
};

type CurrencyGroup = {
  currency: string;
  income: number;
  expense: number;
  net: number;
  convertedIncomeIdr: number | null;
  convertedExpenseIdr: number | null;
  convertedNetIdr: number | null;
  rate: RateMetadata;
};

type CategoryTotal = {
  currency: string;
  category: string;
  amount: number;
};

type MonthlyReport = {
  id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  currency_groups: CurrencyGroup[];
  category_totals: CategoryTotal[];
  csv_path: string;
};

type Schedule = {
  is_active: boolean;
  enabled_from_period: string | null;
};

export default function ReportsPage() {
  const { language, t } = useLanguage();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;
      const [scheduleResult, reportsResult] = await Promise.all([
        supabase.from("monthly_report_schedules").select("is_active,enabled_from_period").eq("user_id", user.id).maybeSingle(),
        supabase.from("monthly_financial_reports").select("id,period_start,period_end,generated_at,currency_groups,category_totals,csv_path").eq("user_id", user.id).order("period_start", { ascending: false }),
      ]);
      if (scheduleResult.error || reportsResult.error) throw scheduleResult.error ?? reportsResult.error;
      if (requestId !== requestIdRef.current) return;
      setSchedule(scheduleResult.data as Schedule | null);
      setReports((reportsResult.data ?? []) as MonthlyReport[]);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      reportHandledError("Monthly reports unavailable", error, "Laporan bulanan belum berhasil dimuat.");
      setLoadError(t("Laporan bulanan belum berhasil dimuat. Coba lagi."));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [load]);

  async function setReportsActive(isActive: boolean) {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const record = isActive
        ? { user_id: user.id, is_active: true, enabled_from_period: `${formatLocalDate(new Date()).slice(0, 7)}-01` }
        : { user_id: user.id, is_active: false, enabled_from_period: schedule?.enabled_from_period ?? null };
      const { error } = await supabase.from("monthly_report_schedules").upsert(record, { onConflict: "user_id" });
      if (error) throw error;
      setMessage(t(isActive ? "Laporan bulanan diaktifkan." : "Laporan bulanan dinonaktifkan. Arsip lama tetap tersedia."));
      await load();
    } catch (error) {
      reportHandledError("Monthly report schedule update failed", error, "Status laporan bulanan belum diperbarui.");
      setMessage(t("Status laporan bulanan belum diperbarui. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  async function downloadReport(report: MonthlyReport) {
    if (openingReportId) return;
    setOpeningReportId(report.id);
    setMessage(null);
    try {
      const { data, error } = await supabase.storage.from("financial-reports").createSignedUrl(report.csv_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Report URL unavailable");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      reportHandledError("Monthly report signed URL failed", error, "CSV laporan belum dapat dibuka.");
      setMessage(t("CSV laporan belum dapat dibuka. Coba lagi."));
    } finally {
      setOpeningReportId(null);
    }
  }

  const locale = language === "en" ? "en-US" : "id-ID";
  const active = schedule?.is_active ?? false;

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content max-w-6xl space-y-6 outline-none">
        <PageHeader
          eyebrow="Arsip keuangan"
          title="Laporan bulanan"
          description="Rangkuman keuangan bulanan yang disimpan privat dan siap kamu unduh kapan saja."
        />

        {message && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}
        {loadError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{loadError}</span><Button variant="secondary" size="compact" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> {t("Coba lagi")}</Button></div>}

        {!loadError && (
          <Surface className="relative overflow-hidden border-0 bg-[var(--brand-ink)] p-5 text-white shadow-[0_20px_48px_rgba(18,53,36,0.20)] sm:p-7">
            <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-emerald-300/15" />
            <div aria-hidden="true" className="absolute -bottom-20 right-24 h-36 w-36 rounded-full bg-emerald-400/10" />
            <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${active ? "bg-emerald-300/15 text-emerald-100" : "bg-white/10 text-white/75"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-300" : "bg-white/50"}`} />{t(active ? "Laporan otomatis aktif" : "Laporan otomatis belum aktif")}</span>
                <h2 className="mt-4 text-2xl font-bold tracking-[-0.04em] !text-white sm:text-[1.75rem]">{t(active ? "Keuangan bulanan, tersimpan rapi." : "Mulai arsipkan setiap bulan.")}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 !text-emerald-50/85">{t(active ? "FinTrack akan menyimpan ringkasan setiap bulan tanpa mengubah arsip yang sudah ada." : "Aktifkan sekali, lalu ringkasan bulan yang selesai akan tersimpan otomatis.")}</p>
                {schedule?.enabled_from_period && <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-100"><CheckCircle2 className="h-4 w-4 text-emerald-300" />{t("Aktif sejak periode {period}", { period: formatPeriod(schedule.enabled_from_period, locale) })}</p>}
              </div>
              <Button
                variant={active ? "secondary" : "primary"}
                loading={saving}
                aria-pressed={active}
                onClick={() => void setReportsActive(!active)}
                className={active ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"}
              >
                <CalendarClock className="h-4 w-4" /> {t(active ? "Nonaktifkan" : "Aktifkan laporan")}
              </Button>
            </div>
          </Surface>
        )}

        {!loadError && (
          <section aria-labelledby="report-archive-title">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div className="max-w-xl">
                <h2 id="report-archive-title" className="text-xl font-bold tracking-tight text-slate-900">{t("Arsip laporan")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{t("Setiap periode disimpan satu kali, sehingga catatan bulan lalu tetap utuh saat transaksi baru masuk.")}</p>
              </div>
              {!loading && reports.length > 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{t("{count} laporan", { count: reports.length })}</span>}
            </div>

            {loading ? <ReportsSkeleton /> : reports.length === 0 ? (
              <Surface className="relative overflow-hidden p-5 sm:p-7">
                <div aria-hidden="true" className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-emerald-50" />
                <div className="relative grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-[var(--shadow-control)]"><FileText className="h-6 w-6" /></span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">{t("Arsip pertama")}</p>
                    <h3 className="mt-2 text-lg font-bold tracking-tight text-slate-900">{t(active ? "Laporan pertama sedang menunggu bulan selesai." : "Belum ada laporan untuk ditampilkan.")}</h3>
                    <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-500">{t(active ? "Begitu periode ini selesai, ringkasan pemasukan, pengeluaran, dan kategori akan muncul di sini." : "Aktifkan laporan otomatis untuk menyimpan ringkasan dan CSV privat setiap bulan.")}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5"><LockKeyhole className="h-3.5 w-3.5 text-emerald-700" />{t("Privat untuk akunmu")}</span><span className="rounded-full bg-slate-50 px-3 py-1.5">CSV</span></div>
                  </div>
                </div>
              </Surface>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <Surface key={report.id} variant="interactive" className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{formatPeriod(report.period_start, locale)}</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{t("Ringkasan {period}", { period: formatPeriod(report.period_start, locale) })}</h3>
                        <p className="mt-1 text-xs text-slate-500">{t("Dibuat {date}", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generated_at)) })}</p>
                      </div>
                      <Button variant="secondary" size="compact" loading={openingReportId === report.id} disabled={openingReportId !== null} onClick={() => void downloadReport(report)}>
                        <Download className="h-4 w-4" /> {t("Unduh CSV")}
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      {report.currency_groups.map((group) => {
                        const categories = report.category_totals.filter((item) => item.currency === group.currency).slice(0, 5);
                        return (
                          <div key={group.currency} className="rounded-2xl border border-emerald-100 bg-emerald-50/55 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <strong className="text-base text-slate-900">{group.currency}</strong>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${group.rate.state === "fresh" ? "bg-white text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{t(group.rate.state === "fresh" ? "Kurs tersedia" : "Kurs tidak tersedia")}</span>
                            </div>
                            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                              <div><dt className="text-xs text-slate-500">{t("Pemasukan")}</dt><dd className="mt-1 font-bold text-emerald-700">{formatMoney(group.income, group.currency, locale)}</dd></div>
                              <div><dt className="text-xs text-slate-500">{t("Pengeluaran")}</dt><dd className="mt-1 font-bold text-rose-600">{formatMoney(group.expense, group.currency, locale)}</dd></div>
                              <div><dt className="text-xs text-slate-500">{t("Bersih")}</dt><dd className="mt-1 font-bold text-slate-900">{formatMoney(group.net, group.currency, locale)}</dd></div>
                            </dl>
                            {categories.length > 0 && <div className="mt-4 border-t border-emerald-100 pt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("Kategori pengeluaran teratas")}</p><ol className="mt-2 space-y-1.5">{categories.map((item) => <li key={`${item.currency}:${item.category}`} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-slate-600">{t(item.category)}</span><strong className="shrink-0 text-slate-800">{formatMoney(item.amount, item.currency, locale)}</strong></li>)}</ol></div>}
                          </div>
                        );
                      })}
                    </div>
                  </Surface>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function formatPeriod(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toLocaleString(locale)}`;
  }
}

function ReportsSkeleton() {
  return <div aria-label="Memuat laporan bulanan" className="grid animate-pulse gap-4 lg:grid-cols-2"><div className="h-72 rounded-2xl border border-emerald-100 bg-white/80" /><div className="h-72 rounded-2xl border border-emerald-100 bg-white/80" /></div>;
}
