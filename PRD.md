# Product Requirements Document

## Personal Finance Chat Bot with OCR Receipt Scanner & PWA Dashboard

### 1. Ringkasan Produk

Produk ini adalah sistem pencatat keuangan pribadi yang memungkinkan pengguna mencatat transaksi melalui chat, terutama lewat Telegram. Pengguna dapat mengirim teks transaksi atau foto struk, lalu sistem akan membaca, mengekstrak, mengategorikan, menyimpan, dan menampilkan data keuangan secara otomatis di dashboard PWA.

Sistem terdiri dari empat komponen utama:

1. **Telegram Bot** sebagai interface input berbasis chat.
2. **n8n** sebagai automation engine untuk memproses pesan, OCR, parsing, dan penyimpanan data.
3. **AI/OCR Service** untuk membaca struk dan mengekstrak informasi transaksi.
4. **PWA Dashboard** untuk melihat, mengedit, memfilter, dan menganalisis transaksi.

Produk ini ditujukan untuk mengurangi friction dalam mencatat keuangan harian. Pengguna cukup mengirim pesan seperti “kopi 25000” atau mengirim foto struk, lalu transaksi tercatat otomatis.

---

## 2. Tujuan Produk

### 2.1 Tujuan Utama

Membuat sistem pencatatan keuangan pribadi yang cepat, otomatis, dan mudah digunakan lewat chat.

### 2.2 Tujuan MVP

Pada versi MVP, produk harus mampu:

* Menerima input transaksi dari Telegram.
* Menerima foto struk dari Telegram.
* Mengekstrak data transaksi dari teks atau struk.
* Menyimpan transaksi ke database.
* Mengirim ringkasan transaksi kembali ke Telegram.
* Menampilkan transaksi di dashboard PWA.
* Menampilkan ringkasan pengeluaran bulanan.
* Mengelompokkan transaksi berdasarkan kategori.
* Mengizinkan user mengedit dan menghapus transaksi dari dashboard.

### 2.3 Non-Goals MVP

Hal-hal berikut tidak termasuk dalam MVP:

* Integrasi WhatsApp.
* Multi-user public SaaS.
* Pembayaran/subscription.
* Integrasi bank otomatis.
* Scan mutasi rekening otomatis.
* Budgeting kompleks.
* Export laporan pajak.
* Native Android/iOS app.
* Full offline mode.
* AI financial advisor kompleks.

---

## 3. Target User

### 3.1 Primary User

Pengguna pribadi yang ingin mencatat pemasukan dan pengeluaran harian tanpa ribet membuka aplikasi finance manual.

### 3.2 Persona

**Nama:** Ayaka
**Kebutuhan:** Mencatat transaksi pribadi secara cepat.
**Pain Point:** Malas membuka aplikasi pencatat keuangan setiap habis belanja. Sering lupa mencatat pengeluaran kecil.
**Perilaku:** Sering menggunakan Telegram/WhatsApp, menyimpan struk, dan ingin melihat rekap bulanan.
**Solusi:** Kirim chat atau foto struk ke bot, lalu transaksi otomatis tersimpan.

---

## 4. Problem Statement

Pencatatan keuangan pribadi sering gagal karena proses input terlalu manual. User harus membuka aplikasi, memilih kategori, mengetik nominal, mengisi tanggal, dan menyimpan transaksi. Untuk transaksi kecil seperti kopi, parkir, makan, atau belanja minimarket, user sering lupa atau malas mencatat.

Selain itu, struk belanja menyimpan informasi detail, tetapi jarang dimanfaatkan karena proses input item secara manual terlalu lama.

Produk ini menyelesaikan masalah tersebut dengan membuat pencatatan bisa dilakukan lewat chat dan OCR struk.

---

## 5. Solusi Produk

Produk menyediakan bot chat yang dapat menerima:

1. **Input teks natural**
   Contoh:

   * “kopi 25000”
   * “makan siang 45000”
   * “gaji freelance 1500000”
   * “indomaret 78500 belanja harian”

2. **Input foto struk**
   User mengirim foto struk, sistem membaca merchant, tanggal, total, item, dan kategori.

3. **Dashboard PWA**
   User dapat melihat semua transaksi, grafik, filter kategori, rekap bulanan, dan melakukan edit manual.

---

## 6. Platform & Tech Stack

### 6.1 Bot Interface

* Telegram Bot API
* Telegram Trigger di n8n
* Telegram Send Message node

### 6.2 Automation Engine

