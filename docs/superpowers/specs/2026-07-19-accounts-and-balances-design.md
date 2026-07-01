# FinTrack Accounts & Balances Design

## Objective

Redesign Accounts & Saldo into a calm financial overview that balances two jobs: understanding total wealth at a glance and managing accounts without friction. The page must follow the established FinTrack language: mint canvas, white financial surfaces, navy hierarchy, emerald actions, restrained elevation, and responsive mobile-first interaction.

The approved visual direction is **Calm Overview**. Net worth is the visual anchor, followed by a clean account ledger and focused management actions. Existing Supabase behavior and the user's preferred green palette remain unchanged.

## Approaches considered

1. **Calm Overview — chosen.** Net worth leads, followed by a scan-friendly account ledger. This creates the best balance between financial understanding and account management, and matches Dashboard and Transactions.
2. **Account Gallery.** Larger wallet-style cards make each account feel more personal, but create visual noise and become less efficient as the account count grows.
3. **Finance Command Center.** A denser split layout surfaces more controls at once, but is harder to keep calm and responsive on mobile.

## Information architecture

The page is organized in this order:

1. **Page header**
   - Eyebrow, title, and short description using the shared `PageHeader` pattern.
   - `Tambah akun` is the emerald primary action.
   - `Transfer` is the secondary action and is disabled until at least two active accounts exist.
2. **Wealth overview**
   - Net worth is the largest value.
   - Supporting metrics show total assets, total liabilities, and active account count.
   - A small explanatory label makes the calculation explicit: active assets minus active liabilities, reported in IDR.
3. **Attention message**
   - If an active foreign-currency account has no manual IDR reporting value, show a clear amber notice.
   - The notice states how many accounts are excluded from the IDR totals and offers a direct update action for the first affected account.
4. **Account ledger**
   - Filter tabs: `Semua`, `Dana likuid`, `Investasi`, `Trading`, and `Kewajiban`.
   - `Dana likuid` combines `bank` and `ewallet`; other tabs map directly to their account kind.
   - Each account shows name, institution, localized kind, currency, current balance, optional IDR equivalent, active state, and last-updated time.
   - The row/card action is `Perbarui saldo`.
5. **Empty states**
   - No accounts: explain the value of adding a first account and show `Tambah akun`.
   - No filter matches: explain that the selected group is empty and show `Lihat semua akun`.

Savings goals, charts, transfer history, and new navigation are excluded from this pass so the page remains focused.

## Visual and responsive behavior

- Reuse `Surface`, `Button`, `PageHeader`, `Field`, and `EmptyState` from the shared UI foundation.
- Use white surfaces, emerald accents, navy text, and the current mint page background. Remove the legacy violet/dark styling from Accounts.
- Use financial numerals with stable alignment and Indonesian currency formatting. Foreign balances retain their own currency symbol/code and show a separate IDR equivalent when available.
- Desktop uses spacious ledger rows with aligned metadata, balance, freshness, and action columns.
- Mobile uses one-column account cards with the balance and update action kept above the fold of each card. No horizontal scrolling is permitted.
- Add account, transfer, and update balance use a centered dialog on desktop and a bottom sheet on mobile.
- Bottom sheets respect `100svh`, safe-area padding, internal scrolling, and the fixed mobile navigation.
- Primary inputs and buttons have a minimum 44px touch target. Motion respects `prefers-reduced-motion`.

## Component and code boundaries

The Accounts route remains responsible for authentication, Supabase reads/mutations, open-dialog state, and refreshing server data.

Pure account logic belongs in a focused helper module, `lib/accounts.ts`:

- localized account-kind labels;
- account filter mapping and filtering;
- IDR reporting value resolution;
- total assets, liabilities, net worth, and active account count;
- missing foreign-value detection;
- add-account, transfer, and balance-form validation;
- date/freshness display helpers where deterministic testing is practical.

Small page-level components may be extracted when they have a single purpose, such as the wealth overview, account list, and responsive dialog shell. Presentation components do not fetch data or perform Supabase mutations.

The existing `lib/ledger.ts` calculation and transfer rules remain the low-level financial primitives. `lib/accounts.ts` composes them into page-specific summaries and validation results rather than duplicating those rules.

## Data contract and calculations

No database migration is required.

The Accounts query reads:

- `id`
- `name`
- `institution`
- `kind`
- `currency`
- `current_balance`
- `reporting_balance_idr`
- `is_active`
- `updated_at`

Only active accounts contribute to overview totals:

