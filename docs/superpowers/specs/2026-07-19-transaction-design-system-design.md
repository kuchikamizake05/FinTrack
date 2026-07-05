# FinTrack Transaction & Shared UI Design

## Objective

Bring the transaction workflow into the approved FinTrack visual language: calm mint canvas, white financial surfaces, navy hierarchy, emerald actions, restrained elevation, and mobile-first interaction. The existing Supabase behavior remains unchanged.

## Chosen approach

Build a deliberately small shared UI foundation while redesigning the Transactions page. This avoids a superficial recolor and avoids introducing a large component library before the product needs it.

Alternatives considered:

1. Recolor the existing transaction page. Fast, but preserves the dense desktop table, weak mobile hierarchy, and inconsistent modal.
2. Redesign Transactions with page-local markup. Visually effective, but repeats patterns that Accounts and other pages will need next.
3. Create five shared primitives and use them on Transactions. Chosen because it improves this core flow while establishing reusable boundaries without over-engineering.

## Shared UI foundation

Create focused components under `components/ui/`:

- `PageHeader`: eyebrow, title, description, and responsive actions.
- `Surface`: white bordered content surface with consistent radius and elevation.
- `Button`: primary, secondary, ghost, and destructive variants with 44–48px interactive height.
- `Field`: shared label, hint/error text, and control styling contract.
- `EmptyState`: icon, title, description, and optional action.

These components own presentation only. They do not fetch data or contain transaction-specific business logic.

## Transaction page information architecture

1. Page header: clear title, transaction count, Categories link, CSV export, and one emerald primary action.
2. Summary strip: visible totals for income, expense, and net amount derived from currently filtered transactions.
3. Filter surface: prominent search, type/category/status filters, collapsible date range on small screens, and a clear-filter action when filters are active.
4. Results:
   - Desktop: compact ledger table with merchant/date, account/category, amount/status, and contextual actions.
   - Mobile: stacked transaction cards with the same information and no horizontal scrolling.
5. Empty state: distinguishes no transactions from no filter matches.
6. Add/edit form: centered dialog on desktop and bottom sheet on mobile. Expense/income selection, account, amount, merchant, date, category, and note use clear labels and accessible controls.

## Data and behavior

- Preserve the existing Supabase reads and mutations.
- Preserve filters, CSV export, edit, soft delete, restore, receipt links, and source/status metadata.
- Move pure display and form helpers to `lib/transactions.ts` so they can be unit tested.
- Replace browser alerts for validation/save failures with an inline form message using `aria-live`.
- Disable save while a request is in progress and prevent duplicate submission.
- Escape CSV values correctly, including quotes and commas.

## Responsive behavior

- Desktop breakpoint uses the ledger table; mobile uses cards.
- Header actions wrap safely and the primary action remains obvious.
- Bottom sheet respects `100svh`, safe-area padding, and scrollable content.
- Mobile fields and action buttons are at least 44px high.
- The fixed mobile navigation must never cover the last result or sheet actions.

## Accessibility

- Every icon-only action has an accessible name.
- The dialog has `role="dialog"`, `aria-modal="true"`, an associated title, Escape handling, and background-scroll locking.
- Form validation and save errors are announced with `aria-live`.
- Color is not the only indicator for transaction type or status.
- Focus-visible styling follows the global emerald focus ring.

## Testing and verification

- Unit tests for summary calculation, active-filter detection, form validation, source/status labels, and CSV escaping.
- Existing finance tests must remain green.
- Run lint, TypeScript, full tests, and production build.
- Browser QA at desktop and 390×844 mobile sizes, including filter controls and opening the add transaction form.
- Confirm zero horizontal overflow, no clipped actions, no console errors, and visual consistency with the approved dashboard/login reference.

## Out of scope

- Database schema changes.
- New transaction fields or automation.
- Redesigning Accounts, Categories, Investments, Trading, or Settings in this pass.
- Changing the established green color direction.