* n8n self-hosted di VPS
* Docker Compose
* Webhook HTTPS via subdomain

### 6.3 AI/OCR

Pilihan layanan:

* OpenAI Vision
* Gemini Vision
* Google Cloud Vision

Untuk MVP, rekomendasi:

* Gunakan OpenAI Vision atau Gemini Vision agar OCR + parsing JSON bisa dilakukan dalam satu langkah.

### 6.4 Database

Rekomendasi utama:

* Supabase Postgres

Alternatif awal:

* Google Sheets

Untuk PRD ini, database utama diasumsikan menggunakan Supabase.

### 6.5 Frontend/PWA

* Next.js
* Tailwind CSS
* shadcn/ui
* Supabase Auth
* Recharts
* TanStack Table
* React Hook Form
* Zod
* next-pwa atau custom service worker

### 6.6 Hosting

* VPS milik sendiri
* Docker
* Caddy atau Nginx reverse proxy
* Subdomain:

  * `n8n.domain.com`
  * `finance.domain.com`

---

## 7. Arsitektur Sistem

### 7.1 High-Level Architecture

```text
User
↓
Telegram Bot
↓
n8n Workflow
↓
AI/OCR Service
↓
Supabase Database
↓
Next.js PWA Dashboard
```

### 7.2 Flow Input Teks

```text
User kirim teks transaksi
↓
Telegram Trigger menerima pesan
↓
n8n membaca isi pesan
↓
AI/parser mengekstrak nominal, kategori, tanggal, merchant
↓
n8n menyimpan data ke Supabase
↓
Bot mengirim konfirmasi ke user
```

### 7.3 Flow Input Foto Struk

```text
User kirim foto struk
↓
Telegram Trigger menerima file
↓
n8n download gambar
↓
Gambar dikirim ke AI/OCR
↓
AI mengekstrak data struk menjadi JSON
↓
n8n validasi JSON
↓
n8n menyimpan transaksi ke Supabase
↓
Bot mengirim ringkasan transaksi
```

### 7.4 Flow Dashboard

```text
User buka PWA
↓
Login via Supabase Auth
↓
Dashboard mengambil data transaksi dari Supabase
↓
User melihat grafik, tabel, filter, dan detail transaksi
↓
User bisa edit/hapus transaksi
```

---

## 8. Fitur MVP

## 8.1 Telegram Bot

### 8.1.1 Terima Transaksi Teks

User dapat mengirim transaksi dengan format bebas.

Contoh input:

```text
kopi 25000
```

Output bot:

```text
Tercatat:
Pengeluaran: Rp25.000
Kategori: Makanan & Minuman
Catatan: kopi
Tanggal: Hari ini
```

### Acceptance Criteria

* Bot dapat menerima pesan teks.
* Bot dapat mengekstrak nominal.
* Bot dapat menentukan transaksi sebagai expense atau income.
* Bot dapat memberi kategori default.
* Bot dapat menyimpan transaksi ke database.
* Bot mengirim konfirmasi setelah transaksi berhasil disimpan.

---

### 8.1.2 Terima Foto Struk

User dapat mengirim foto struk ke Telegram.

Output bot:

```text
Struk terbaca:

Merchant: Indomaret
Tanggal: 7 Juni 2026
Total: Rp78.500
Kategori: Belanja Harian

Item:
- Roti: Rp15.000
- Susu: Rp22.000
- Air Mineral: Rp6.000

Transaksi sudah disimpan.
```

### Acceptance Criteria

* Bot dapat menerima file gambar dari Telegram.
* n8n dapat mengambil file gambar.
* AI/OCR dapat membaca isi struk.
* Sistem dapat mengekstrak merchant, tanggal, total, dan item jika tersedia.
* Sistem tetap menyimpan transaksi meskipun item tidak lengkap.
* Bot mengirim ringkasan hasil OCR.

---

### 8.1.3 Konfirmasi Jika Confidence Rendah

Jika AI tidak yakin dengan hasil OCR, bot harus meminta konfirmasi.

Contoh:

```text
Saya kurang yakin totalnya.
Apakah total transaksi ini Rp78.500?
Balas:
ya
atau
edit 78500
```

### Acceptance Criteria

* AI/OCR menghasilkan field `confidence`.
* Jika confidence di bawah threshold, sistem tidak langsung menyimpan atau menyimpan dengan status `needs_review`.
* Bot meminta user mengonfirmasi.
* User bisa mengoreksi nominal melalui chat.

---

### 8.1.4 Command Dasar Telegram

