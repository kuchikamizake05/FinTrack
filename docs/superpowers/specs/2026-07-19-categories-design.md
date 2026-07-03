# FinTrack Categories Design

## Objective

Redesign Categories into a calm management ledger that helps users organize income and expenses, understand category usage, and maintain custom categories without damaging historical transaction labels. The screen follows the established FinTrack system: mint canvas, white financial surfaces, navy hierarchy, emerald actions, restrained elevation, and responsive mobile-first interaction.

The approved visual direction is **Category Ledger**. This pass includes full management for custom categories, dynamic category options in Transactions, and no database migration.

## Roadmap context

This is the first of five independent product passes:

1. Categories.
2. PWA hardening.
3. Investments.
4. Trading.
5. Settings.

Each pass receives its own design, implementation, verification, and responsive QA cycle. This specification covers Categories only.

## Approaches considered

1. **Category Ledger — chosen.** A compact summary followed by a scan-friendly list. This best matches Transactions and remains calm as the category count grows.
2. **Category Gallery.** Larger colored cards feel more personal but become visually noisy on desktop.
3. **Usage First.** Ranked usage bars surface stronger analysis but push category management into a secondary role and duplicate dashboard responsibilities.

## Information architecture

The page is organized in this order:

1. **Page header**
   - Eyebrow, title, and a concise explanation using the shared `PageHeader` pattern.
   - `Tambah kategori` is the single primary action.
2. **Usage overview**
   - Total visible categories.
   - Categories used in confirmed transactions this month.
   - Confirmed transaction count this month.
3. **Filter controls**
   - Tabs: `Pengeluaran`, `Pemasukan`, and `Semua`.
   - Search by category name.
   - A reset action appears when search or non-default filters are active.
4. **Category ledger**
   - Each item shows icon, color, name, income/expense type, `Bawaan` or `Kustom`, current-month amount, current-month confirmed transaction count, and available actions.
   - Built-in categories are read-only.
   - Custom categories expose Edit and Delete actions.
5. **Empty states**
   - No custom categories: the built-in system remains visible and supporting copy invites the user to add a personal category.
   - No filtered results: explain the mismatch and provide a reset action.

Desktop uses ledger rows with aligned columns. Mobile uses one-column category cards with usage and actions kept readable without horizontal scrolling.

## Category management rules

### Built-in categories

- A category with `user_id = null` is built-in.
- Built-in categories cannot be edited or deleted.
- They remain available to every authenticated user through existing RLS policies.

### Custom categories

- A category with `user_id` matching the authenticated user is custom.
- Custom categories can be created and deleted.
- Name and type can be edited only when the category has never been used by one of the user's non-deleted transactions.
- Color and icon can always be edited because they do not alter historical financial meaning.
- The UI clearly explains why name and type are locked for a used category.

### Names and duplicates

- Category names are trimmed and required.
- Duplicate detection is case-insensitive across all visible built-in and custom categories.
- Editing a category does not count its own current name as a duplicate.
- Names are capped at 48 characters in the client validation layer.
- No database constraint or migration is added in this pass.

### Deletion

- Only a custom category can be deleted.
- Deletion uses an in-app confirmation dialog/bottom sheet, never browser `confirm` or `alert`.
- The confirmation displays all-time non-deleted transaction usage for that category and explains that historical transactions retain the category text.
- Deleting a category removes it from future transaction selection but does not rewrite existing transaction rows.
- Save/delete failures preserve the current dialog state and display an inline error.

## Form design

Create and edit share one responsive form:

- Name.
- Type: income or expense.
- Icon selected from a small allowlist of supported Lucide icon names.
- Color selected from restrained semantic presets plus the existing native custom color input.

The icon allowlist is explicit and maps stored names to imported Lucide components. Unknown stored icon values safely fall back to `Tag`.

On desktop, the form appears in a centered dialog. On mobile, it becomes a bottom sheet with `100svh` bounds, internal scrolling, safe-area padding, and sticky actions. The delete confirmation follows the same responsive pattern.

## Usage calculations

Two scopes are intentionally distinct:

- **Current-month display usage** counts only `confirmed` transactions in the current calendar month. It provides the amount and frequency shown in the overview and ledger.
- **All-time management usage** counts every non-deleted transaction belonging to the user. It determines whether name/type editing is locked and informs delete confirmation.

