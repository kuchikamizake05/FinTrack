# FinTrack Premium Onboarding Design

## Goal

Give a genuinely new FinTrack user a calm, premium first-run path to the first useful financial view. Activation is reached when the user creates a first financial account, records a first income or expense against that account, and sees the resulting summary before entering Dashboard.

The experience must feel like the existing FinTrack product: mint canvas, white financial surfaces, navy hierarchy, emerald actions, restrained elevation, concise Indonesian copy, and no decorative gamification. This phase does not change the approved color direction and does not require a database migration.

## Chosen approach

Use a focused guided-activation route rather than a dashboard checklist or a tour of every feature.

The alternatives considered were:

1. **Guided activation — selected.** A short first-run journey creates real data and ends with visible value. It provides the clearest sequence without turning onboarding into a product tour.
2. **Dashboard checklist.** More flexible, but exposes a blank dashboard before the user understands what to do.
3. **Contextual empty states only.** Lowest implementation weight, but does not establish a clear activation path and makes progress easy to lose.

## Activation contract

The onboarding journey has four visible states:

1. **Welcome and intent** — select one lightweight intent: `Rapikan arus kas`, `Pantau saldo`, or `Bangun kebiasaan`. The choice only personalizes supporting copy and is stored locally per authenticated user.
2. **First account** — create one financial account using the existing account rules.
3. **First transaction** — record one income or expense against the newly created account using the existing transaction rules.
4. **First value** — show the saved account, transaction, current balance, and cash-flow impact, then open Dashboard.

The activation event is completion of step 3. Step 4 makes the value visible and records local completion before navigation.

## Eligibility and legacy-user safety

Onboarding is automatic only for a signed-in user who has no existing core financial data and no local completion or deferral marker.

For legacy safety, a user is treated as already active when the initial eligibility check finds at least one existing financial account **or** at least one existing non-deleted transaction. Existing users are never forced through the new journey.

Once a genuinely empty user starts onboarding, a per-user local progress record distinguishes their newly created account from legacy data. During that active journey, creating the account advances to the transaction step rather than causing the legacy-user bypass.

The local record uses a key scoped by Supabase user ID and contains only non-sensitive workflow state:

- selected intent;
- current step;
- created account ID and display name;
- created transaction ID;
- completion timestamp or deferral expiry.

Amounts, balances, merchant names, and notes are never duplicated into local storage. Financial data remains in Supabase under existing RLS policies.

This local-only distinction intentionally avoids a migration. On a different device, an account created during an unfinished onboarding session is treated as existing data and the user is not trapped or forced to repeat setup.

## Entry, redirect, and resume behavior

- Add `/onboarding` as a protected route and include it in the shared protected-route model.
- After session resolution, the default post-login/root destination runs a minimal eligibility check.
- A signed-in empty user is directed to `/onboarding`.
- An already-active user continues to the sanitized internal `next` destination or `/dashboard`.
- A new user cannot bypass an active onboarding journey by navigating directly to another protected route unless they choose `Lanjutkan nanti`.
- `Lanjutkan nanti` creates a seven-day per-user deferral, opens Dashboard, and exposes a restrained `Selesaikan penyiapan` resume card on the empty dashboard.
- The resume card can reopen `/onboarding` and can be dismissed for the remainder of the current deferral window.
- Completion removes active progress and deferral state, writes a local completion timestamp, and replaces history with `/dashboard`.
- Logout never clears another user's onboarding state because every key is scoped to the authenticated user ID.

## Route and component architecture

### `/onboarding`

The route owns:

- loading the authenticated user and eligibility snapshot;
- restoring safe local progress;
- querying the created account when resuming;
- performing account and transaction mutations;
- step navigation and recovery;
- the final live summary.

It uses a dedicated onboarding shell without the main Navbar so that one task remains visually dominant.

### Shared onboarding gate

A focused client boundary coordinates post-login and protected-route routing. It depends on the existing authenticated application boundary and never replaces Supabase authorization. It performs only the eligibility reads needed for empty-user detection and caches the resolved decision for the current browser session.

The gate has explicit states: `loading`, `legacy-active`, `onboarding-required`, `onboarding-active`, `deferred`, and `completed`. Public routes remain unaffected.

### `lib/onboarding.ts`

Pure, testable logic owns:

- eligibility resolution;
- progress-record parsing and versioning;
- current-step resolution;
- progress percentage and labels;
- redirect decisions;
- per-user storage-key construction;
- deferral expiry calculation;
- concise account and transaction form validation composition;
- completion-summary calculations.

The module does not access `window`, Supabase, React state, or the router.

### Reused domain rules

Account validation composes the existing rules from `lib/accounts.ts`. Transaction validation composes the existing rules from `lib/transactions.ts`. Onboarding does not create a second financial interpretation of balances, categories, or transaction types.

## Form contracts

### First account

Required fields:

- account name;
- account kind;
- currency (`IDR` or `USD`);
- opening balance.

Institution is optional. A non-IDR account may provide an optional manual IDR reporting value. The form applies the same validation, saving, error, and duplicate-submission behavior as Accounts.

### First transaction

Required fields:

- type (`income` or `expense`);
- account, preselected to the newly created account;
- amount;
- merchant/source label;
- date;
- category, defaulting to an existing category when available or `Lainnya` otherwise.

