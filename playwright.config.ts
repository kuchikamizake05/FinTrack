import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
    serviceWorkers: "allow",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://e2e-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
      N8N_TRADE_REVIEW_WEBHOOK_URL: "https://workflow.invalid/review",
      N8N_TRADE_REVIEW_SHARED_SECRET: "e2e-only-secret",
    },
  },
});
