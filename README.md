# FinTrack

PWA pencatat keuangan pribadi yang menerima transaksi manual dari dashboard dan transaksi otomatis dari bot Telegram melalui n8n.

## Yang tersedia

- Magic-link login dengan Supabase Auth
- Dashboard ringkasan net worth IDR, arus kas bulanan, saldo akun, kategori, dan transaksi yang menunggu konfirmasi
- Rekening, e-wallet, broker, dan kewajiban dengan transfer antar-akun yang memperbarui saldo secara atomik
- Tambah, ubah, filter, ekspor CSV, pulihkan, dan soft-delete transaksi yang ditautkan ke akun sumber
- Manajemen kategori
- Workflow n8n untuk pesan teks Telegram dan OCR struk menggunakan Gemini
- PWA manifest, service worker, dan ikon aplikasi

## Menjalankan dashboard

1. Salin `.env.example` menjadi `.env.local`, lalu isi kredensial Supabase publik Anda.
2. Jalankan `supabase/schema.sql`, lalu seluruh berkas di `supabase/migrations/` secara berurutan pada SQL Editor Supabase. Ini juga diperlukan pada database baru karena akun, transfer, dan trigger saldo berada di migration. Untuk database lama, jangan lewati migration yang sudah ada.
3. Instal dependensi dan mulai aplikasi:

```bash
npm install
npm run dev
```

## Menghubungkan bot

1. Import workflow yang diperlukan dari `n8n/` ke instance n8n Anda. Dua workflow transaksi menangani Telegram; `forex-trade-review-workflow.json` menangani review satu trade; `forex-weekly-review-workflow.json` menghasilkan laporan mingguan.
2. Pasang Telegram credential pada node trigger dan pengirim pesan.
3. Atur environment variable berikut di n8n: `TELEGRAM_ALLOWED_USER_ID`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `SUPABASE_USER_ID`. Untuk review satu trade, tambahkan juga `N8N_TRADE_REVIEW_SHARED_SECRET` yang sama dengan aplikasi. Service role hanya boleh berada di n8n/server—jangan pernah dimasukkan ke `.env.local` frontend atau dibagikan.
4. Buat bucket Supabase Storage privat bernama `receipts-temp`, lalu pastikan policy bucket mengizinkan service yang digunakan n8n menulis objek.
5. Uji tiap workflow secara manual dengan satu pesan dan satu struk sebelum mengaktifkannya. Workflow sengaja tersimpan nonaktif agar import tidak langsung memproses pesan pada environment yang belum dikonfigurasi.

Untuk review trade dari aplikasi, salin `.env.example` menjadi `.env.local` lalu isi dua variabel `N8N_TRADE_REVIEW_*`; gunakan production webhook URL n8n setelah workflow diaktifkan. AI menyimpan hasil sebagai `ai_trade_reviews` dan tidak punya jalur untuk mengubah transaksi, saldo, atau trade.

## Kualitas kode

```bash
npm run lint
npx tsc --noEmit
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=moderate
```

## Kontrak data transaksi

Kolom `transactions.category` adalah nama kategori (teks), bukan UUID. Kontrak ini digunakan konsisten oleh frontend dan kedua workflow n8n. Nama kategori disimpan sebagai snapshot agar transaksi lama tetap terbaca jika kategori kemudian diubah atau dihapus.
