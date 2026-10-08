import { expect, mockSupabase, test } from "./fixtures";

test.describe("navbar keyboard navigation @critical", () => {
  test("mobile More menu contains focus and returns it after Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Keuanganmu", exact: true })).toBeVisible();
    const trigger = page.getByRole("button", { name: "Lainnya", exact: true });
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Lainnya", exact: true });
    const close = dialog.getByRole("button", { name: "Tutup menu", exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("link", { name: "Pengaturan", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("profile menu supports arrow keys and closes on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockSupabase(page, true);
    await page.goto("/dashboard");
    const trigger = page.getByRole("button", { name: "qa@fintrack.local" });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Profil dan navigasi lainnya" });
    await expect(menu.getByRole("menuitem", { name: "Dompet & akun" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Analisis keuangan" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Keluar akun" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Dompet & akun" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(menu.getByRole("menuitem", { name: "Keluar akun" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(menu.getByRole("menuitem", { name: "Dompet & akun" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});