Bot mendukung command:

```text
/start
/help
/today
/month
/categories
```

### Detail Command

#### `/start`

Menampilkan pesan onboarding singkat.

#### `/help`

Menampilkan cara mencatat transaksi.

#### `/today`

Menampilkan total pengeluaran hari ini.

#### `/month`

Menampilkan total pengeluaran bulan berjalan.

#### `/categories`

Menampilkan ringkasan pengeluaran per kategori bulan berjalan.

### Acceptance Criteria

* Semua command memberikan response.
* Data command diambil dari database.
* Jika tidak ada data, bot menampilkan pesan kosong yang informatif.

---

## 8.2 OCR & AI Parsing

### 8.2.1 OCR Struk

Sistem harus mampu membaca gambar struk dan menghasilkan data terstruktur.

Format JSON hasil AI:

```json
{
  "date": "2026-06-07",
  "merchant": "Indomaret",
  "type": "expense",
  "category": "Belanja Harian",
  "amount": 78500,
  "items": [
    {
      "name": "Roti",
      "qty": 1,
      "price": 15000
    }
  ],
  "payment_method": null,
  "raw_text": "...",
  "confidence": 0.86
}
```

### Acceptance Criteria

* Output AI harus JSON valid.
* Jika field tidak terbaca, isi dengan `null`.
* Amount harus berupa angka tanpa format rupiah.
* Date menggunakan format `YYYY-MM-DD`.
* Type hanya boleh `income` or `expense`.
* Confidence bernilai 0 sampai 1.

---

### 8.2.2 Parsing Teks Natural

Input:

```text
makan nasi padang 32000
```

Output:

```json
{
  "date": "2026-06-07",
  "merchant": null,
  "type": "expense",
  "category": "Makanan & Minuman",
  "amount": 32000,
  "note": "makan nasi padang",
  "source": "telegram_text"
}
```

### Acceptance Criteria

* Sistem mengenali nominal dari teks.
* Sistem menentukan kategori.
* Sistem menentukan tanggal default sebagai hari ini.
* Sistem mengenali income jika ada kata seperti gaji, transfer masuk, freelance, bonus, refund.
* Sistem mengenali expense sebagai default jika tidak ada indikasi income.

---

## 8.3 Database

### 8.3.1 Tabel `transactions`

```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  date date not null,
  type text check (type in ('income', 'expense')) not null default 'expense',
  merchant text,
  category text,
  amount numeric not null,
  note text,
  source text,
  receipt_url text,
  raw_text text,
  ai_confidence numeric,
  status text default 'confirmed',
  telegram_message_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

### Status Transaksi

```text
confirmed
needs_review
deleted
```

---

### 8.3.2 Tabel `transaction_items`

```sql
create table transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  name text not null,
  qty numeric,
  price numeric,
  created_at timestamp with time zone default now()
);
```

---

### 8.3.3 Tabel `categories`

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  type text check (type in ('income', 'expense')) default 'expense',
  icon text,
  color text,
  created_at timestamp with time zone default now()
);
```

Default categories:

```text
Makanan & Minuman
Transportasi
Belanja Harian
Tagihan
Hiburan
Kesehatan
Pendidikan
Rumah
Pekerjaan
Gaji
Freelance
Lainnya
```

---

### 8.3.4 Tabel `receipts`

```sql
create table receipts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  file_url text,
  file_name text,
  mime_type text,
  file_size numeric,
  created_at timestamp with time zone default now()
);
```

---

## 8.4 PWA Dashboard

### 8.4.1 Login

User dapat login ke dashboard.

Untuk MVP pribadi, opsi login:

* Email magic link via Supabase Auth
* Email + password
* Optional: single-user mode tanpa public registration

### Acceptance Criteria

* User bisa login.
* User hanya bisa melihat datanya sendiri.
* Session tersimpan di browser.
* User bisa logout.

---

### 8.4.2 Dashboard Home

Dashboard menampilkan:

* Total pengeluaran bulan ini
* Total pemasukan bulan ini
* Selisih income - expense
* Grafik pengeluaran per kategori
* Grafik pengeluaran harian
* 5 transaksi terbaru

### Acceptance Criteria

* Data dashboard berubah sesuai bulan aktif.
* User bisa memilih bulan.
* Jika tidak ada data, tampil empty state.
* Total angka sesuai data transaksi.

---

### 8.4.3 Halaman Transactions

User dapat melihat semua transaksi dalam bentuk tabel.

