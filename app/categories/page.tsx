"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { 
  Plus, 
  Trash2, 
  X, 
  Loader2, 
  Palette,
  CircleDot
} from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";

type Category = {
  id: string;
  user_id: string | null;
  name: string;
  type: "income" | "expense";
  icon: string | null;
  color: string | null;
  created_at: string;
};

type CategorySpending = {
  name: string;
  type: "income" | "expense";
  color: string;
  amount: number;
  count: number;
};

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spending, setSpending] = useState<Record<string, CategorySpending>>({});
  
  // Add Category Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "expense" as "income" | "expense",
    icon: "Tag",
    color: "#5e6ad2"
  });

  const presetColors = [
    "#ef4444", // Red
    "#3b82f6", // Blue
    "#27a644", // Green (Linear success)
    "#f59e0b", // Orange/Amber
    "#5e6ad2", // Lavender (Linear primary)
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#14b8a6", // Teal
    "#eab308", // Yellow
    "#64748b", // Slate
    "#78716c"  // Stone
  ];

  async function fetchCategoriesAndSpending() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: catData, error: catError } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);

      const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("category, amount, type")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .gte("date", start)
        .lte("date", end);

      if (txError) throw txError;

      const spendingMap: Record<string, CategorySpending> = {};
      txData?.forEach(tx => {
        const catName = tx.category;
        if (!spendingMap[catName]) {
          const matchedCat = catData?.find(c => c.name === catName);
          spendingMap[catName] = {
            name: catName,
            type: tx.type as "income" | "expense",
            color: matchedCat?.color || "#64748b",
            amount: 0,
            count: 0
          };
        }
        spendingMap[catName].amount += Number(tx.amount);
        spendingMap[catName].count += 1;
      });

      setSpending(spendingMap);
    } catch (err) {
      console.error("Error loading categories:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCategoriesAndSpending();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const exists = categories.some(c => c.name.toLowerCase() === form.name.trim().toLowerCase());
      if (exists) {
        alert("Nama kategori sudah ada!");
        return;
      }

      const { error } = await supabase
        .from("categories")
        .insert([{
          user_id: user.id,
          name: form.name.trim(),
          type: form.type,
          icon: form.icon,
          color: form.color
        }]);

      if (error) throw error;

      setModalOpen(false);
      fetchCategoriesAndSpending();
    } catch {
      alert("Gagal menambahkan kategori!");
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (spending[name] && spending[name].count > 0) {
      alert(`Kategori "${name}" tidak dapat dihapus karena telah digunakan dalam transaksi bulan ini.`);
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus kategori "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchCategoriesAndSpending();
    } catch {
      alert("Gagal menghapus kategori. Kategori mungkin masih digunakan oleh transaksi lama di luar bulan ini.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#f7f8f8] flex flex-col pb-24 md:pb-6 font-sans antialiased">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f7f8f8]">
              Daftar Kategori
            </h1>
            <p className="text-xs text-[#8a8f98] mt-0.5">
              Kelola kategori kustom Anda dan pantau total pengeluaran per kategori bulan berjalan
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-2 bg-[#5e6ad2] hover:bg-[#828fff] text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm click-active self-start sm:self-center"
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#5e6ad2]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const currentSpend = spending[cat.name]?.amount || 0;
              const txCount = spending[cat.name]?.count || 0;
              const isGlobal = cat.user_id === null;

              return (
                <div 
                  key={cat.id} 
                  className="linear-panel p-4.5 rounded flex flex-col justify-between gap-4"
                  style={{ borderLeft: `3px solid ${cat.color || "#5e6ad2"}` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-white text-sm">{cat.name}</h4>
                        {isGlobal && (
                          <span className="bg-[#1a1a1e] text-[#8a8f98] border border-[#202024] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Bawaan
                          </span>
                        )}
                      </div>
                      <span className={`inline-block text-[9px] font-bold uppercase tracking-wider ${
                        cat.type === "expense" ? "text-rose-400" : "text-emerald-400"
                      }`}>
                        {cat.type === "expense" ? "Pengeluaran" : "Pemasukan"}
                      </span>
                    </div>

                    {!isGlobal && (
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="p-1.5 bg-[#1a1a1e] hover:bg-rose-950/20 text-[#8a8f98] hover:text-rose-400 border border-[#202024] rounded transition-all cursor-pointer"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-neutral-900/60 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-[#8a8f98] font-bold uppercase tracking-wider">Bulan Ini</p>
                      <p className="text-sm font-bold mt-0.5 text-white font-mono">
                        Rp{currentSpend.toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[9px] text-[#8a8f98] font-bold uppercase tracking-wider">Frekuensi</p>
                      <p className="text-xs font-semibold text-neutral-200 mt-0.5">
                        {txCount} Transaksi
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Category Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <form onSubmit={handleSaveCategory} className="w-full max-w-md bg-[#101012] border border-neutral-800 p-5 rounded-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Tambah Kategori Baru</h3>
              <button 
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
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

              {/* Category Name */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider">Nama Kategori</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-[#050507] border border-neutral-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                  placeholder="Contoh: Investasi, Zakat, Kucing"
                  required
                />
              </div>

              {/* Color picker */}
              <div className="space-y-2">
                <label className="text-[10px] text-neutral-400 font-bold ml-1 uppercase tracking-wider flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-[#5e6ad2]" />
                  Pilih Warna
                </label>
                
                <div className="flex flex-wrap gap-1.5">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, color }))}
                      className={`w-6.5 h-6.5 rounded-full transition-all border relative flex items-center justify-center cursor-pointer ${
                        form.color === color ? "scale-105 border-white" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {form.color === color && (
                        <CircleDot className="w-3 h-3 text-white/90 drop-shadow" />
                      )}
                    </button>
                  ))}
                  
                  {/* Custom Color Picker input */}
                  <div className="relative w-6.5 h-6.5 rounded-full border border-neutral-800 overflow-hidden flex items-center justify-center cursor-pointer bg-neutral-900 hover:border-neutral-700 transition-colors">
                    <input 
                      type="color" 
                      value={form.color} 
                      onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))} 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-[#8a8f98]">+</span>
                  </div>
                </div>
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
                Tambah Kategori
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
