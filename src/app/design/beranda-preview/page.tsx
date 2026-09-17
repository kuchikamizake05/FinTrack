"use client";

import { useCallback, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Bell, ChartNoAxesCombined, Check, ChevronRight, Eye, EyeOff, Ellipsis, Flame, Goal, House, Plus, ReceiptText, ScanLine, WalletCards, X, PieChart, CalendarDays, UserRound } from "lucide-react";
import { DialogFrame } from "@/components/ui/DialogFrame";

const shortcuts = [
  { name: "Budget", icon: PieChart, color: "bg-emerald-50 text-emerald-700", detail: "Atur batas pengeluaran dan lihat sisa anggaran tiap kategori." },
  { name: "Goals", icon: Goal, color: "bg-emerald-50 text-emerald-700", detail: "Pantau target tabungan dan dana darurat di ruang khusus." },
  { name: "Portofolio", icon: ChartNoAxesCombined, color: "bg-emerald-50 text-emerald-700", detail: "Investasi dan trading tetap tersedia melalui Portofolio." },
  { name: "Analisis", icon: ChartNoAxesCombined, color: "bg-emerald-50 text-emerald-700", detail: "Pahami pola pengeluaran dan langkah yang bisa kamu ambil." },
];
const initialTransactions = [
  { name: "Makan siang", category: "Makan & minum · Hari ini", amount: 35000, income: false },
  { name: "Belanja mingguan", category: "Kebutuhan rumah · Kemarin", amount: 285000, income: false },
  { name: "Gaji September", category: "Pemasukan · 1 Sep", amount: 8000000, income: true },
];
const budgetProgress = [
  { name: "Kebutuhan", spent: 1860000, limit: 2500000, tone: "bg-violet-400", icon: "🍽️" },
  { name: "Keinginan", spent: 640000, limit: 1500000, tone: "bg-orange-400", icon: "🛍️" },
  { name: "Tabungan", spent: 500000, limit: 1000000, tone: "bg-sky-400", icon: "🌱" },
];
const activeCalendarDays = new Map([[2, "-675K"], [5, "-78K"], [8, "-150K"], [11, "-32K"], [15, "-100K"], [16, "-35K"], [18, "-285K"], [22, "+8JT"], [25, "-90K"]]);
const currency = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