Kolom:

```text
Tanggal
Tipe
Merchant
Kategori
Nominal
Catatan
Sumber
Status
Action
```

Fitur:

* Search
* Filter tanggal
* Filter kategori
* Filter type
* Sort by date
* Edit transaction
* Delete transaction

### Acceptance Criteria

* Tabel menampilkan transaksi dari database.
* Filter bekerja.
* Search bekerja.
* User bisa edit transaksi.
* User bisa hapus transaksi.
* Delete bersifat soft delete dengan status `deleted`.

---

### 8.4.4 Form Tambah Transaksi Manual

User dapat menambahkan transaksi manual dari dashboard.

Field:

```text
Tanggal
Tipe
Merchant
Kategori
Nominal
Catatan
```

### Acceptance Criteria

* Form validasi nominal wajib diisi.
* Tanggal wajib diisi.
* Type wajib income/expense.
* Setelah submit, transaksi muncul di tabel.
* Bot tidak perlu dikirimi notifikasi untuk transaksi manual.

---

### 8.4.5 Detail Transaksi

Halaman/detail modal menampilkan:

* Informasi transaksi
* Item struk jika tersedia
* Foto struk jika tersedia
* Raw OCR text
* Confidence AI
* Timestamp

### Acceptance Criteria

* User dapat melihat detail transaksi.
* Jika ada receipt image, image bisa dibuka.
* Jika ada items, items ditampilkan dalam list.
* Jika data berasal dari teks, bagian receipt disembunyikan.

---

### 8.4.6 Halaman Categories

User dapat:

* Melihat daftar kategori.
* Menambahkan kategori.
* Mengubah nama kategori.
* Menghapus kategori jika belum dipakai.
* Melihat total pengeluaran per kategori.

### Acceptance Criteria

* Kategori default tersedia.
* User bisa menambah kategori baru.
* Kategori yang digunakan transaksi tidak langsung dihapus, tetapi bisa diarsipkan di fase berikutnya.

---

## 9. n8n Workflow Requirements

## 9.1 Workflow 1: Telegram Text Transaction

### Trigger

Telegram Trigger menerima message text.

### Steps

```text
Telegram Trigger
→ Check message type
→ AI/Text Parser
→ Validate JSON
→ Insert transaction to Supabase
→ Send confirmation to Telegram
```

### Error Handling

Jika parsing gagal:

```text
Maaf, saya belum bisa membaca transaksi ini.
Coba format:
makan siang 35000
atau
gaji freelance 1500000
```

---

## 9.2 Workflow 2: Telegram Receipt OCR

### Trigger

Telegram Trigger menerima photo/document image.

### Steps

```text
Telegram Trigger
→ Get Telegram File
→ Download Image
→ Upload image to Supabase Storage
→ Send image to AI/OCR
→ Validate JSON
→ Insert transaction
→ Insert transaction_items
→ Insert receipt metadata
→ Send summary to Telegram
```

### Error Handling

Jika OCR gagal:

```text
Struk belum terbaca dengan jelas.
Coba foto ulang dengan cahaya lebih terang dan pastikan total belanja terlihat.
```

Jika JSON invalid:

```text
Struk terbaca, tapi hasilnya belum bisa diproses otomatis.
Saya simpan sebagai needs_review.
```

---

## 9.3 Workflow 3: Daily Summary

Opsional MVP.

### Trigger

Cron harian jam 21:00.

### Steps

```text
Cron Trigger
→ Query transaksi hari ini
→ Hitung total expense/income
→ Group by category
→ Send summary to Telegram
```

Contoh output:

```text
Ringkasan hari ini:

Pengeluaran: Rp135.000
Pemasukan: Rp0

Kategori terbesar:
Makanan & Minuman: Rp85.000
Transportasi: Rp30.000
Belanja Harian: Rp20.000
```

---

## 9.4 Workflow 4: Monthly Summary

Opsional MVP.

### Trigger

Cron setiap tanggal 1 jam 09:00.

### Steps

```text
Cron Trigger
→ Query bulan sebelumnya
→ Generate summary
→ Send monthly report to Telegram
```

---

## 10. AI Prompt Requirements

## 10.1 Prompt OCR Struk

