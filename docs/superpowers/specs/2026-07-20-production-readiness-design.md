# FinTrack Production Readiness Design

## Goal

Make FinTrack safe and dependable to run as a personal-finance PWA in production. A signed-out user must never see protected application content, authenticated users must get calm and actionable failure states, private financial responses must not be cached, and the release must have automated evidence for its critical paths.

This phase does not add database tables or change the approved mint, white, navy, and emerald visual direction.

## Selected approach

Use balanced hardening: centralize cross-cutting behavior without introducing an external observability platform or infrastructure that this personal application does not yet need. Existing feature pages keep responsibility for their own data queries and mutations, while shared modules own session state, error presentation, configuration validation, and release checks.

## Authentication and protected routes

- Treat `/login`, `/offline`, `/manifest.webmanifest`, icons, service-worker files, and static framework assets as public.
- Treat Dashboard, Transactions, Accounts, Categories, Investments, Trading, Insights, and Settings as protected application routes.
- Add one client-side authenticated application boundary at the root shell with an explicit public-route allowlist. It resolves the local Supabase session, subscribes to auth changes, renders a consistent loading shell while a protected route is unresolved, and redirects signed-out online users to `/login` with a sanitized `next` destination.
- When offline, an existing authenticated session may keep already-rendered application UI available. A user without a local session sees the branded offline state instead of entering a protected screen.
- Navbar becomes a session consumer rather than a second route guard. Logout clears the session and replaces history with `/login`.
- Successful login returns users only to an allowed internal route. External URLs and protocol-relative destinations are rejected.

Because authentication uses browser-managed Supabase state, this phase does not pretend that a static server-rendered page can verify the client token. Authorization remains enforced at the data boundary by Supabase RLS and by explicit user verification in server API routes.

## Configuration and failure behavior

- Replace silent placeholder Supabase values with an explicit configuration result. The public setup screen remains available when configuration is absent, but protected data operations never run against placeholder credentials.
- Add shared error normalization for `Error`, Supabase/PostgREST errors, failed fetches, and unknown values. User-facing copy stays concise; diagnostics preserve code, details, and hint without generating a Next.js development error overlay for handled failures.
- Standardize page states: initial loading, retryable load failure, empty content, offline/unavailable, mutation in progress, and mutation failure.
- Preserve successfully loaded content during refresh failures where possible. A failed refresh should not blank a usable financial screen.
- Timeouts must clean up their timers and return Indonesian user-facing messages.

## Security boundaries

- Add conservative response headers: no MIME sniffing, strict referrer policy, frame denial, restrictive permissions policy, and HSTS in production.
- Add a Content Security Policy compatible with Next.js, Supabase HTTPS/WebSocket traffic, existing fonts/styles, and the PWA. Development may allow the minimum extra sources required by hot reload.
- API trade-review requests must validate the route identifier, bearer token shape, authenticated owner, JSON response behavior, webhook configuration, upstream timeout, and safe error mapping.
- Secrets remain server-only. No shared secret, webhook URL, or service-role credential may enter a `NEXT_PUBLIC_` variable or client bundle.
- Sensitive responses use `Cache-Control: no-store`. The service worker never caches authenticated HTML, Supabase responses, or API responses.
- Run dependency audit and source scans for hard-coded credentials as release gates.

## PWA behavior

- Keep the current install, update, safe-area, and deterministic online-state behavior.
- Replace any icon whose file signature does not match its declared MIME type. The current `.png` files contain JPEG data, so release assets must be regenerated as real 192×192 and 512×512 PNGs before PWA verification.
- Precache only the offline route, manifest, and verified icon assets.
- Cache same-origin versioned static assets; do not cache protected navigation documents.
- Any failed navigation resolves to the branded offline route. Install and update prompts remain dismissible and accessible.
- Development continues to unregister FinTrack workers and clear only FinTrack-owned caches.

## Automated verification

### Unit and integration tests

- Auth destination sanitization, auth-state decisions, configuration parsing, error normalization, security-header construction, API input validation, timeout behavior, and service-worker policy.
- Existing finance calculation and form-domain tests must remain green.

### Browser end-to-end tests

- Signed-out access to every protected route reaches Login.
- Login validates malformed input and exposes the successful magic-link state without a duplicate submission.
- Root routing chooses Login or Dashboard from the session state.
- Authenticated smoke coverage traverses primary desktop and mobile navigation with controlled local fixtures; it performs no production Supabase writes.
- Offline navigation displays the branded offline experience.
- Mobile smoke uses a phone-sized viewport and checks for page-level horizontal overflow.
- Tests fail on uncaught page errors and unexpected console errors.

Browser automation will use the user's selected browser workflow. If browser control is unavailable, browser E2E files and commands are still implemented, but runtime browser verification remains explicitly unproven rather than inferred.

### Release gates

- Unit tests and coverage pass.
- ESLint and TypeScript pass.
- Optimized Next.js build passes.
- Browser E2E passes in desktop and mobile projects.
- Dependency audit reports no unresolved high or critical production vulnerability.
- Manifest, service worker, icon dimensions/MIME signatures, public/protected route behavior, headers, and API no-store behavior are inspected from the built application.

## Completion criteria

Phase A is complete only when every protected route uses the shared auth boundary, handled provider failures no longer produce development error overlays, security and PWA policies are covered by automated tests, browser-critical flows pass, and the full release gate is green. A checklist or passing unit suite alone is not sufficient evidence.

## Out of scope

- No database migration.
- No external monitoring vendor, analytics platform, or error-reporting account.
- No service-role Supabase client.
- No silent offline mutation queue.
- No product onboarding or new smart-insight feature; those belong to phases B and C.
