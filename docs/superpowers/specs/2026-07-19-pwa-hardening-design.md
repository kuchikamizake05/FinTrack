# FinTrack PWA Hardening Design

## Goal

Make FinTrack dependable and calm when installed on mobile without changing its data model. PWA feedback should feel like part of the premium mint/emerald product system, not like browser chrome or a technical warning.

## Experience

- A global install card appears only when the browser exposes an install prompt, is hidden in standalone mode, and respects a seven-day dismissal cooldown.
- A global offline card explains that already-open information remains readable and that new work should wait for connectivity.
- A global update card appears when a waiting service worker is ready. The user explicitly applies the update, after which the app reloads once under the new worker.
- Offline navigations fall back to a dedicated branded offline screen instead of a browser error.
- All PWA cards sit above the floating mobile navigation and respect device safe areas.

## Technical behavior

- The service worker is registered only in production. Development unregisters FinTrack workers and clears FinTrack caches to avoid stale Next.js bundles.
- The worker precaches only the offline route, manifest, and app icons. It uses network-first navigation and a safe offline fallback; protected financial documents are not stored as a general page cache.
- Same-origin static styles, scripts, fonts, and images use cache-first with background refresh.
- A waiting worker does not take over until the user chooses `Perbarui`.
- The generated Next.js manifest uses the existing icon assets, light mint splash background, emerald theme color, standalone display, flexible orientation, finance/productivity categories, and useful app shortcuts.

## Mobile hardening

- The root viewport uses `viewport-fit=cover` and a light color scheme.
- Mobile top navigation includes `safe-area-inset-top`.
- Floating bottom navigation and global PWA feedback include `safe-area-inset-bottom`.
- Bottom sheets already use safe-area-aware sticky actions and remain unchanged.

## Out of scope

- No database migration.
- No background financial data sync or queued writes. Silent offline mutation queues are intentionally avoided because financial writes need explicit confirmation and conflict handling.