```text
Kamu adalah sistem OCR dan parser struk belanja Indonesia.

Baca gambar struk ini dan ekstrak informasi transaksi.
Balas hanya dalam JSON valid tanpa markdown.

Format:
{
  "date": "YYYY-MM-DD",
  "merchant": string | null,
  "type": "expense",
  "category": string,
  "amount": number,
  "items": [
    {
      "name": string,
      "qty": number | null,
      "price": number | null
    }
  ],
  "payment_method": string | null,
  "raw_text": string,
  "confidence": number
}

Aturan:
- Gunakan Rupiah.
- amount adalah total akhir yang dibayar.
- Jangan gunakan subtotal jika ada total akhir.
- Jika tanggal tidak terlihat, gunakan null.
- Jika merchant tidak terlihat, gunakan null.
- Jika item tidak terbaca, gunakan array kosong.
- confidence bernilai 0 sampai 1.
- Jangan menambahkan teks selain JSON.
```

---

## 10.2 Prompt Parser Teks

```text
Kamu adalah parser transaksi keuangan pribadi.

Ubah pesan user menjadi JSON transaksi.
Balas hanya JSON valid tanpa markdown.

Tanggal hari ini: {{today}}

Input user:
{{message}}

Format:
{
  "date": "YYYY-MM-DD",
  "merchant": string | null,
  "type": "income" | "expense",
  "category": string,
  "amount": number,
  "note": string,
  "confidence": number
}

Aturan:
- Jika tidak ada indikasi pemasukan, default type adalah expense.
- Jika ada kata gaji, bonus, freelance, refund, transfer masuk, maka type income.
- Nominal harus angka tanpa simbol Rp.
- Pilih kategori paling sesuai.
- Jika kategori tidak jelas, gunakan "Lainnya".
- Jika tanggal tidak disebut, gunakan tanggal hari ini.
- Jangan menambahkan teks selain JSON.
```

---

## 11. PWA Requirements

### 11.1 PWA Installability

PWA harus bisa di-install di mobile browser.

Required files:

```text
manifest.json
service-worker.js
icons 192x192
icons 512x512
theme_color
background_color
```

### Acceptance Criteria

* Browser mendeteksi app sebagai installable PWA.
* App punya icon.
* App bisa dibuka dari home screen.
* App tetap menampilkan basic shell saat offline.
* Data transaksi boleh tetap butuh internet pada MVP.

---

## 12. UI Pages

### 12.1 `/login`

Fungsi:

* Login user
* Magic link atau email-password

Komponen:

* Email input
* Password input atau magic link button
* Submit button
* Error message

---

### 12.2 `/dashboard`

Komponen:

* Month selector
* Total expense card
* Total income card
* Balance card
* Category pie/bar chart
* Daily expense line chart
* Recent transactions

---

### 12.3 `/transactions`

Komponen:

* Transaction table
* Search input
* Category filter
* Date range filter
* Add transaction button
* Edit modal
* Delete button

---

### 12.4 `/transactions/[id]`

Komponen:

* Transaction detail
* Receipt image
* Items list
* Raw OCR text
* AI confidence
* Edit button

---

### 12.5 `/categories`

Komponen:

* Category list
* Add category form
* Edit category
* Category spending summary

---

### 12.6 `/settings`

Komponen:

* User profile
* Telegram user ID mapping
* Default currency
* Default category rules
* Logout button

---

## 13. Data Model Detail

### Transaction Object

```ts
type Transaction = {
  id: string;
  user_id: string;
  date: string;
  type: "income" | "expense";
  merchant?: string | null;
  category: string;
  amount: number;
  note?: string | null;
  source: "telegram_text" | "telegram_receipt" | "manual";
  receipt_url?: string | null;
  raw_text?: string | null;
  ai_confidence?: number | null;
  status: "confirmed" | "needs_review" | "deleted";
  created_at: string;
  updated_at: string;
};
```

### Transaction Item Object

```ts
type TransactionItem = {
  id: string;
  transaction_id: string;
  name: string;
  qty?: number | null;
  price?: number | null;
  created_at: string;
};
```

---

## 14. Security Requirements

### 14.1 Dashboard Security

* Dashboard wajib menggunakan authentication.
* Supabase RLS harus aktif.
* User hanya bisa membaca transaksi miliknya.
* Public registration bisa dimatikan untuk MVP pribadi.

### 14.2 n8n Security

* n8n tidak boleh dibuka tanpa login.
* n8n harus berada di HTTPS.
* Gunakan environment variable untuk API key.
* Jangan hardcode token Telegram, OpenAI, atau Supabase di workflow tanpa credential manager.
* Batasi akses dashboard n8n jika memungkinkan dengan basic auth atau firewall.

### 14.3 Telegram Security

