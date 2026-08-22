import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getTranslation,
  isSupportedLanguage,
} from "./i18n";

describe("i18n", () => {
  it("supports Indonesian and English with Indonesian as the default", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["id", "en"]);
    expect(DEFAULT_LANGUAGE).toBe("id");
    expect(isSupportedLanguage("id")).toBe(true);
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
  });

  it("returns the Indonesian source text for the default locale", () => {
    expect(getTranslation("id", "Pengaturan")).toBe("Pengaturan");
  });

  it("returns the English translation when one exists", () => {
    expect(getTranslation("en", "Pengaturan")).toBe("Settings");
    expect(getTranslation("en", "Tampilkan kata sandi")).toBe("Show password");
    expect(getTranslation("en", "Sembunyikan kata sandi")).toBe("Hide password");
  });

  it("translates receipt scan states", () => {
    expect(getTranslation("en", "Ambil foto")).toBe("Take photo");
    expect(getTranslation("en", "Memproses struk...")).toBe("Processing receipt...");
    expect(getTranslation("en", "AI belum bisa menganalisis struk. Silakan isi form manual.")).toBe("AI cannot analyze the receipt yet. Please fill the form manually.");
    expect(getTranslation("en", "Struk terpilih: {name}", { name: "transfer.png" })).toBe("Selected receipt: transfer.png");
  });

  it("translates Insight FX fallback copy", () => {
    expect(getTranslation("en", "Tingkat tabungan")).toBe("Savings rate");
    expect(getTranslation("en", "Kurs IDR belum tersedia untuk {currencies}.", { currencies: "USD" })).toBe("IDR rate unavailable for USD.");
    expect(getTranslation("en", "Arus kas dipisahkan per mata uang")).toBe("Cash flow separated by currency");
    expect(getTranslation("en", "Analitik IDR ditunda")).toBe("IDR analytics paused");
    expect(getTranslation("en", "Perbarui kurs untuk {currencies}; grafik IDR dan AI tetap dinonaktifkan agar nilai tidak tercampur.", { currencies: "USD" })).toBe("Refresh rates for USD; IDR charts and AI remain disabled to prevent mixed values.");
    expect(getTranslation("en", "{count} transaksi masih menunggu peninjauan.", { count: 2 })).toBe("2 transaction(s) still need review.");
  });

  it("falls back to the Indonesian source when a translation is missing", () => {
    expect(getTranslation("en", "Teks baru")).toBe("Teks baru");
  });

  it("interpolates named values without exposing missing placeholders", () => {
    expect(getTranslation("en", "Halo, {name}", { name: "Dewi" })).toBe("Hello, Dewi");
    expect(getTranslation("en", "Halo, {name}")).toBe("Hello, {name}");
  });
});
