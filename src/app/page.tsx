"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X, TrendingUp, Sparkles, PiggyBank } from "lucide-react";
import { buttonStyles } from "@/components/ui/button-styles";
import BrandLockup from "@/components/BrandLockup";
import BrandLogo from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "./landing.module.css";
import LandingVisual from "@/components/LandingVisual";
import HeroDeck from "@/components/HeroDeck";

export default function LandingPage() {
  const { language } = useLanguage();
  const copy = (id: string, en: string) => language === "id" ? id : en;
  const root = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);
  const sections = [
    { id: "overview", label: copy("Ringkasan", "Overview") },
    { id: "cashflow", label: copy("Arus kas", "Cash flow") },
    { id: "investments", label: copy("Investasi", "Investments") },
    { id: "insights", label: "Insights" },
    { id: "privacy", label: copy("Privasi", "Privacy") },
  ];
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.visible);
        }
      });
    }, { threshold: 0.12 });
    root.current?.querySelectorAll("[data-reveal]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return <main ref={root} id="main-content" tabIndex={-1} className={styles.page}>
    <header className={styles.nav}>
      <BrandLockup href="/" priority />
      <nav className={styles.desktopNav} aria-label={copy("Navigasi utama", "Main navigation")}>
        {sections.slice(1).map(section => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
      </nav>
      <div className={styles.navActions}><LanguageSwitcher compact /><Link className={`${styles.login} ${buttonStyles({variant: "secondary"})}`} href="/login">{copy("Masuk", "Log in")}</Link><Link className={buttonStyles()} href="/login">{copy("Mulai gratis", "Get started")}</Link></div>
      <button className={styles.menuButton} aria-expanded={menu} aria-controls="landing-menu" aria-label={copy("Menu navigasi", "Navigation menu")} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      {menu && <nav id="landing-menu" className={styles.mobileNav}><LanguageSwitcher compact />{sections.map(section => <a onClick={() => setMenu(false)} key={section.id} href={`#${section.id}`}>{section.label}</a>)}<Link href="/login">{copy("Masuk", "Log in")}</Link></nav>}
    </header>
    <section className={styles.hero} id="overview" data-reveal>
      <div className={styles.atmosphere} aria-hidden="true"><i /><i /><i /></div>
      <HeroDeck />
      <div className={styles.heroContent}><h1>{copy("Keuangan yang lebih jelas, untuk setiap rencana hidupmu.", "A clearer view of your money. For every chapter of life.")}</h1><Link className={buttonStyles()} href="/login">{copy("Mulai dengan FinTrack", "Get started with FinTrack")}</Link></div>
    </section>
    <section className={styles.manifesto} data-reveal><h2>{copy("Dari pengeluaran kecil hari ini, sampai rencana besar nanti. Semua bagian keuanganmu, dalam satu pandangan yang utuh.", "From the little things today to the big plans ahead. Every part of your financial life, together in one clear picture.")}</h2></section>
    <LandingVisual />
    <section className={`${styles.panel} ${styles.cashflow}`} id="cashflow" data-reveal>
      <div className={styles.panelCopy}><p>{copy("Arus kas", "Cash flow")}</p><h2>{copy("Kenali uang yang datang. Pahami ke mana ia pergi.", "Know what comes in. Understand what goes out.")}</h2><Link className={styles.arrowButton} href="/transactions" aria-label={copy("Buka transaksi", "Explore transactions")}><ArrowRight /></Link></div>
      <div className={styles.statement} aria-label={copy("Contoh ringkasan, data ilustrasi", "Example summary, illustrative data")}><span>FinTrack</span><p>{copy("Bulan ini, dalam genggaman.", "Your month, at a glance.")}</p><strong>Rp24.860.000</strong><small>{copy("Saldo bersih · Data ilustrasi", "Net balance · Illustrative data")}</small><div className={styles.barChart} aria-hidden="true">{[25,40,32,56,49,76,88].map((height,i) => <i key={i} style={{height:`${height}%`}} />)}</div><div className={styles.statementBottom}><span>{copy("Pemasukan", "Income")}<b>Rp8.500.000</b></span><span>{copy("Pengeluaran", "Expenses")}<b>Rp3.740.500</b></span></div></div>
    </section>
    <section className={`${styles.panel} ${styles.investments}`} id="investments" data-reveal>
      <div className={styles.panelCopy}><p>{copy("Investasi & target", "Investments & goals")}</p><h2>{copy("Rencana jangka panjang. Gambaran yang selalu dekat.", "Long-term plans. A picture that’s always within reach.")}</h2><Link className={styles.arrowButton} href="/investments" aria-label={copy("Buka investasi", "Explore investments")}><ArrowRight /></Link></div>
      <div className={styles.appPreview}>
        <div className={styles.previewHeading}><span>{copy("Investasi", "Investments")}</span><small>{copy("Data ilustrasi", "Illustrative data")}</small></div>
        <div className={styles.investmentBalance}><span>{copy("Nilai investasi", "Investment value")}</span><strong>Rp18.750.000</strong><small><TrendingUp size={15} aria-hidden="true" /> +Rp1.250.000 (7,14%)</small></div>
        <div className={styles.previewSurface}><h3>{copy("Alokasi aset", "Asset allocation")}</h3><div className={styles.allocation} aria-hidden="true"><i /><i /><i /></div>{[[copy("Reksa dana", "Mutual funds"), "50%"], [copy("Saham", "Stocks"), "30%"], [copy("Emas", "Gold"), "20%"]].map(([label,value],index) => <div className={styles.assetRow} key={label}><i data-tone={index} /><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className={styles.previewSurface}><div className={styles.goalHeading}><PiggyBank size={21} aria-hidden="true" /><div><h3>{copy("Dana darurat", "Emergency fund")}</h3><small>Rp15.600.000 / Rp20.000.000</small></div><strong>78%</strong></div><div className={styles.goalProgress} aria-hidden="true"><i /></div></div>
      </div>
    </section>
    <section className={`${styles.panel} ${styles.insights}`} id="insights" data-reveal>
      <div className={styles.panelCopy}><p>{copy("Insight keuangan", "Financial insights")}</p><h2>{copy("Lebih sedikit menebak. Lebih banyak memahami.", "Less guesswork. More understanding.")}</h2><Link className={styles.arrowButton} href="/insights" aria-label={copy("Buka analisis", "Explore insights")}><ArrowRight /></Link></div>
      <div className={styles.appPreview}>
        <div className={styles.previewHeading}><span>{copy("Analisis bulan ini", "This month’s insights")}</span><small>{copy("Data ilustrasi", "Illustrative data")}</small></div>
        <div className={styles.previewSurface}><div className={styles.insightLabel}><Sparkles size={18} aria-hidden="true" />{copy("Ringkasan keuangan", "Financial review")}</div><h3 className={styles.insightTitle}>{copy("Pengeluaranmu lebih terkendali.", "Your spending is more in control.")}</h3><p>{copy("Pengeluaran makan turun 18% dibanding bulan lalu. Ada lebih banyak ruang untuk target tabunganmu.", "Food spending is down 18% from last month. There’s more room for your savings goals.")}</p><div className={styles.comparison}><div><span>{copy("Bulan lalu", "Last month")}</span><i style={{width:"100%"}} /><strong>Rp1.000.000</strong></div><div><span>{copy("Bulan ini", "This month")}</span><i style={{width:"82%"}} /><strong>Rp820.000</strong></div></div></div>
        <div className={styles.previewSurface}><h3>{copy("Langkah berikutnya", "Your next step")}</h3><p>{copy("Tinjau anggaran makan dan sisihkan selisihnya ke dana darurat.", "Review your food budget and set aside the difference for your emergency fund.")}</p><Link className={buttonStyles({variant:"secondary",size:"compact"})} href="/planning">{copy("Lihat anggaran", "View budget")}<ArrowRight size={14} aria-hidden="true" /></Link></div>
      </div>
    </section>
    <section className={styles.tools} data-reveal><h2>{copy("Tempat untuk setiap bagian keuanganmu.", "A place for every part of your money.")}</h2><div>{[
      ["/accounts", copy("Dompet & rekening", "Wallets & accounts"), copy("Lihat saldo di satu tempat.", "Your balances, together.")],
      ["/planning", copy("Anggaran & target", "Budgets & goals"), copy("Beri arah untuk setiap rupiah.", "Give every dollar a direction.")],
      ["/reports", copy("Laporan bulanan", "Monthly reports"), copy("Luangkan waktu untuk melihat kembali.", "Take a moment to look back.")],
    ].map(([href,title,description]) => <Link href={href} key={href}><h3>{title}</h3><p>{description}</p><ArrowRight aria-hidden="true" /></Link>)}</div></section>
    <section className={`${styles.panel} ${styles.privacy}`} id="privacy" data-reveal><div className={styles.panelCopy}><p>{copy("Privasi sejak awal", "Private from the start")}</p><h2>{copy("Uangmu punya cerita. Hanya kamu yang perlu tahu.", "Your money tells a story. Yours to keep.")}</h2><p className={styles.description}>{copy("Catatan keuangan terhubung ke akunmu. Kamu mengatur, meninjau, dan mengakses datamu sendiri.", "Your financial records belong to your account. You manage, review, and access your own data.")}</p></div><div className={styles.privacyArt} aria-hidden="true"><BrandLogo size={170} /></div></section>
    <section className={styles.finalCta} data-reveal><h2>{copy("Mulai dari hari ini. Untuk hidup yang kamu rencanakan.", "Start with today. For the life you’re planning.")}</h2><Link className={buttonStyles()} href="/login">{copy("Mulai gratis", "Get started free")}</Link></section>
    <footer className={styles.footer}><BrandLockup href="/" /><p>{copy("Ruang tenang untuk keuangan pribadimu.", "A calmer place for your personal finances.")}</p><Link href="/login">{copy("Masuk ke akun", "Log in to your account")}</Link><span>© 2026 FinTrack</span></footer>
  </main>;
}