* Bot hanya menerima pesan dari Telegram user ID yang di-whitelist.
* Jika user ID tidak dikenal, bot membalas:

```text
Maaf, bot ini hanya untuk pemakaian pribadi.
```

### 14.4 Storage Security

* Receipt image disimpan di Supabase Storage private bucket.
* URL receipt tidak boleh public permanen kecuali diperlukan.
* Dashboard menggunakan signed URL jika ingin melihat gambar.

---

## 15. Error Handling

### 15.1 Telegram Bot Error Messages

#### OCR gagal

```text
Struk belum terbaca dengan jelas.
Coba foto ulang dengan pencahayaan lebih terang dan pastikan total pembayaran terlihat.
```

#### Nominal tidak ditemukan

```text
Saya belum menemukan nominal transaksi.
Coba tulis seperti:
makan siang 35000
```

#### Database error

```text
Transaksi berhasil dibaca, tapi belum bisa disimpan karena ada masalah sistem.
Coba lagi sebentar lagi.
```

#### Unauthorized user

```text
Bot ini hanya untuk pemakaian pribadi.
```

---

## 16. Analytics & Metrics

Untuk MVP pribadi, tracking sederhana cukup dari database.

Metrics:

* Jumlah transaksi per hari.
* Jumlah transaksi per bulan.
* Total expense per bulan.
* Total income per bulan.
* Jumlah transaksi dari teks.
* Jumlah transaksi dari struk.
* Jumlah OCR gagal.
* Jumlah transaksi `needs_review`.
* Rata-rata confidence OCR.

---

## 17. Success Metrics

MVP dianggap berhasil jika:

* User bisa mencatat transaksi via Telegram dalam kurang dari 10 detik.
* Minimal 90% input teks sederhana berhasil diparse.
* Minimal 70% struk terbaca dengan benar untuk merchant umum seperti Indomaret, Alfamart, restoran, kafe.
* Dashboard menampilkan rekap bulanan dengan benar.
* User tidak perlu input manual untuk mayoritas transaksi harian.
* Bot dapat digunakan selama 7 hari berturut-turut tanpa error besar.

---

## 18. MVP Scope

### Must Have

* Telegram bot menerima teks transaksi.
* Telegram bot menerima foto struk.
* OCR/AI parsing.
* Supabase database.
* PWA dashboard.
* Login.
* List transaksi.
* Add/edit/delete transaksi.
* Monthly summary.
* Category summary.
* Basic security whitelist Telegram user ID.

### Should Have

* Daily summary via Telegram.
* Receipt image storage.
* Transaction item details.
* Needs review flow.
* Category management.
* PWA installable.

### Could Have

* Budget per kategori.
* Reminder input harian.
* Export CSV.
* Multi-currency.
* Search natural language.
* AI spending insight.

### Won’t Have for MVP

* WhatsApp integration.
* Bank integration.
* Native mobile app.
* Public SaaS billing.
* Family/shared wallet.
* Advanced financial planning.

---

## 19. Roadmap

### Phase 0 — Setup Infrastructure

* Setup n8n di VPS.
* Setup HTTPS subdomain.
* Setup Supabase project.
* Setup Telegram Bot.
* Setup basic workflow test.

Deliverable:

```text
Telegram bot bisa menerima pesan dan membalas.
```

---

### Phase 1 — Text Transaction MVP

* Telegram text parser.
* AI prompt for text transaction.
* Insert transaction to Supabase.
* Confirmation message.

Deliverable:

```text
User bisa kirim "kopi 25000" dan transaksi tersimpan.
```

---

### Phase 2 — Receipt OCR MVP

* Telegram photo trigger.
* Download image.
* OCR/AI extraction.
* Insert transaction and items.
* Store receipt image.
* Confirmation message.

Deliverable:

```text
User bisa kirim foto struk dan transaksi tersimpan otomatis.
```

---

### Phase 3 — PWA Dashboard

* Next.js app setup.
* Supabase Auth.
* Dashboard summary.
* Transaction list.
* Add/edit/delete transaction.
* Category chart.

Deliverable:

```text
User bisa melihat dan mengelola transaksi dari dashboard web/PWA.
```

---

### Phase 4 — Reporting & Automation

* Daily summary.
* Monthly summary.
* Category summary.
* Needs review flow.

Deliverable:

```text
Bot bisa mengirim ringkasan harian/bulanan otomatis.
```

---

### Phase 5 — Polish

