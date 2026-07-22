export const SUPPORTED_LANGUAGES = ["id", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "id";
export const LANGUAGE_STORAGE_KEY = "fintrack-language";

const englishTranslations: Record<string, string> = {
  "Akun & saldo": "Accounts & balances",
  Kategori: "Categories",
  "Smart Insights": "Smart Insights",
  Pengaturan: "Settings",
  Transaksi: "Transactions",
  Investasi: "Investments",
  Trading: "Trading",
  Profil: "Profile",
  "Profil & lainnya": "Profile & more",
  Keluar: "Sign out",
  "Navigasi utama": "Main navigation",
  "Tutup menu profil": "Close profile menu",
  "Buka menu profil": "Open profile menu",
  "Tutup menu": "Close menu",
  Bahasa: "Language",
  Indonesia: "Indonesian",
  Inggris: "English",
  "Pilih bahasa": "Choose language",
  "Bahasa tampilan": "Display language",
  "Pilih bahasa yang digunakan di seluruh aplikasi.": "Choose the language used throughout the app.",
  "Workspace settings": "Workspace settings",
  "Kelola sesi, periksa lingkungan aplikasi, dan hubungkan workflow Telegram dengan aman.":
    "Manage your session, inspect the app environment, and connect Telegram workflows securely.",
  "Memuat akun...": "Loading account...",
  "Email tidak tersedia": "Email unavailable",
  "Pemilik workspace pribadi": "Personal workspace owner",
  "Sesi privat": "Private session",
  "Data keuangan hanya dibuka lewat akun terautentikasi ini.":
    "Financial data is only accessible through this authenticated account.",
  "Keluar dari sesi": "Sign out",
  "Lingkungan aplikasi": "App environment",
  "Konfigurasi aktif pada perangkat ini.": "Active configuration on this device.",
  "Mata uang utama": "Primary currency",
  "IDR · Rupiah": "IDR · Indonesian rupiah",
  "Zona waktu": "Time zone",
  "Mode tampilan": "Display mode",
  "Aplikasi terpasang": "Installed app",
  Browser: "Browser",
  Koneksi: "Connection",
  Online: "Online",
  Offline: "Offline",
  "Identitas integrasi": "Integration identity",
  "Gunakan Supabase User ID ini untuk mengikat workflow n8n ke pemilik data yang benar.":
    "Use this Supabase User ID to bind the n8n workflow to the correct data owner.",
  "Memuat identitas...": "Loading identity...",
  "Sembunyikan User ID": "Hide User ID",
  "Tampilkan User ID": "Show User ID",
  Tersalin: "Copied",
  Salin: "Copy",
  "Identitas belum dapat disalin. Pilih tampilkan lalu salin manual.":
    "The identity could not be copied. Reveal it and copy it manually.",
  "Jaga batas kredensial": "Keep credentials protected",
  "Anon key boleh dipakai client dengan RLS aktif. Jangan pernah menaruh service-role key di browser, Telegram, atau workflow yang dapat dibaca publik.":
    "The anon key may be used by the client when RLS is enabled. Never put a service-role key in the browser, Telegram, or any publicly readable workflow.",
  "Hubungkan bot Telegram": "Connect a Telegram bot",
  "Empat langkah dari bot baru sampai workflow aktif.": "Four steps from a new bot to an active workflow.",
  "Buat bot melalui BotFather": "Create a bot with BotFather",
  "Batasi pengguna Telegram": "Restrict Telegram users",
  "Atur environment n8n": "Configure the n8n environment",
  "Import dan aktifkan workflow": "Import and activate the workflow",
  "Buka akun resmi @BotFather, jalankan /newbot, lalu simpan token di credential n8n—bukan di source code.":
    "Open the official @BotFather account, run /newbot, then store the token in n8n credentials—not in source code.",
  "Ambil Telegram User ID Anda melalui bot informasi akun, lalu gunakan sebagai allowlist agar bot pribadi tidak dapat dipakai orang lain.":
    "Get your Telegram User ID from an account-info bot, then use it as an allowlist so no one else can use your private bot.",
  "Import workflow dari folder n8n/, hubungkan Telegram credential, uji satu transaksi, lalu aktifkan workflow.":
    "Import the workflow from the n8n/ folder, connect the Telegram credential, test one transaction, then activate the workflow.",
  "Halo, {name}": "Hello, {name}",
};

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as Language);
}

export function getTranslation(
  language: Language,
  source: string,
  values: Record<string, string | number> = {},
) {
  const template = language === "en" ? englishTranslations[source] ?? source : source;
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder,
  );
}
