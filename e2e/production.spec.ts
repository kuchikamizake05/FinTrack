import { expect, mockSupabase, test } from "./fixtures";

test("serves security and service-worker headers @critical", async ({ request }) => {
  const pageResponse = await request.get("/login");
  expect(pageResponse.headers()["x-frame-options"]).toBe("DENY");
  expect(pageResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(pageResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.headers()["cache-control"]).toContain("no-store");
  expect(workerResponse.headers()["content-type"]).toContain("application/javascript");
});

test("ships valid PNG install icons", async ({ request }) => {
  for (const size of [192, 512]) {
    const response = await request.get(`/icons/icon-${size}.png`);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = new Uint8Array(await response.body());
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  }
});

test("serves a complete install manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#15803d");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }),
  ]));
});

test("keeps invalid API responses private and safely validated @critical", async ({ request }) => {
  const response = await request.post("/api/trades/not-a-uuid/review", {
    headers: { Authorization: "Bearer invalid" },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toEqual({ error: "Permintaan atau sesi tidak valid." });
});

test.describe("offline PWA", () => {
  test.use({ allowOfflineConsoleErrors: true });

  test("uses the branded fallback for an uncached offline navigation", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Service-worker coverage uses Chromium");
    await mockSupabase(page, false);
    await page.goto("/login");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    const cachedOfflinePage = await page.evaluate(async () => {
      const response = await caches.match("/offline");
      return response?.text() ?? null;
    });
    expect(cachedOfflinePage).toContain("Koneksi sedang terputus");

    await context.setOffline(true);
    await page.goto(`/offline-check-${Date.now()}`);
    await expect(page.getByRole("heading", { name: "Koneksi sedang terputus" })).toBeVisible();
    await context.setOffline(false);
  });
});

test("has no page-level horizontal overflow on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only layout assertion");
  await mockSupabase(page, false);
  await page.goto("/login");
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
});