* Improve OCR prompt.
* Improve category mapping.
* Improve mobile UI.
* Add export CSV.
* Add installable PWA icons.
* Add backup workflow.

Deliverable:

```text
Produk nyaman dipakai harian.
```

---

## 20. Detailed User Stories

### User Story 1 — Catat Transaksi Teks

Sebagai user, saya ingin mengirim pesan “kopi 25000” ke bot agar pengeluaran saya tercatat tanpa membuka aplikasi.

Acceptance Criteria:

* Bot menerima pesan.
* Sistem mengenali nominal 25000.
* Sistem membuat transaksi expense.
* Sistem memberi kategori Makanan & Minuman.
* Sistem menyimpan transaksi.
* Bot membalas ringkasan.

---

### User Story 2 — Catat Struk

Sebagai user, saya ingin mengirim foto struk agar sistem otomatis membaca total belanja dan menyimpannya.

Acceptance Criteria:

* Bot menerima gambar.
* Sistem membaca merchant.
* Sistem membaca total.
* Sistem membaca tanggal jika ada.
* Sistem menyimpan transaksi.
* Bot mengirim hasil ringkasan.

---

### User Story 3 — Lihat Dashboard Bulanan

Sebagai user, saya ingin melihat total pengeluaran bulan ini agar saya tahu kondisi keuangan saya.

Acceptance Criteria:

* Dashboard menampilkan total expense.
* Dashboard menampilkan total income.
* Dashboard menampilkan balance.
* Dashboard bisa memilih bulan.
* Data sesuai database.

---

### User Story 4 — Edit Transaksi

Sebagai user, saya ingin mengedit transaksi jika AI salah membaca nominal atau kategori.

Acceptance Criteria:

* User bisa membuka transaksi.
* User bisa mengubah nominal.
* User bisa mengubah kategori.
* Data tersimpan ke database.
* Dashboard menampilkan data terbaru.

---

### User Story 5 — Hapus Transaksi

Sebagai user, saya ingin menghapus transaksi yang salah input.

Acceptance Criteria:

* User bisa klik delete.
* Sistem meminta konfirmasi.
* Transaksi tidak muncul di list default.
* Data diberi status `deleted`.

---

## 21. API / Integration Requirements

### 21.1 Supabase Insert Transaction

Payload:

```json
{
  "user_id": "uuid",
  "date": "2026-06-07",
  "type": "expense",
  "merchant": "Indomaret",
  "category": "Belanja Harian",
  "amount": 78500,
  "note": null,
  "source": "telegram_receipt",
  "receipt_url": "storage/path.jpg",
  "raw_text": "...",
  "ai_confidence": 0.86,
  "status": "confirmed"
}
```

### 21.2 Telegram Confirmation Message

Format:

```text
Tercatat ✅

Merchant: Indomaret
Tanggal: 7 Juni 2026
Kategori: Belanja Harian
Total: Rp78.500

Sumber: Struk
```

---

## 22. Category Mapping Rules

Initial category rules:

```text
kopi, coffee, cafe, makan, nasi, restoran → Makanan & Minuman
gojek, grab, bensin, parkir, toll → Transportasi
indomaret, alfamart, supermarket, grocery → Belanja Harian
listrik, air, internet, pulsa, token → Tagihan
bioskop, game, netflix, spotify → Hiburan
obat, dokter, apotek → Kesehatan
buku, course, kelas → Pendidikan
gaji, salary → Gaji
freelance, project → Freelance
```

Jika tidak match:

```text
Lainnya
```

---

## 23. Notification Requirements

### Telegram Notifications

MVP notification:

* Transaction saved confirmation.
* OCR failed message.
* Daily summary.
* Monthly summary.

Optional:

* Reminder jam 21:00 jika belum ada transaksi hari ini.
* Warning jika pengeluaran kategori tertentu melewati limit.

---

## 24. Performance Requirements

* Bot response untuk teks: maksimal 5 detik.
* Bot response untuk OCR struk: maksimal 30 detik.
* Dashboard initial load: maksimal 3 detik pada koneksi normal.
* Query transaksi bulanan: maksimal 2 detik.
* Workflow n8n harus retry jika API AI gagal sementara.

---

## 25. Reliability Requirements

* Workflow tidak boleh crash jika AI output invalid.
* Jika database insert gagal, bot harus memberi pesan error.
* Jika OCR gagal, image tetap boleh disimpan sebagai receipt pending.
* Transaksi dengan confidence rendah diberi status `needs_review`.
* Semua error penting dicatat di n8n execution log.

---

