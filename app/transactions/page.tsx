"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Loader2, 
  Eye, 
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { filterTransactions, type TransactionFilters } from "@/lib/finance";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  merchant: string | null;
  category: string;
  amount: number;
  note: string | null;
  source: string;
  receipt_url: string | null;
  ai_confidence: number | null;
  status: "confirmed" | "pending_approval" | "needs_review" | "deleted";
  created_at: string;
  account_id: string | null;
};

type FinancialAccount = {
  id: string;
  name: string;
  currency: string;
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TransactionFilters["type"]>("all");
  const [statusFilter, setStatusFilter] = useState<TransactionFilters["status"]>("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  
  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "expense" as "income" | "expense",
    merchant: "",
    category: "Makanan & Minuman",
    amount: "",
    note: "",
    accountId: "",
  });

  const categoriesList = [
    "Makanan & Minuman",
    "Transportasi",
    "Belanja Harian",
    "Tagihan",
    "Hiburan",
    "Kesehatan",
    "Pendidikan",
    "Rumah",
    "Pekerjaan",
    "Gaji",
    "Freelance",
    "Lainnya"
  ];

  async function fetchTransactions() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);

      const { data: accountData, error: accountError } = await supabase
        .from("financial_accounts")
        .select("id, name, currency")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (accountError) throw accountError;
      setFinancialAccounts((accountData ?? []) as FinancialAccount[]);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchTransactions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredTx = useMemo(
    () => filterTransactions(transactions, {
      search,
      category: categoryFilter,
      type: typeFilter,
      status: statusFilter,
      startDate,
      endDate,
    }),
    [categoryFilter, endDate, search, startDate, statusFilter, transactions, typeFilter],
  );

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setSelectedTx(null);
    setForm({
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      merchant: "",
      category: "Makanan & Minuman",
      amount: "",
      note: "",
      accountId: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (tx: Transaction) => {
    setIsEditMode(true);
    setSelectedTx(tx);
    setForm({
      date: tx.date,
      type: tx.type,
      merchant: tx.merchant || "",
      category: tx.category,
      amount: tx.amount.toString(),
      note: tx.note || "",
      accountId: tx.account_id || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0 || !form.accountId) {
      alert("Pilih akun sumber dan masukkan nominal transaksi yang valid!");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const txPayload = {
        user_id: user.id,
        date: form.date,
        type: form.type,
        merchant: form.merchant.trim() || null,
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim() || null,
        source: isEditMode && selectedTx ? selectedTx.source : "manual",
        status: "confirmed",
        account_id: form.accountId,
      };

      if (isEditMode && selectedTx) {
        const { error } = await supabase
          .from("transactions")
          .update(txPayload)
          .eq("id", selectedTx.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transactions")
          .insert([txPayload]);

        if (error) throw error;
      }

      setModalOpen(false);
      fetchTransactions();
    } catch (error) {
      alert("Gagal menyimpan transaksi!");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) return;
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "deleted" })
        .eq("id", id);

      if (error) throw error;
      fetchTransactions();
    } catch {
      alert("Gagal menghapus transaksi!");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "confirmed" })
        .eq("id", id);

      if (error) throw error;
      fetchTransactions();
    } catch {
      alert("Gagal mengembalikan transaksi!");
    }
  };

  const exportCSV = () => {
    const headers = ["Tanggal", "Tipe", "Merchant", "Kategori", "Nominal", "Catatan", "Sumber", "Status"];
    const rows = filteredTx.map(t => [
      t.date,
      t.type === "expense" ? "Pengeluaran" : "Pemasukan",
      t.merchant || "",
      t.category,
      t.amount,
      t.note || "",
      t.source,
      t.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_keuangan_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#f7f8f8] flex flex-col pb-24 md:pb-6 font-sans antialiased">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f7f8f8]">
              Riwayat Transaksi
            </h1>
            <p className="text-xs text-[#8a8f98] mt-0.5">
              Kelola, cari, dan unduh data transaksi keuangan Anda
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={filteredTx.length === 0}
              className="px-3 py-2 bg-[#101012] border border-[#202024] text-[#8a8f98] hover:text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 click-active"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Unduh CSV
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 bg-[#5e6ad2] hover:bg-[#828fff] text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm click-active"
            >
              <Plus className="w-4 h-4" />
              Tambah Manual
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="linear-panel p-4.5 rounded-lg space-y-4">
          <div className="flex items-center gap-1.5 pb-2.5 border-b border-neutral-900">
            <Filter className="w-3.5 h-3.5 text-[#5e6ad2]" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#8a8f98]">Cari & Filter</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Cari merchant, catatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#050507] border border-[#202024] rounded text-xs placeholder-neutral-500 focus:outline-none focus:border-[#5e6ad2]"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-500" />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TransactionFilters["type"])}
              className="w-full bg-[#050507] border border-[#202024] rounded px-3 py-2 text-xs text-[#f7f8f8] focus:outline-none focus:border-[#5e6ad2]"
            >
              <option value="all">Semua Tipe</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-[#050507] border border-[#202024] rounded px-3 py-2 text-xs text-[#f7f8f8] focus:outline-none focus:border-[#5e6ad2]"
            >
              <option value="all">Semua Kategori</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TransactionFilters["status"])}
              className="w-full bg-[#050507] border border-[#202024] rounded px-3 py-2 text-xs text-[#f7f8f8] focus:outline-none focus:border-[#5e6ad2]"
            >
              <option value="active">Transaksi Aktif</option>
              <option value="deleted">Sampah (Dihapus)</option>
              <option value="all">Semua Riwayat</option>
            </select>

            {/* Date Picker Range */}
            <div className="flex items-center gap-1 sm:col-span-2 md:col-span-4 lg:col-span-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#050507] border border-[#202024] rounded px-2 py-1.5 text-[10px] text-[#f7f8f8] focus:outline-none focus:border-[#5e6ad2]"
              />
              <span className="text-neutral-600 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#050507] border border-[#202024] rounded px-2 py-1.5 text-[10px] text-[#f7f8f8] focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#5e6ad2]" />
          </div>
        ) : filteredTx.length > 0 ? (
          <div className="linear-panel rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-neutral-900 bg-[#0c0c0e] text-[#8a8f98] font-bold uppercase tracking-wider">
                    <th className="p-4 font-semibold">Tanggal</th>
                    <th className="p-4 font-semibold">Merchant</th>
                    <th className="p-4 font-semibold">Kategori</th>
                    <th className="p-4 font-semibold">Akun</th>
                    <th className="p-4 font-semibold">Nominal</th>
                    <th className="p-4 font-semibold">Catatan</th>
                    <th className="p-4 font-semibold">Sumber</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/50 font-medium">
                  {filteredTx.map((tx) => (
                    <tr key={tx.id} className="text-neutral-200 hover:bg-neutral-900/10 transition-colors">
                      <td className="p-4 text-xs text-neutral-400 whitespace-nowrap">
                        {format(parseISO(tx.date), "dd MMM yyyy", { locale: id })}
                      </td>
                      <td className="p-4 font-bold text-white">{tx.merchant || "-"}</td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-[#1a1a1e] border border-neutral-800 rounded text-neutral-300">
                          {tx.category}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-400">{financialAccounts.find((account) => account.id === tx.account_id)?.name || "-"}</td>
                      <td className={`p-4 font-bold font-mono whitespace-nowrap text-sm ${tx.type === "expense" ? "text-rose-400" : "text-emerald-400"}`}>
                        {tx.type === "expense" ? "-" : "+"}Rp{tx.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 text-neutral-400 max-w-[200px] truncate">{tx.note || "-"}</td>
                      <td className="p-4 text-neutral-400 text-[10px] font-bold uppercase tracking-wide">
                        {tx.source === "telegram_text" ? "💬 Bot Text" : tx.source === "telegram_receipt" ? "🧾 Bot OCR" : "💻 Web Manual"}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          tx.status === "confirmed" ? "bg-emerald-950/20 text-emerald-400 border border-emerald-900/30" : 
                          tx.status === "pending_approval" ? "bg-amber-950/20 text-amber-400 border border-amber-900/30" :
                          tx.status === "needs_review" ? "bg-rose-950/20 text-rose-400 border border-rose-900/30" :
                          "bg-neutral-850 text-neutral-400"
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {tx.receipt_url && (
                            <a 
                              href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/private/${tx.receipt_url}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-[#1a1a1e] border border-neutral-800 text-neutral-400 hover:text-white rounded transition-colors click-active cursor-pointer"
                              title="Lihat Struk"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {tx.status !== "deleted" ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(tx)}
                                className="p-1.5 bg-[#1a1a1e] border border-neutral-800 text-neutral-400 hover:text-white rounded transition-colors click-active cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(tx.id)}
                                className="p-1.5 bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:bg-rose-900/40 rounded transition-colors click-active cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleRestore(tx.id)}
                              className="px-2.5 py-1.5 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/45 rounded text-[10px] font-bold transition-colors click-active cursor-pointer"
                            >
                              Pulihkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="linear-panel p-12 rounded-lg text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">Tidak Menemukan Transaksi</h3>
            <p className="text-xs text-neutral-500 max-w-xs mx-auto">
              Tidak ada data transaksi yang cocok dengan kriteria pencarian dan filter Anda saat ini.
            </p>
          </div>
        )}
      </main>

      {/* Add / Edit Transaction Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <form onSubmit={handleSave} className="w-full max-w-md bg-[#101012] border border-neutral-800 p-5 rounded-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{isEditMode ? "Edit Transaksi" : "Tambah Transaksi Manual"}</h3>
              <button 
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 bg-[#050507] p-1 rounded border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: "expense" }))}
                  className={`py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${
                    form.type === "expense" ? "bg-rose-950/35 text-rose-400 border border-rose-800/40" : "text-neutral-500"
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: "income" }))}
                  className={`py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${
                    form.type === "income" ? "bg-emerald-950/35 text-emerald-400 border border-emerald-800/40" : "text-neutral-500"
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Tanggal</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                  required
                />
              </div>

              {/* Merchant input */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Merchant</label>
                <input
                  type="text"
                  value={form.merchant}
                  onChange={(e) => setForm(prev => ({ ...prev, merchant: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                  placeholder="Contoh: Alfamart, Starbucks"
                />
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Akun sumber</label>
                <select
                  required
                  value={form.accountId}
                  onChange={(e) => setForm(prev => ({ ...prev, accountId: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="">Pilih akun...</option>
                  {financialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}
                </select>
                {financialAccounts.length === 0 && <p className="text-[10px] text-amber-400">Tambahkan akun terlebih dahulu dari menu Akun.</p>}
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Nominal (Rupiah)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                  placeholder="0"
                  required
                />
              </div>

              {/* Category selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Kategori</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Note input */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Catatan</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2] h-14 resize-none"
                  placeholder="Catatan..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-900">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold rounded border border-neutral-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-3.5 py-2 bg-[#5e6ad2] hover:bg-[#828fff] text-xs font-semibold rounded text-white cursor-pointer click-active"
              >
                Simpan Transaksi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