Usage is grouped by the exact stored transaction category string. Income and expense amounts are not combined across mismatched types. The displayed category type comes from the category record; historical transaction rows preserve their own transaction type.

## Transactions integration

The Transactions page stops using a hard-coded category array.

- Load built-in and user-owned categories from the existing `categories` table.
- Add/edit transaction forms show categories matching the selected transaction type.
- If an existing transaction uses a historical or deleted category, preserve it as a temporary option while editing that transaction.
- The category filter combines active category records with unique category strings present in loaded transactions, so historical labels remain filterable.
- If no category exists for a transaction type, the form explains how to create one and links to Categories.

No new route or schema is introduced.

## Component and code boundaries

The Categories route owns authentication, Supabase reads/mutations, dialog state, and data refresh.

Pure category logic belongs in `lib/categories.ts`:

- category and usage types;
- current-month usage aggregation;
- all-time usage aggregation;
- summary calculation;
- search and type filtering;
- duplicate-name validation;
- create/edit validation;
- edit-lock rules;
- icon-name normalization;
- dynamic transaction-category option construction.

Presentation components may be extracted for the usage overview, ledger, category identity, category form, and delete confirmation. They do not fetch Supabase data.

Transactions imports only the pure option-building helpers it needs. Categories-specific mutations remain inside the Categories route.

## Data flow

The Categories page loads these resources after authenticating:

1. Visible categories ordered by type and name.
2. The user's current-month confirmed transactions with `category`, `amount`, and `type`.
3. The user's all-time non-deleted transactions with `category` and `type`.

Independent reads should run in parallel after authentication. Derived summaries and filtered lists use memoized pure helpers.

Mutations use existing table policies:

- Insert a category with the authenticated `user_id`.
- Update only a category whose `id` and `user_id` both match.
- Delete only a category whose `id` and `user_id` both match.

No table, column, index, trigger, SQL function, or migration is added.

## Loading, errors, and recovery

- Initial loading uses skeletons shaped like the usage overview and category ledger.
- Load errors appear in a visible alert with `Coba lagi`.
- Form validation is field-adjacent.
- Mutation errors stay inside the active dialog and use `aria-live`.
- Save/delete buttons disable while pending and duplicate submission is prevented.
- Failed mutations retain user input.
- Successful mutations close the dialog, reset the relevant form, reload categories and usage, and restore focus to the trigger where practical.

## Accessibility

- Dialogs use `role="dialog"`, `aria-modal="true"`, associated titles, Escape handling, body-scroll locking, and sensible initial focus.
- Icon-only controls have accessible names.
- Type tabs and segmented form controls expose selected state.
- Color choices expose readable names or color values and selected state; color is never the only indicator of category type or ownership.
- Form errors and mutation status use `aria-live`.
- Focus-visible styling follows the global emerald focus ring.
- Interactive targets are at least 44px on mobile.

## Testing and verification

- Unit tests cover current-month aggregation, all-time usage, overview summary, type/search filtering, duplicate-name detection, edit-lock rules, validation, icon fallback, and Transactions category option construction.
- Preserve all existing finance and transaction tests.
- Run the complete unit suite with at least 80% overall coverage.
- Run lint, TypeScript, production build, and dependency audit.
- Browser QA at desktop and 390×844 mobile sizes.
- Exercise type filters, search, create form, edit form for unused and used categories, delete confirmation, dynamic Transactions category selection, dialog scrolling, and keyboard dismissal without writing production data.
- Confirm no global horizontal overflow, no clipped controls, no content hidden behind mobile navigation, and no console warnings or errors.
- Compare final Categories screens together with the approved Dashboard, Transactions, and Accounts references.

## Out of scope

- Category budgets or spending limits.
- Automatic categorization rules.
- Merging two categories.
- Rewriting historical category names.
- Changing transaction types when a category type changes.
- Category archival or soft deletion.
- Database migrations or schema changes.
- PWA, Investments, Trading, or Settings work in this pass.

## Success criteria

- Users can understand category coverage and current-month usage within a few seconds.
- Custom category creation, safe editing, and deletion are obvious and require no browser-native dialogs.
- Used categories cannot be renamed or retyped accidentally.
- Transactions uses the database-backed category system while retaining access to historical labels.
- Desktop and mobile retain the same information hierarchy with safe, reachable actions.
- The page visually belongs to the same premium, calm FinTrack system as Dashboard, Login, Transactions, and Accounts.
