import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Landmark,
  LockKeyhole,
  Menu,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import styles from "./landing.module.css";

const features = [
  {
    icon: ReceiptText,
    index: "01",
    title: "Catat tanpa ribet",
    copy: "Pemasukan dan pengeluaran tersusun rapi, lengkap dengan kategori dan bukti transaksi.",
  },
  {
    icon: BarChart3,
    index: "02",
    title: "Lihat pola uangmu",
    copy: "Grafik yang jernih membantu kamu memahami kebiasaan, bukan sekadar melihat angka.",
  },
  {
    icon: Sparkles,
    index: "03",
    title: "Dapat insight nyata",
    copy: "FinTrack merangkum perubahan penting dan memberi langkah yang bisa langsung kamu ambil.",
  },
];

const activity = [
  { icon: Landmark, label: "Gaji bulanan", meta: "Hari ini", value: "+Rp8.500.000", positive: true },
  { icon: WalletCards, label: "Belanja harian", meta: "Hari ini", value: "−Rp286.500", positive: false },
  { icon: PiggyBank, label: "Dana masa depan", meta: "Kemarin", value: "+Rp1.250.000", positive: true },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <header className={styles.nav}>
          <Link className={styles.brand} href="/" aria-label="FinTrack beranda">
            <span className={styles.brandMark}><BrandLogo size={34} priority /></span>
            <span>FinTrack</span>
          </Link>

          <nav className={styles.navLinks} aria-label="Navigasi utama">
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara kerja</a>
            <a href="#keamanan">Keamanan</a>
          </nav>

          <div className={styles.navActions}>
            <Link className={styles.loginLink} href="/login">Masuk</Link>
            <Link className={styles.navCta} href="/dashboard">Mulai sekarang</Link>
          </div>

          <details className={styles.mobileMenu}>
            <summary aria-label="Buka menu navigasi"><Menu aria-hidden="true" /></summary>
            <div>
              <a href="#fitur">Fitur</a>
              <a href="#cara-kerja">Cara kerja</a>
              <a href="#keamanan">Keamanan</a>
              <Link href="/login">Masuk</Link>
            </div>
          </details>
        </header>

        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> Keuangan pribadi, tanpa kabut</p>
          <h1>Uangmu.<br /><em>Lebih jelas.</em></h1>
          <p className={styles.heroText}>
            Satu tempat untuk memahami arus kas, menjaga target, dan membuat keputusan finansial dengan tenang.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href="/dashboard">
              Mulai gratis <ArrowRight aria-hidden="true" />
            </Link>
            <a className={styles.secondaryCta} href="#cara-kerja">Lihat cara kerjanya</a>
          </div>
          <p className={styles.reassurance}><Check aria-hidden="true" /> Gratis untuk memulai. Tidak perlu kartu.</p>
        </div>

        <div className={styles.productStage} aria-label="Pratinjau dashboard FinTrack">
          <div className={styles.orbitOne} />
          <div className={styles.orbitTwo} />

          <div className={styles.balanceCard}>
            <div className={styles.cardTopline}>
              <span>Saldo bersih</span>
              <span className={styles.visibility}><Eye aria-hidden="true" /> Terlihat</span>
            </div>
            <p className={styles.balance}>Rp24.860.000</p>
            <div className={styles.balanceTrend}><TrendingUp aria-hidden="true" /> 12,4% bulan ini</div>
            <div className={styles.chart} aria-hidden="true">
              <span style={{ height: "32%" }} />
              <span style={{ height: "46%" }} />
              <span style={{ height: "39%" }} />
              <span style={{ height: "64%" }} />
              <span style={{ height: "58%" }} />
              <span style={{ height: "82%" }} />
              <span style={{ height: "96%" }} />
            </div>
            <div className={styles.chartLabels}><span>1 Jul</span><span>Hari ini</span></div>
          </div>

          <div className={styles.goalCard}>
            <div className={styles.goalIcon}><PiggyBank aria-hidden="true" /></div>
            <div><span>Target darurat</span><strong>78% tercapai</strong></div>
            <div className={styles.progress}><span /></div>
          </div>

          <div className={styles.insightCard}>
            <Sparkles aria-hidden="true" />
            <div><span>Insight minggu ini</span><strong>Pengeluaran makan turun 18%</strong></div>
          </div>
        </div>
      </section>

      <div className={styles.ticker} aria-label="Ringkasan manfaat FinTrack">
        <div>
          <span>Arus kas terbaca</span><i>✦</i>
          <span>Target lebih dekat</span><i>✦</i>
          <span>Data tetap milikmu</span><i>✦</i>
          <span>Keputusan lebih tenang</span><i>✦</i>
        </div>
      </div>

      <section className={styles.features} id="fitur">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>Semua yang penting</p>
          <h2>Bukan lebih banyak angka.<br />Lebih banyak <em>kendali.</em></h2>
          <p>FinTrack mengubah catatan keuangan yang berantakan menjadi gambaran yang mudah dipahami.</p>
        </div>

        <div className={styles.featureGrid}>
          {features.map(({ icon: Icon, index, title, copy }) => (
            <article className={styles.featureCard} key={title}>
              <div className={styles.featureHead}>
                <span>{index}</span>
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <Link href="/dashboard" aria-label={`Jelajahi ${title}`}>Jelajahi <ChevronRight aria-hidden="true" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.controlSection} id="cara-kerja">
        <div className={styles.controlCopy}>
          <p className={styles.kicker}>Satu pandangan utuh</p>
          <h2>Setiap rupiah punya cerita.</h2>
          <p>
            Hubungkan semua bagian kehidupan finansialmu—rekening, transaksi, investasi, sampai jurnal trading—dalam alur yang terasa sederhana.
          </p>
          <ul>
            <li><Check aria-hidden="true" /> Ringkasan otomatis setiap saat</li>
            <li><Check aria-hidden="true" /> Kategori yang mudah disesuaikan</li>
            <li><Check aria-hidden="true" /> Insight yang fokus pada tindakan</li>
          </ul>
          <Link className={styles.darkCta} href="/dashboard">Buka dashboard <ArrowRight aria-hidden="true" /></Link>
        </div>

        <div className={styles.activityPanel}>
          <div className={styles.activityHeader}>
            <div><span>Aktivitas terbaru</span><strong>Juli 2026</strong></div>
            <button type="button" aria-label="Buka filter aktivitas">•••</button>
          </div>
          <div className={styles.activityList}>
            {activity.map(({ icon: Icon, label, meta, value, positive }) => (
              <div className={styles.activityRow} key={label}>
                <span className={styles.activityIcon}><Icon aria-hidden="true" /></span>
                <div><strong>{label}</strong><span>{meta}</span></div>
                <strong className={positive ? styles.positive : undefined}>{value}</strong>
              </div>
            ))}
          </div>
          <div className={styles.spendSummary}>
            <div><span>Pengeluaran bulan ini</span><strong>Rp3.740.500</strong></div>
            <div className={styles.donut} aria-label="62 persen anggaran terpakai"><span>62%</span></div>
          </div>
        </div>
      </section>

      <section className={styles.security} id="keamanan">
        <div className={styles.securityVisual}>
          <div className={styles.shieldRing}>
            <div><ShieldCheck aria-hidden="true" /></div>
          </div>
          <span className={styles.lockBadge}><LockKeyhole aria-hidden="true" /> Terenkripsi</span>
          <span className={styles.privateBadge}><CircleDollarSign aria-hidden="true" /> Data privat</span>
        </div>
        <div className={styles.securityCopy}>
          <p className={styles.kicker}>Aman dari awal</p>
          <h2>Uangmu privat.<br />Begitu juga datanya.</h2>
          <p>Setiap akun hanya dapat mengakses datanya sendiri. Autentikasi aman dan kebijakan database berlapis menjaga informasi tetap pada tempatnya.</p>
          <div className={styles.securityFacts}>
            <div><strong>RLS</strong><span>Proteksi per pengguna</span></div>
            <div><strong>SSL</strong><span>Koneksi terenkripsi</span></div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.ctaCoin}><CircleDollarSign aria-hidden="true" /></div>
        <p>Mulai dari satu catatan</p>
        <h2>Bikin uangmu<br /><em>masuk akal.</em></h2>
        <Link href="/dashboard">Mulai pakai FinTrack <ArrowRight aria-hidden="true" /></Link>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/" aria-label="FinTrack beranda">
          <span className={styles.brandMark}><BrandLogo size={30} /></span>
          <span>FinTrack</span>
        </Link>
        <p>Ruang tenang untuk keuangan pribadimu.</p>
        <div><a href="#fitur">Fitur</a><a href="#keamanan">Keamanan</a><Link href="/login">Masuk</Link></div>
        <span>© 2026 FinTrack</span>
      </footer>
    </main>
  );
}
