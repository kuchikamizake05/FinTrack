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
  });

  it("falls back to the Indonesian source when a translation is missing", () => {
    expect(getTranslation("en", "Teks baru")).toBe("Teks baru");
  });

  it("interpolates named values without exposing missing placeholders", () => {
    expect(getTranslation("en", "Halo, {name}", { name: "Dewi" })).toBe("Hello, Dewi");
    expect(getTranslation("en", "Halo, {name}")).toBe("Hello, {name}");
  });
});