Note is optional. Only a confirmed income or expense counts as activation. Transfers, deleted records, pending approval, and review drafts do not satisfy the onboarding transaction step.

The account mutation must finish successfully before the transaction form can use its ID. The transaction insert must finish successfully before the completion summary appears.

## Visual and responsive design

Desktop uses a two-column layout related to Login:

- a calm left rail with FinTrack identity, step progress, and one short value statement;
- a wider right work area containing the active form or summary;
- no main application navigation during the focused journey.

Mobile uses a single column:

- compact brand row and `Langkah X dari 3` progress at the top;
- form content on the page surface rather than a modal;
- sticky action area only when needed, padded for `env(safe-area-inset-bottom)`;
- no horizontal scrolling and no content hidden behind browser or PWA chrome.

Visual rules:

- mint-to-white base canvas;
- white primary surface, emerald focus/action color, navy text hierarchy;
- grouping through spacing and dividers before borders or shadows;
- no card-inside-card layouts;
- no confetti, oversized illustration, emoji, neon color, or decorative progress gamification;
- Lucide icons only where they clarify meaning;
- completion uses a restrained checkmark and real saved values.

## Interaction and accessibility

- One primary action per step.
- `Kembali` preserves unsaved local form state within the current session.
- `Lanjutkan nanti` is always available after Welcome and explains that setup can resume from Dashboard.
- Browser back/forward does not silently discard saved progress.
- Buttons and controls have at least a 44px target.
- Forms use persistent labels, field-adjacent errors, and a form-level `aria-live` save error.
- Progress uses visible text in addition to color or width.
- The page has one level-one heading and a logical focus order.
- Step changes move focus to the new heading without surprising screen-reader users.
- Saving states disable duplicate submission and announce progress.
- Reduced-motion preferences remove non-essential transitions.

## Error and recovery behavior

- Eligibility failure shows a branded retry state and never assumes the user is new.
- Invalid or version-mismatched local progress is ignored safely and reconstructed from server data where possible.
- Account-save failure preserves all account inputs and stays on the account step.
- Transaction-save failure preserves all transaction inputs and stays on the transaction step.
- If the locally stored account no longer exists, the flow returns to the account step with a concise explanation.
- If a transaction succeeds but the client loses the response, the resume check searches for a linked confirmed transaction before asking the user to submit again.
- Offline entry shows the existing branded offline recovery. No onboarding mutation is queued silently.
- Completion navigation uses `router.replace` so the completed wizard is not reopened by a normal Back action.

## Empty-dashboard continuation

When onboarding is deferred, Dashboard may show one compact setup card only when the financial overview is still empty. It contains:

- current progress, such as `1 dari 2 langkah data selesai`;
- one sentence explaining the next value-producing action;
- primary action `Selesaikan penyiapan`;
- secondary dismiss action limited to the current deferral window.

The card disappears when onboarding completes or when existing data makes the user active. It does not coexist with a fully populated dashboard.

## Testing and release gates

### Unit tests

- new empty user eligibility;
- legacy account-only and transaction-only bypass;
- active-journey continuation after account creation;
- malformed/version-mismatched progress recovery;
- per-user storage keys;
- seven-day deferral boundaries;
- every step-resolution and redirect branch;
- account and transaction validation composition;
- completion-summary calculations.

### Browser E2E

Using mocked Supabase only, on both desktop Chromium and Pixel 7 emulation:

- a new signed-in user enters onboarding;
- intent selection and step progress work;
- invalid account and transaction submissions stay in place with accessible errors;
- successful account creation advances exactly once;
- successful transaction creation advances exactly once;
- refresh resumes the correct step;
- save failure preserves inputs and retry succeeds;
- `Lanjutkan nanti` reaches Dashboard and the resume card returns to onboarding;
- legacy account-only and transaction-only users bypass onboarding;
- completion shows real mocked values and replaces navigation with Dashboard;
- no page-level horizontal overflow;
- no hydration mismatch, uncaught page error, or unexpected console error.

E2E fixtures must intercept every Supabase read and write. They must never write to the configured personal database.

### Release gates

- full unit suite passes with at least 80% coverage;
- ESLint and TypeScript pass;
- optimized Next.js build passes;
- desktop and mobile onboarding E2E pass;
- dependency audit has no unresolved production vulnerability;
- the existing production-readiness, auth, PWA, and core-route E2E remain green.

## Success criteria

- A genuinely empty user reaches a meaningful dashboard from login without deciding where to start.
- The first-value path requires only one account and one transaction, with no feature tour.
- A user can defer or recover without losing saved progress or being trapped.
- Existing users are never forced through onboarding.
- No financial payload is persisted outside Supabase.
- Desktop and mobile preserve the same hierarchy, accessibility, and premium restrained visual language.

## Out of scope

- Database migrations or a server-side onboarding-profile table.
- Product analytics, third-party event tracking, onboarding emails, push notifications, or external CRM automation.
- Importing bank data, connecting providers, sample financial records, or demo-mode data.
- Telegram/n8n setup inside the first-run flow.
- Investment, trading, or AI-insight education during onboarding.
- New color, typography, icon, or navigation systems.
