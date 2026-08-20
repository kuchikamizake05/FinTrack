"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Loader2, ReceiptText, Sparkles, Upload } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { buildSharedReceiptDraft, validateSharedReceiptFile } from "@/lib/shared-receipt";
import { type ReceiptExtraction } from "@/lib/receipt-vision";
import { canWriteOnline, offlineWriteMessage } from "@/lib/pwa";
import { formatLocalDate } from "@/lib/planning";
import { supabase } from "@/infrastructure/supabase/browser-client";

type Account = { id: string; name: string; currency: string };
type SharedMetadata = { title: string; text: string; url: string; fileName: string | null; fileType: string | null };
const sharedCache = "fintrack-shared-receipts-v1";

export default function SharedReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page">
          <main id="main-content" tabIndex={-1} className="app-page-content max-w-2xl outline-none">
            <Surface className="p-6 text-sm text-slate-500">Menyiapkan bukti share...</Surface>
          </main>
        </div>
      }
    >
      <SharedReceiptContent />
    </Suspense>
  );
}

function SharedReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareId = searchParams.get("id");
  const [metadata, setMetadata] = useState<SharedMetadata | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMetadata, setAiMetadata] = useState<{ rawText: string | null; confidence: number | null }>({
    rawText: null,
    confidence: null,
  });
  const [form, setForm] = useState({
    date: formatLocalDate(new Date()),
    merchant: "",
    note: "",
    amount: "",
    accountId: "",
    category: "",
  });

  const parsedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        if (!shareId) throw new Error("missing share");
        const cache = await caches.open(sharedCache);
        const metadataResponse = await cache.match(`/__shared-receipts/${shareId}/metadata`);
        if (!metadataResponse) throw new Error("missing shared content");

        const nextMetadata = (await metadataResponse.json()) as SharedMetadata;
        const nextDraft = buildSharedReceiptDraft(nextMetadata);
        setMetadata(nextMetadata);

        let sharedFile: File | null = null;
        const fileResponse = await cache.match(`/__shared-receipts/${shareId}/file`);
        if (fileResponse) {
          sharedFile = new File([await fileResponse.blob()], nextMetadata.fileName ?? "receipt", {
            type: nextMetadata.fileType ?? "application/octet-stream",
          });
          setFile(sharedFile);
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }

        const [accountsResult, categoriesResult] = await Promise.all([
          supabase
            .from("financial_accounts")
            .select("id,name,currency")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("name"),
          supabase.from("categories").select("name").eq("type", "expense").order("name"),
        ]);

        if (accountsResult.error || categoriesResult.error) {
          throw accountsResult.error || categoriesResult.error;
        }

        const nextAccounts = (accountsResult.data ?? []) as Account[];
        const nextCategories = (categoriesResult.data ?? []).map((item) => item.name);
        setAccounts(nextAccounts);
        setCategories(nextCategories);

        setForm((current) => ({
          ...current,
          merchant: current.merchant || nextDraft.merchant || "",
          note: current.note || nextDraft.note || "",
          accountId: current.accountId || nextAccounts[0]?.id || "",
          category: current.category || nextCategories[0] || "",
        }));

        if (sharedFile && !parsedRef.current && canWriteOnline()) {
          parsedRef.current = true;
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.access_token && sharedFile.type.startsWith("image/")) {
            setParsing(true);
            setParseNotice(null);
            try {
              const body = new FormData();
              body.append("file", sharedFile);
              const response = await fetch("/api/receipts/parse", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
                body,
                cache: "no-store",
              });

              const result = (await response.json().catch(() => ({}))) as {
                extraction?: ReceiptExtraction;
                error?: string;
              };

              if (response.ok && result.extraction) {
                const ext = result.extraction;
                setForm((prev) => {
                  let matchedCategory = prev.category;
                  if (ext.categoryHint) {
                    const found = nextCategories.find(
                      (cat) => cat.toLowerCase() === ext.categoryHint?.toLowerCase(),
                    );
                    if (found) matchedCategory = found;
                  }

                  return {
                    ...prev,
                    date: ext.date || prev.date,
                    merchant: ext.merchant || prev.merchant,
                    amount: ext.amount !== null ? String(ext.amount) : prev.amount,
                    note: ext.note || prev.note,
                    category: matchedCategory,
                  };
                });

                setAiMetadata({
                  rawText: ext.rawText ?? null,
                  confidence: ext.confidence ?? null,
                });
                setParseNotice("Data struk berhasil diekstrak otomatis oleh AI. Silakan periksa kembali.");
              } else if (result.error) {
                setParseNotice(result.error);
              }
            } catch {
              setParseNotice("Ekstraksi otomatis gagal. Silakan lengkapi form secara manual.");
            } finally {
              setParsing(false);
            }
          }
        }
      } catch {
        setError("Bukti share tidak ditemukan. Coba share ulang dari aplikasi asal.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, shareId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setError(offlineWriteMessage);
      return;
    }
    if (!form.accountId || !form.category || !Number(form.amount)) {
      setError("Lengkapi akun, kategori, dan nominal.");
      return;
    }
    if (file) {
      const fileError = validateSharedReceiptFile(file);
      if (fileError) {
        setError(fileError);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      let receiptUrl: string | null = null;
      if (file) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        receiptUrl = `receipts/${path}`;
      }

      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: form.accountId,
        date: form.date,
        merchant: form.merchant.trim() || null,
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim() || null,
        type: "expense",
        source: "manual",
        status: "needs_review",
        receipt_url: receiptUrl,
        raw_text: aiMetadata.rawText,
        ai_confidence: aiMetadata.confidence,
      });

      if (insertError) throw insertError;

      if (shareId) {
        const cache = await caches.open(sharedCache);
        await Promise.all([
          cache.delete(`/__shared-receipts/${shareId}/metadata`),
          cache.delete(`/__shared-receipts/${shareId}/file`),
        ]);
      }

      router.replace("/transactions");
    } catch {
      setError("Draft belum tersimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="app-page-content max-w-2xl space-y-6 outline-none">
        <PageHeader
          eyebrow="Shared receipt"
          title="Tinjau bukti pembayaran"
          description="FinTrack belum mengubah saldo. Periksa detailnya, lalu simpan sebagai transaksi yang perlu ditinjau."
        />

        {loading ? (
          <Surface className="p-6 text-sm text-slate-500">Menyiapkan bukti share...</Surface>
        ) : error && !metadata ? (
          <Surface role="alert" className="p-6 text-sm text-rose-700">
            {error}
          </Surface>
        ) : (
          <form onSubmit={submit}>
            <Surface className="space-y-5 p-5 sm:p-6">
              {file ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="flex items-center gap-3 truncate">
                      <FileText className="h-5 w-5 shrink-0" />
                      <span className="truncate font-bold">{file.name}</span>
                    </div>
                    {parsing && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ekstraksi AI...
                      </span>
                    )}
                  </div>
                  {parseNotice && (
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{parseNotice}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <ReceiptText className="h-5 w-5" />
                  <span>Teks atau link yang dibagikan akan disimpan sebagai catatan.</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Merchant / penerima" htmlFor="share-merchant">
                  <input
                    id="share-merchant"
                    value={form.merchant}
                    onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                    className={fieldControlStyles}
                  />
                </Field>
                <Field label="Tanggal" htmlFor="share-date">
                  <input
                    id="share-date"
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={fieldControlStyles}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Akun" htmlFor="share-account">
                  <select
                    id="share-account"
                    required
                    value={form.accountId}
                    onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                    className={fieldControlStyles}
                  >
                    <option value="">Pilih akun</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Kategori" htmlFor="share-category">
                  <select
                    id="share-category"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={fieldControlStyles}
                  >
                    <option value="">Pilih kategori</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Nominal" htmlFor="share-amount">
                <input
                  id="share-amount"
                  required
                  min="1"
                  type="number"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={fieldControlStyles}
                />
              </Field>

              <Field label="Catatan" htmlFor="share-note">
                <textarea
                  id="share-note"
                  rows={4}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className={fieldControlStyles}
                />
              </Field>

              {error && (
                <p role="alert" className="text-sm text-rose-700">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => router.replace("/transactions")}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving || parsing || accounts.length === 0}>
                  <Upload className="h-4 w-4" />
                  {saving ? "Menyimpan..." : "Simpan untuk ditinjau"}
                </Button>
              </div>
            </Surface>
          </form>
        )}
      </main>
    </div>
  );
}