- IDR accounts use `current_balance`.
- Foreign-currency accounts use `reporting_balance_idr`.
- Foreign-currency accounts without `reporting_balance_idr` contribute zero and are explicitly listed by the attention rule.
- Asset total includes `bank`, `ewallet`, `investment`, and `trading`.
- Liability total includes `liability` as a positive displayed obligation.
- Net worth equals asset total minus liability total.

Inactive accounts may remain visible in the `Semua` view with a muted inactive badge, but never contribute to totals or valid transfer choices. The page does not add account activation/deactivation controls in this pass.

## Forms and interactions

### Add account

- Fields: account name, institution, account kind, currency, opening balance, and manual IDR equivalent for non-IDR accounts.
- Supported currency options remain IDR and USD in this pass.
- Name is required after trimming.
- Currency must be a three-letter uppercase code.
- Opening balance must be finite. Negative balances remain allowed only for compatibility with the existing data contract; liabilities should normally be entered as positive obligations and are subtracted in the overview.
- Manual IDR equivalent is optional for foreign accounts but, when provided, must be finite and non-negative.

### Transfer

- Only active accounts appear in source and destination options.
- Source and destination must be different.
- Sent amount must be positive.
- Same-currency transfers reuse the sent amount as the received amount.
- Cross-currency transfers require a positive received amount and show both currencies clearly.
- Transfer kind remains `transfer`, `broker_deposit`, or `broker_withdrawal`.
- Date is required; note is optional.

### Update balance

- The form identifies the selected account and its currency.
- Current balance must be finite.
- A foreign account may also receive a manual non-negative IDR equivalent.
- Supporting copy explains that the update is a balance snapshot and does not replace transaction or transfer history.

All forms provide field-adjacent validation, a form-level save error announced with `aria-live`, a disabled saving state, and duplicate-submission protection. Failed saves keep user input intact. Successful saves close the dialog/sheet, reset the relevant form, reload accounts, and return focus to the trigger when practical.

## Loading, errors, and recovery

- Initial loading uses skeleton surfaces shaped like the overview and account rows/cards.
- Page-load errors appear in a visible alert with a `Coba lagi` action.
- Save errors stay inside the active dialog/sheet and do not replace the page-level state.
- Missing authentication follows the existing Navbar/login redirect behavior; the page does not introduce a second authentication flow.
- If a transfer becomes invalid because an account is removed or deactivated during editing, the save error is preserved and the account list is refreshed before retry.

## Accessibility

- Dialogs use `role="dialog"`, `aria-modal="true"`, an associated title, Escape handling, background-scroll locking, and sensible initial focus.
- Icon-only controls have accessible names.
- Filter tabs expose selected state using `aria-pressed` or the appropriate tab semantics.
- Errors and save status use `aria-live`; color is never the only status indicator.
- Focus-visible styling follows the global emerald focus ring.
- Account balances, kinds, and activity state remain understandable to screen readers without relying on spatial position.

## Testing and verification

- Add unit tests for account filtering, kind labels, totals, missing foreign values, and all form-validation branches.
- Preserve and extend `lib/ledger.test.ts` only when a low-level financial rule changes; this redesign should not change its current contract.
- Run the complete unit test suite and confirm project coverage remains at least 80%.
- Run lint, TypeScript checking, production build, and dependency audit.
- Browser QA at desktop and 390×844 mobile sizes.
- Exercise filter switching, opening each form, valid/invalid states, same-currency transfer, cross-currency transfer, and mobile bottom-sheet scrolling without writing production data.
- Confirm no horizontal overflow, no content hidden behind mobile navigation, usable touch targets, correct focus behavior, and no console errors.
- Compare the final desktop and mobile screens against the approved Calm Overview reference and the existing Dashboard/Transactions visual language.

## Out of scope

- Database schema changes.
- Savings goals or account-specific goals.
- Charts and historical net-worth trends.
- Transfer history or transfer editing/deletion.
- Account activation/deactivation or deletion.
- Automatic FX conversion or live exchange-rate integrations.
- New currencies beyond the currently supported IDR and USD options.
- Redesigning Categories, Investments, Trading, or Settings.

## Success criteria

- A user can understand net worth, asset/liability composition, and account freshness within a few seconds.
- Adding an account, transferring funds, or updating a balance takes no more than two obvious actions from the page.
- Desktop and mobile retain the same information hierarchy without horizontal scrolling or clipped controls.
- Foreign-currency exclusions are explicit rather than silently misrepresented.
- The page visually belongs to the same premium, calm FinTrack system as Dashboard, Login, and Transactions.
