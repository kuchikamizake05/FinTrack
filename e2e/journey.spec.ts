import { expect, mockSupabase, test } from "./fixtures";
import { JOURNEY_MISSIONS, type JourneyState } from "../src/lib/journey";

test("Journey confirms once, persists, and unlocks milestones @smoke", async ({ page }, testInfo) => {
  await mockSupabase(page, true);
  const state: JourneyState = { week: "2026-09-07", totalXp: 270, completed: [], completeWeeks: 2, goalAchieved: false };
  let writes = 0;
  await page.route("**/rest/v1/rpc/get_financial_journey", (route) => route.fulfill({ json: state }));
  await page.route("**/rest/v1/rpc/complete_financial_journey", (route) => {
    const mission = JOURNEY_MISSIONS.find((item) => item.id === route.request().postDataJSON().mission_id);
    if (!mission) throw new Error("Unexpected mission");
    writes++;
    if (!state.completed.includes(mission.id)) {
      state.completed.push(mission.id);
      state.totalXp += mission.xp;
    }
    return route.fulfill({ json: state });
  });
  await page.goto("/dashboard");
  const summary = page.getByRole("link", { name: "Lihat perjalanan Financial Journey" }).filter({ visible: true });
  await expect(summary.getByText("270 / 300 XP")).toBeVisible();
  expect(await summary.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(150);
  await expect(page.getByRole("button", { name: /Selesaikan misi/ })).toHaveCount(0);
  await summary.screenshot({ path: testInfo.outputPath("journey-summary.png") });
  await summary.click();
  await expect(page).toHaveURL(/\/journey$/);
  const card = page.getByRole("region", { name: "Financial Journey" }).filter({ visible: true });
  await expect(card.getByText("270 / 300 XP")).toBeVisible();
  await card.getByRole("button", { name: "Selesaikan misi : Review transaksi", exact: true }).click();
  expect(writes).toBe(0);
  await card.getByRole("button", { name: "Batal", exact: true }).click();
  expect(writes).toBe(0);
  await card.getByRole("button", { name: "Selesaikan misi : Review transaksi", exact: true }).click();
  await card.getByRole("button", { name: "Sudah aku review", exact: true }).click();
  await expect(card.getByText("Level 2 · Mulai teratur")).toBeVisible();
  await expect(card.getByText("0 / 300 XP")).toBeVisible();
  await expect(card.getByRole("button", { name: "Selesaikan misi : Review transaksi", exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
  await page.getByRole("link", { name: "Kembali ke dashboard" }).click();
  await expect(summary.getByText("Level 2")).toBeVisible();
  await expect(summary.getByText("1/3 misi minggu ini selesai")).toBeVisible();
  await summary.click();
  await expect(page).toHaveURL(/\/journey$/);
  await expect(card.getByText("Minggu ini · 1/3 selesai")).toBeVisible();
  await page.reload();
  await expect(card.getByText("Minggu ini · 1/3 selesai")).toBeVisible();
  await expect(card.getByText("300 XP terkumpul", { exact: false })).toBeVisible();
  // A new server week resets missions, not lifetime progress.
  state.week = "2026-09-14";
  state.completed = [];
  await page.reload();
  await expect(card.getByText("Minggu ini · 0/3 selesai")).toBeVisible();
  await expect(card.getByText("Level 2 · Mulai teratur")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await card.screenshot({ path: testInfo.outputPath("financial-journey.png") });
});

test("Journey never awards unsaved progress and recovers from an unavailable service", async ({ page }) => {
  // Isolate manual retries: focus-triggered refresh can otherwise recover between
  // switching the mock online and clicking Retry, removing the button mid-test.
  await page.addInitScript(() => {
    window.addEventListener("focus", (event) => event.stopImmediatePropagation(), true);
  });
  await mockSupabase(page, true);
  let unavailable = true;
  const state = { week: "2026-09-07", totalXp: 0, completed: [], completeWeeks: 0, goalAchieved: false };
  await page.route("**/rest/v1/rpc/get_financial_journey", (route) => route.fulfill({ json: unavailable ? {} : state }));
  await page.route("**/rest/v1/rpc/complete_financial_journey", (route) => route.fulfill({ json: {} }));
  await page.goto("/journey");
  const card = page.getByRole("region", { name: "Financial Journey" }).filter({ visible: true });
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  unavailable = false;
  await card.getByRole("button", { name: "Coba lagi" }).click();
  await expect(card.getByText("0 / 300 XP")).toBeVisible();
  await card.getByRole("button", { name: "Selesaikan misi : Review transaksi", exact: true }).click();
  await card.getByRole("button", { name: "Sudah aku review", exact: true }).click();
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(card.getByText("0 / 300 XP")).toBeVisible();
  await expect(card.getByText("Minggu ini · 0/3 selesai")).toBeVisible();
  await card.getByRole("button", { name: "Coba lagi" }).click();
  await expect(card.getByRole("alert")).toHaveCount(0);
});
