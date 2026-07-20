import { expect, test as base, type Page } from "@playwright/test";

const userId = "6f432126-65da-4a44-b93d-9d86b2e4c980";
const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQxMDI0NDQ4MDAsInN1YiI6IjZmNDMyMTI2LTY1ZGEtNGE0NC1iOTNkLTlkODZiMmU0Yzk4MCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.e2e-signature";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "qa@fintrack.local",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  phone: "",
  confirmed_at: "2026-01-01T00:00:00.000Z",
  last_sign_in_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "FinTrack QA" },
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  is_anonymous: false,
};

type FinTrackFixtures = {
  allowOfflineConsoleErrors: boolean;
  allowedConsoleErrors: string[];
  consoleErrors: string[];
  pageErrors: string[];
};

export const test = base.extend<FinTrackFixtures>({
  allowOfflineConsoleErrors: [false, { option: true }],
  allowedConsoleErrors: [[], { option: true }],
  consoleErrors: [async ({ page, allowOfflineConsoleErrors, allowedConsoleErrors }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await use(errors);
    const unexpectedErrors = allowOfflineConsoleErrors
      ? errors.filter((message) => !message.includes("net::ERR_INTERNET_DISCONNECTED"))
      : errors;
    const filteredErrors = unexpectedErrors.filter((message) => !allowedConsoleErrors.some((allowed) => message.includes(allowed)));
    expect(filteredErrors, `Unexpected console errors:\n${filteredErrors.join("\n")}`).toEqual([]);
  }, { auto: true }],
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await use(errors);
    expect(errors, `Uncaught page errors:\n${errors.join("\n")}`).toEqual([]);
  }, { auto: true }],
});

export async function mockAuthenticatedSession(page: Page, onboardingCompleted = true) {
  await page.addInitScript(({ storageKey, session, progressKey, progress }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
    if (progress) window.localStorage.setItem(progressKey, JSON.stringify(progress));
  }, {
    storageKey: "sb-e2e-project-auth-token",
    session: {
      access_token: accessToken,
      refresh_token: "e2e-refresh-token",
      expires_in: 3600,
      expires_at: 4_102_444_800,
      token_type: "bearer",
      user,
    },
    progressKey: `fintrack:onboarding:v1:${userId}`,
    progress: onboardingCompleted ? {
      version: 1,
      userId,
      step: "summary",
      intent: "cash-flow",
      accountId: null,
      accountName: null,
      transactionId: null,
      completedAt: "2026-07-20T00:00:00.000Z",
      deferredUntil: null,
    } : null,
  });
}

export async function mockSupabase(page: Page, authenticated: boolean) {
  let signedIn = authenticated;
  if (authenticated) {
    await mockAuthenticatedSession(page);
  }

  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      signedIn = true;
      await route.fulfill({
        status: 200,
        json: {
          access_token: accessToken,
          refresh_token: "e2e-refresh-token",
          expires_in: 3600,
          expires_at: 4_102_444_800,
          token_type: "bearer",
          user,
        },
      });
      return;
    }
    if (url.pathname === "/auth/v1/signup") {
      await route.fulfill({ status: 200, json: { user, session: null } });
      return;
    }
    if (url.pathname === "/auth/v1/recover") {
      await route.fulfill({ status: 200, json: {} });
      return;
    }
    if (url.pathname === "/auth/v1/otp") {
      await route.fulfill({ status: 200, json: {} });
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill(signedIn
        ? { status: 200, json: user }
        : { status: 401, json: { message: "invalid session" } });
      return;
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" },
        body: "[]",
      });
      return;
    }
    await route.fulfill({ status: 404, json: { message: "Unmocked E2E Supabase route" } });
  });
}

export { expect, user, userId };