## 26. Privacy Requirements

Karena data keuangan bersifat sensitif:

* Jangan expose Supabase anon key dengan permission berlebihan.
* Aktifkan RLS.
* Jangan simpan API key di frontend.
* Jangan publish dashboard tanpa login.
* Jangan membagikan screenshot dashboard.
* Batasi akses bot berdasarkan Telegram user ID.
* Receipt image harus private.

---

## 27. Deployment Plan

### VPS Services

```text
n8n
Next.js PWA
Caddy/Nginx
Optional: PostgreSQL local
```

### Recommended Setup

```text
n8n.domain.com      → n8n container
finance.domain.com  → Next.js PWA container
Supabase Cloud      → Database/Auth/Storage
```

### Docker Services

```text
docker-compose.yml
├── n8n
├── finance-web
└── caddy/nginx
```

---

## 28. Environment Variables

### n8n

```env
N8N_HOST=n8n.domain.com
N8N_PROTOCOL=https
WEBHOOK_URL=https://n8n.domain.com/
GENERIC_TIMEZONE=Asia/Jakarta
N8N_ENCRYPTION_KEY=
```

### Bot/OCR

```env
TELEGRAM_BOT_TOKEN=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

### Supabase

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

### Next.js

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 29. Risks & Mitigations

### Risk 1: OCR Salah Membaca Total

Mitigation:

* Gunakan confidence score.
* Simpan raw text.
* Buat flow edit manual.
* Jika confidence rendah, minta konfirmasi.

### Risk 2: Biaya AI Membengkak

Mitigation:

* Batasi hanya proses gambar dari Telegram user ID yang di-whitelist.
* Kompres gambar sebelum OCR.
* Gunakan model vision murah.
* Simpan hasil OCR agar tidak diproses ulang.

### Risk 3: Data Keuangan Bocor

Mitigation:

* RLS Supabase.
* Private storage.
* Dashboard login.
* n8n credential manager.
* Batasi akses bot.

### Risk 4: n8n Workflow Error

Mitigation:

* Tambahkan error branch.
* Tambahkan logging.
* Simpan failed payload.
* Buat retry manual.

### Risk 5: Dashboard Over-engineered

Mitigation:

* Fokus MVP hanya list, summary, filter, edit.
* Jangan buat fitur budgeting kompleks dulu.

---

## 30. Open Questions

1. Apakah data awal akan disimpan di Supabase atau Google Sheets?
2. Apakah dashboard perlu login jika hanya dipakai sendiri?
3. Apakah user ingin menyimpan foto struk permanen?
4. Apakah OCR perlu membaca item detail atau cukup total transaksi?
5. Apakah kategori ingin otomatis sepenuhnya atau bisa dikoreksi manual?
6. Apakah perlu daily reminder?
7. Apakah akan ada pemasukan juga atau hanya pengeluaran?
8. Apakah ingin multi-wallet, misalnya cash, bank, e-wallet?

---

## 31. Definition of Done MVP

MVP dianggap selesai jika:

* n8n berjalan di VPS dengan HTTPS.
* Telegram bot bisa menerima teks transaksi.
* Telegram bot bisa menerima foto struk.
* AI/OCR menghasilkan JSON transaksi.
* Transaksi tersimpan di Supabase.
* Dashboard PWA bisa login.
* Dashboard menampilkan rekap bulanan.
* Dashboard menampilkan list transaksi.
* User bisa tambah/edit/hapus transaksi.
* Bot hanya bisa digunakan oleh Telegram user ID yang diizinkan.
* Semua error utama memiliki fallback message.
* Sistem bisa dipakai untuk pencatatan harian pribadi.

---

## 32. Recommended MVP Build Order

Urutan pengerjaan paling aman:

1. Setup Supabase schema.
2. Setup Telegram bot.
3. Setup n8n workflow untuk pesan teks.
4. Insert transaksi ke Supabase.
5. Setup OCR struk.
6. Simpan receipt image.
7. Buat Next.js dashboard.
8. Tambahkan edit/delete transaksi.
9. Tambahkan summary chart.
10. Tambahkan daily/monthly report.

---

## 33. Final MVP Architecture

```text
Telegram Bot
  ↓
n8n Self-hosted
  ↓
AI/OCR Parser
  ↓
Supabase Postgres + Storage
  ↓
Next.js PWA Dashboard
```

Core value:

```text
Catat transaksi cukup lewat chat atau foto struk.
Data otomatis masuk ke dashboard keuangan pribadi.
```
