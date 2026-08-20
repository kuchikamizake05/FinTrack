export default function RootLoading() {
  return (
    <div className="app-page">
      <div className="sticky top-0 z-40 hidden h-[76px] w-full border-b border-[color:rgba(18,53,36,0.15)] bg-[color:rgba(233,248,238,0.92)] md:block" />
      <div className="sticky top-0 z-40 h-[74px] w-full border-b border-[color:rgba(18,53,36,0.15)] bg-[color:rgba(233,248,238,0.94)] md:hidden" />

      <main className="app-page-content space-y-5 sm:space-y-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-28 rounded-md bg-emerald-900/10" />
          <div className="h-8 w-48 rounded-xl bg-emerald-900/15" />
          <div className="h-4 w-72 rounded-md bg-emerald-900/10" />
        </div>

        <div className="grid animate-pulse gap-3 sm:grid-cols-3">
          <div className="h-24 rounded-2xl border border-emerald-100 bg-white/80" />
          <div className="h-24 rounded-2xl border border-emerald-100 bg-white/80" />
          <div className="h-24 rounded-2xl border border-emerald-100 bg-white/80" />
        </div>

        <div className="animate-pulse rounded-2xl border border-emerald-100 bg-white/80 p-6">
          <div className="h-6 w-40 rounded-lg bg-emerald-900/10" />
          <div className="mt-4 space-y-3">
            <div className="h-14 rounded-xl bg-slate-50" />
            <div className="h-14 rounded-xl bg-slate-50" />
            <div className="h-14 rounded-xl bg-slate-50" />
          </div>
        </div>
      </main>
    </div>
  );
}