export default function BerandaPreview() {
  const [visible, setVisible] = useState(true);
  const [panel, setPanel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewedToday, setReviewedToday] = useState(false);
  const close = useCallback(() => { setPanel(null); setSaved(false); }, []);
  const money = (amount: number) => visible ? currency(amount) : "Rp••••••";
  const open = (name: string) => { setSaved(false); setPanel(name); };

  return (
    <div className="min-h-dvh bg-[var(--canvas-soft)] font-sans text-slate-900 selection:bg-[#dcf3a0]">
      <div className="mx-auto max-w-[1100px] lg:grid lg:grid-cols-[1fr_440px] lg:gap-20 lg:px-12">
        <aside className="hidden self-start pt-28 lg:sticky lg:top-0 lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#587060]">FinTrack / revisi tahap 01</p>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.15] tracking-tight">Tetap FinTrack.<br />Lebih tertata.</h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-[#526759]">Identitas yang sudah kamu kenal, dengan susunan informasi dan akses fitur yang lebih mudah dipahami.</p>
          <div className="mt-10 space-y-5 border-t border-[#bccbbf] pt-7 text-sm">
            <p><strong className="mr-4 text-[#63806b]">01</strong> Anggaran yang bisa dipakai</p>
            <p><strong className="mr-4 text-[#63806b]">02</strong> Fitur sehari-hari mudah ditemukan</p>
            <p><strong className="mr-4 text-[#63806b]">03</strong> Detail hadir saat kamu butuh</p>
          </div>
          <p className="mt-10 max-w-sm text-xs leading-6 text-[#627369]">Pratinjau interaktif tahap pertama. Seluruh angka adalah data contoh. Coba tombol mata, pintasan, dan navigasi bawah.</p>
        </aside>

        <div className="relative mx-auto min-h-dvh w-full max-w-[440px] bg-[linear-gradient(180deg,#e9f8ee_0px,#f7fbf8_340px,#f8faf9_100%)] shadow-xl">
          <div className="bg-emerald-100 px-5 py-2 text-center text-[11px] font-semibold text-emerald-800">PRATINJAU · DATA CONTOH · TAHAP 1</div>
          <header className="flex min-h-[74px] items-center justify-between border-b border-emerald-900/15 bg-[#e9f8ee]/95 px-5 py-3">
            <div className="flex items-center gap-2.5 text-[var(--brand-ink)]"><span className="grid size-[38px] place-items-center rounded-full bg-[var(--brand-ink)]">
              {/* Same local brand asset used by BrandLogo; plain image also works in the standalone preview. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/fintrack-mark.png" width={28} height={28} alt="" className="rounded-full object-cover" />
            </span><span className="text-xl font-black tracking-[-0.06em]">FinTrack</span></div>
            <button onClick={() => open("Profil")} aria-label="Buka profil" className="grid size-[42px] place-items-center rounded-full bg-[var(--brand-ink)] text-[var(--brand-lime)] shadow-[0_6px_0_rgba(18,53,36,0.10)]"><UserRound size={18} /></button>
          </header>

          <main id="main-content" tabIndex={-1} className="px-5 pt-4 pb-32 outline-none">
            <div className="mb-4 flex items-end justify-between gap-2">
              <div><p className="text-[13px] font-semibold text-emerald-700">Selamat datang, Adi</p><h2 className="mt-1 text-[27px] font-extrabold tracking-tight">Keuanganmu</h2></div>
              <button onClick={() => setVisible(!visible)} aria-label={visible ? "Sembunyikan nominal" : "Tampilkan nominal"} aria-pressed={!visible} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#627365]">{visible ? <Eye size={19} /> : <EyeOff size={19} />}</button>
            </div>

            <section className="rounded-[24px] bg-[#173c32] p-4 text-white shadow-[0_12px_28px_#214c391b]" aria-label="Ringkasan anggaran">
              <div className="flex items-center justify-between text-xs text-[#d0dece]"><span className="flex items-center gap-1.5"><CalendarDays size={14} /> September 2026</span><span>16 dari 30 hari</span></div>
              <p className="mt-3 text-sm font-medium text-[#dbe7d8]">Sisa anggaran bulan ini</p>
              <p className="mt-1 text-[29px] font-extrabold tracking-[-0.045em] text-[#ffffff]">{money(2250000)}</p>
              <p className="mt-1.5 text-xs leading-5 text-[#d2e1d3]">Dari anggaran {money(5000000)} yang kamu atur.</p>
              <div role="progressbar" aria-label="Anggaran terpakai" aria-valuenow={55} aria-valuemin={0} aria-valuemax={100} className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[55%] rounded-full bg-[var(--brand-lime)]" /></div>
              <div className="mt-2 flex justify-between text-[11px] text-[#d2e1d3]"><span>55% terpakai</span><button onClick={() => open("Budget")} className="flex min-h-8 items-center gap-1 font-bold text-white">Lihat budget <ArrowRight size={13} /></button></div>
              <div className="mt-2 grid grid-cols-2 gap-4 border-t border-white/15 pt-3">
                <div><p className="flex items-center gap-1 text-xs text-[#d2e1d3]"><ArrowDownLeft size={14} /> Pemasukan</p><p className="mt-1 text-base font-bold">{money(8000000)}</p></div>
                <div><p className="flex items-center gap-1 text-xs text-[#d2e1d3]"><ArrowUpRight size={14} /> Pengeluaran</p><p className="mt-1 text-base font-bold">{money(2750000)}</p></div>
              </div>
            </section>

            <section aria-label="Streak review harian" className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-orange-100 text-orange-600"><Flame aria-hidden="true" className="size-[18px]" /></span><div><h3 className="text-sm font-bold text-slate-800">Jaga ritmemu</h3><p role="status" className="text-[11px] text-slate-600">{reviewedToday ? 4 : 3} hari berturut-turut</p></div></div><span className="text-[11px] font-semibold text-slate-500">Rekor: 7 hari</span></div>
              <div aria-label="Riwayat tujuh hari terakhir" className="mt-2.5 grid grid-cols-7 gap-1.5">
                {["Kam", "Jum", "Sab", "Min", "Sen", "Sel", "Rab"].map((day, index) => {
                  const completed = (index >= 3 && index <= 5) || (index === 6 && reviewedToday);
                  return <button type="button" key={day} disabled={index !== 6 || reviewedToday} onClick={() => setReviewedToday(true)} aria-label={`${10 + index} September, ${day}: ${completed ? "sudah review" : "belum review"}${index === 6 ? ", hari ini" : ""}`} className="flex min-h-[50px] flex-col items-center justify-start text-[10px] font-bold disabled:cursor-default"><span className="mb-1 text-[9px] font-semibold text-slate-500">{day}</span><span className={`grid size-8 place-items-center rounded-full transition-transform ${completed ? "bg-orange-600 text-white shadow-[0_4px_10px_rgba(234,88,12,0.22)]" : index === 6 ? "border-2 border-orange-500 bg-white text-orange-700 shadow-[0_3px_8px_rgba(234,88,12,0.12)]" : "bg-orange-100 text-orange-300"}`}>{completed ? <Flame aria-hidden="true" size={15} fill="currentColor" /> : 10 + index}</span></button>;
                })}
              </div>
            </section>

            <button onClick={() => open("Tagihan internet")} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-200 px-4 py-3 text-left">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Bell size={19} /></span>
              <span className="flex-1"><strong className="block text-sm">Internet jatuh tempo 2 hari lagi</strong><span className="mt-1 block text-xs text-[#79694c]">{money(325000)} · Siapkan dari dompet BCA</span></span><ChevronRight size={17} />
            </button>

            <section className="mt-5" aria-label="Pintasan fitur">
              <h3 className="text-base font-extrabold">Rencanakan & pantau</h3>
              <div className="mt-3 grid grid-cols-4 gap-2">{shortcuts.map(({ name, icon: Icon, color }) => <button key={name} onClick={() => open(name)} className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-xs font-bold"><span className={`grid size-[52px] place-items-center rounded-xl ${color}`}><Icon size={22} strokeWidth={1.7} /></span>{name}</button>)}</div>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-[var(--shadow-control)]" aria-label="Progres pengeluaran">
              <div className="flex items-center justify-between"><div><h3 className="text-base font-extrabold">Progres pengeluaran</h3><p className="mt-0.5 text-[11px] text-slate-500">September 2026</p></div><button onClick={() => open("Budget")} className="min-h-9 text-xs font-bold text-emerald-700">Lihat detail →</button></div>
              <div className="mt-4 space-y-4">{budgetProgress.map((item) => {
                const percent = Math.round((item.spent / item.limit) * 100);
                return <button onClick={() => open("Budget")} key={item.name} className="block w-full text-left"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-slate-50 text-base">{item.icon}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="text-xs text-slate-800">{item.name}</strong><strong className="text-xs text-slate-800">{money(item.spent)}</strong></span><span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${item.tone}`} style={{ width: `${percent}%` }} /></span><span className="mt-1 block text-right text-[10px] text-slate-500">dari {money(item.limit)}</span></span></div></button>;
              })}</div>
            </section>

            <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-[var(--shadow-control)]" aria-label="Aktivitas bulan ini">
              <div className="flex items-center justify-between"><div><h3 className="text-base font-extrabold">Aktivitas bulan ini</h3><p className="mt-0.5 text-[11px] text-slate-500">September 2026</p></div><button onClick={() => open("Transaksi")} className="min-h-9 text-xs font-bold text-emerald-700">Semua →</button></div>
              <div className="mt-4 grid grid-cols-7 gap-y-2 text-center">{["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map(day => <span key={day} className="text-[9px] font-bold text-slate-400">{day}</span>)}{Array.from({ length: 2 }).map((_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: 30 }).map((_, index) => { const day = index + 1; const amount = activeCalendarDays.get(day); const today = day === 16; return <button key={day} onClick={() => amount && open("Transaksi")} aria-label={`${day} September${amount ? `, aktivitas ${amount}` : ""}${today ? ", hari ini" : ""}`} className={`relative mx-auto grid size-[34px] place-items-center rounded-lg text-[10px] font-semibold ${today ? "ring-2 ring-emerald-500 ring-offset-1" : amount ? "bg-emerald-50 text-emerald-800" : "text-slate-500"}`}><span className="self-start pt-1">{day}</span>{amount && <span className={`absolute bottom-0.5 text-[7px] font-bold ${amount.startsWith("+") ? "text-emerald-600" : "text-rose-500"}`}>{amount}</span>}</button>; })}</div>
            </section>

            <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-white" aria-label="Transaksi terbaru">
              <div className="flex items-center justify-between px-4 pb-1 pt-4"><h3 className="text-base font-extrabold">Aktivitas terbaru</h3><button onClick={() => open("Transaksi")} className="min-h-11 text-xs font-bold text-[#38724e]">Lihat semua →</button></div>
              {initialTransactions.map((item, i) => <button key={item.name} onClick={() => open(item.name)} className="flex w-full items-center gap-3 border-b border-[#f0f2ed] px-4 py-4 text-left last:border-0"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.income ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.income ? <ArrowDownLeft size={18} /> : <ReceiptText size={18} />}</span><span className="min-w-0 flex-1"><strong className="block text-[13px]">{item.name}</strong><span className="mt-1 block text-[10px] text-[#778276]">{item.category}</span></span><span className={`text-[12px] font-extrabold ${i === 2 ? "text-[#347347]" : ""}`}>{visible ? `${item.income ? "+" : "−"}${money(item.amount)}` : money(item.amount)}</span></button>)}
            </section>
            <section className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-[var(--shadow-control)]" aria-label="Goal terdekat">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Goal terdekat</p><h3 className="mt-1 text-base font-extrabold">Dana darurat</h3></div><button onClick={() => open("Goals")} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Lihat goals</button></div>
              <div className="mt-4 flex items-center gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-xl">🚨</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-xs font-semibold"><span>{money(14500000)}</span><span className="text-slate-500">97%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full w-[97%] rounded-full bg-emerald-600" /></div><p className="mt-2 text-[11px] text-slate-500">Tinggal {money(500000)} menuju targetmu.</p></div></div>
            </section>
            <p className="mt-5 text-center text-[11px] text-[#778276]">Sedikit dicatat, lebih banyak dipahami.</p>
          </main>

          <nav aria-label="Navigasi pratinjau" className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[440px] grid-cols-5 items-end border-t border-emerald-900/10 bg-[var(--brand-cream)]/95 px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:left-auto lg:right-auto lg:w-[440px]">
            {[{ name: "Beranda", icon: House }, { name: "Dompet", icon: WalletCards }, { name: "Catat", icon: Plus }, { name: "Transaksi", icon: ReceiptText }, { name: "Lainnya", icon: Ellipsis }].map(({ name, icon: Icon }) => <button key={name} aria-current={name === "Beranda" ? "page" : undefined} onClick={() => name === "Beranda" ? window.scrollTo({ top: 0, behavior: "smooth" }) : open(name)} className={`flex min-h-14 flex-col items-center gap-1.5 rounded-xl text-[10px] font-bold ${name === "Beranda" ? "text-[#24573a]" : "text-[#6c786b]"}`}><span className={`grid place-items-center ${name === "Catat" ? "-mt-5 size-14 rounded-full border-4 border-[var(--brand-cream)] bg-[var(--brand-primary)] text-white shadow-md" : "mt-1 h-7 w-11"}`}><Icon size={name === "Catat" ? 26 : 21} strokeWidth={name === "Beranda" ? 2.5 : 1.8} /></span>{name}</button>)}
          </nav>
        </div>
      </div>

      {panel && <DialogFrame titleId="preview-dialog-title" onClose={close} contentClassName="max-w-[440px] rounded-t-3xl sm:rounded-2xl bg-[var(--canvas)] p-6 text-slate-900">
        <div className="flex items-center justify-between"><h2 id="preview-dialog-title" className="text-xl font-extrabold">{panel === "Catat" ? "Mau catat apa?" : panel}</h2><button onClick={close} aria-label="Tutup" className="grid size-11 place-items-center rounded-full bg-emerald-50"><X size={20} /></button></div>
        <p className="mt-3 text-xs leading-5 text-[#687566]">Pratinjau alur · tidak mengubah data keuanganmu.</p>
        {panel === "Lainnya" ? <div className="mt-5 space-y-2">{[...shortcuts.map(s => s.name), "Scan struk", "Pengaturan"].map(name => <button key={name} onClick={() => open(name)} className="flex min-h-12 w-full items-center justify-between rounded-xl bg-white px-4 text-sm font-bold">{name}<ChevronRight size={16} /></button>)}</div>
          : panel === "Catat" ? <div className="mt-5 space-y-3">{saved ? <p role="status" className="flex gap-2 rounded-xl bg-[#e3efd6] p-4 text-sm"><Check size={19} /> Pilihan berhasil dicoba. Form lengkap dibuat pada tahap berikutnya.</p> : ["Pengeluaran", "Pemasukan", "Transfer", "Scan struk"].map(name => <button key={name} onClick={() => setSaved(true)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#dfe5d7] bg-white px-4 text-sm font-bold">{name === "Scan struk" ? <ScanLine size={20} /> : <Plus size={20} />}{name}<ChevronRight className="ml-auto" size={16} /></button>)}</div>
          : <div className="mt-5 rounded-2xl bg-white p-5 text-sm leading-7">{shortcuts.find(s => s.name === panel)?.detail ?? (panel === "Dompet" ? "Saldo, rekening, dan transfer punya akses langsung dari navigasi bawah." : panel === "Transaksi" ? "Semua catatan keuangan, pencarian, dan filter berada di sini." : panel === "Tagihan internet" ? `Internet rumah · ${money(325000)} · jatuh tempo 18 September 2026. Pengingat ini membantumu menyiapkan dana lebih awal.` : initialTransactions.some(t => t.name === panel) ? `${panel} · ${money(initialTransactions.find(t => t.name === panel)!.amount)}. Rincian dan pengeditan transaksi akan dirancang pada tahap berikutnya.` : "Bagian ini akan dirancang pada tahap berikutnya setelah Beranda disetujui.")}<p className="mt-3 text-xs text-[#778276]">Saat ini kita menilai penempatan menu dan tampilan Beranda.</p></div>}
      </DialogFrame>}
    </div>
  );
}
