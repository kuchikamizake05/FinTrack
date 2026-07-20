# FinTrack

FinTrack adalah PWA pencatat keuangan pribadi untuk transaksi manual, akun dan saldo, investasi, jurnal trading, serta otomasi Telegram melalui n8n.

## Fitur utama

- Magic-link login dengan Supabase Auth
- Dashboard net worth IDR, arus kas bulanan, saldo akun, dan transaksi tertunda
- Rekening, e-wallet, broker, kewajiban, dan transfer antar-akun atomik
- Manajemen transaksi dan kategori dengan ekspor CSV dan soft delete
- Portofolio investasi, jurnal trading, AI trade review, dan Smart Insights
- PWA installable dengan offline fallback
- Workflow n8n untuk teks Telegram, OCR struk, dan review trading

## Menjalankan aplikasi

Persyaratan: Node.js 20.9 atau lebih baru dan sebuah proyek Supabase.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Isi `.env.local` dengan konfigurasi milikmu. Variabel `NEXT_PUBLIC_*` memang dikirim ke browser; provider key, service-role key, shared secret, dan webhook privat harus tetap server-only.

Untuk database baru, jalankan `supabase/schema.sql`, lalu migration dalam `supabase/migrations/` berdasarkan urutan nama file. Jangan mengubah migration yang sudah diterapkan; tambahkan migration baru untuk perubahan berikutnya.

## Integrasi n8n

Workflow dalam `n8n/` adalah template nonaktif dan tidak menyimpan credential nyata. Setelah import:

1. Hubungkan credential Telegram pada node terkait.
2. Atur `TELEGRAM_ALLOWED_USER_ID`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `SUPABASE_USER_ID` di environment n8n.
3. Untuk review trade, tambahkan `N8N_TRADE_REVIEW_SHARED_SECRET` yang sama dengan environment server aplikasi.
4. Buat bucket privat `receipts-temp` dan policy akses yang sesuai.
5. Uji menggunakan data dummy sebelum mengaktifkan workflow.

Jangan mengekspor credential n8n ke repository. Gunakan suffix `.private.json` untuk export lokal agar otomatis di-ignore.

## Kualitas kode

```bash
npm run check
npm run test:coverage
npm run audit:security
```

CI menjalankan lint, typecheck, unit test, production build, dan audit dependency untuk setiap pull request dan push ke `main`.

## Struktur dan keamanan

- [Arsitektur repository](docs/architecture.md)
- [Kebijakan keamanan](SECURITY.md)
- `.env.example` adalah satu-satunya file environment yang boleh di-commit.
- Data finansial lokal, receipt, export, database dump, audit visual, dan state tooling tidak boleh masuk Git.

Kolom `transactions.category` menyimpan nama kategori sebagai snapshot teks, bukan UUID, agar transaksi lama tetap dapat dibaca setelah kategori diubah atau dihapus.
